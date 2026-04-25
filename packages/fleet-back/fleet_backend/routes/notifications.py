import json
import uuid
from datetime import date, datetime

from database import connect, rows_to_dicts
from fleet_backend.common import require_auth, rpc_payload, rpc_response
from fleet_backend.server import app


def _to_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
    except ValueError:
        try:
            return datetime.strptime(value[:10], '%Y-%m-%d').date()
        except ValueError:
            return None


def sync_renewal_notifications(conn):
    today = date.today()
    due_rows = rows_to_dicts(conn.execute(
        """
        SELECT *
        FROM (
            SELECT
                i.id,
                i.vehicle_id,
                i.voucher_id,
                i.next_renewal_date,
                i.transaction_date,
                i.expense_category_id,
                i.created_at,
                c.name AS category_name,
                v.name AS vehicle_name,
                ROW_NUMBER() OVER (
                    PARTITION BY i.vehicle_id, COALESCE(i.expense_category_id, '')
                    ORDER BY i.transaction_date DESC, i.created_at DESC
                ) AS rn
            FROM journal_entry_items i
            LEFT JOIN vehicles v ON v.id = i.vehicle_id
            LEFT JOIN expense_category c ON c.id = i.expense_category_id
            WHERE i.type = 'debit' AND i.next_renewal_date IS NOT NULL
        ) ranked
        WHERE ranked.rn = 1
        """
    ).fetchall())
    valid_resource_ids = {row["id"] for row in due_rows}
    stale_rows = rows_to_dicts(
        conn.execute("SELECT id, resource_id FROM notifications WHERE type = 'renewal_reminder'").fetchall()
    )
    for notification in stale_rows:
        if notification.get("resource_id") not in valid_resource_ids:
            conn.execute("DELETE FROM notifications WHERE id = ?", (notification["id"],))

    for row in due_rows:
        renewal_date = _to_date(row.get('next_renewal_date'))
        if not renewal_date:
            continue
        days = (renewal_date - today).days
        should_create = days in {30, 1, 0} or (days > 1 and days < 30 and days % 7 == 0)
        if not should_create:
            continue

        resource_id = row['id']
        exists = conn.execute(
            "SELECT id FROM notifications WHERE type = 'renewal_reminder' AND resource_id = ? AND message = ?",
            (resource_id, f"{days}-day"),
        ).fetchone()
        if exists:
            continue

        category_name = row.get('category_name') or 'Renewal'
        vehicle_name = row.get('vehicle_name') or 'Vehicle'
        title = f"{category_name} renewal due for {vehicle_name}"
        message = f"{days}-day"
        metadata = json.dumps({
            'daysRemaining': days,
            'renewalDate': row.get('next_renewal_date'),
            'lastRenewedDate': row.get('transaction_date'),
            'vehicleName': vehicle_name,
            'renewalType': category_name,
            'voucherId': row.get('voucher_id'),
            'vehicleId': row.get('vehicle_id'),
            'expenseCategoryId': row.get('expense_category_id'),
        })
        conn.execute(
            "INSERT INTO notifications (id,type,title,message,resource_type,resource_id,metadata) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), 'renewal_reminder', title, message, 'journal_entry_item', resource_id, metadata),
        )


@app.post('/orpc/general/notifications/list')
@require_auth()
def list_notifications(user):
    payload = rpc_payload()
    filter_type = payload.get('filter', 'all')
    with connect() as conn:
        sync_renewal_notifications(conn)
        where = []
        params = [user["id"]]
        where.append("(recipient_user_id IS NULL OR recipient_user_id = ?)")
        if filter_type == 'unread':
            where.append('is_read = 0')
        where_sql = f"WHERE {' AND '.join(where)}" if where else ''
        rows = rows_to_dicts(conn.execute(
            f"SELECT * FROM notifications {where_sql} ORDER BY created_at DESC LIMIT 100",
            tuple(params),
        ).fetchall())
        conn.commit()
    return rpc_response(rows)


@app.post('/orpc/general/notifications/count')
@require_auth()
def notifications_count(user):
    with connect() as conn:
        sync_renewal_notifications(conn)
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0 AND (recipient_user_id IS NULL OR recipient_user_id = ?)",
            (user["id"],),
        ).fetchone()
        conn.commit()
    return rpc_response({'unread': int(row['c'] or 0)})


@app.post('/orpc/general/notifications/markRead')
@require_auth()
def mark_read(user):
    payload = rpc_payload()
    with connect() as conn:
        conn.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', (payload.get('id'),))
        conn.commit()
    return rpc_response({'ok': True})


@app.post('/orpc/general/notifications/delete')
@require_auth()
def delete_notification(user):
    payload = rpc_payload()
    with connect() as conn:
        conn.execute(
            'DELETE FROM notifications WHERE id = ? AND (recipient_user_id IS NULL OR recipient_user_id = ?)',
            (payload.get('id'), user["id"]),
        )
        conn.commit()
    return rpc_response({'ok': True})


@app.post('/orpc/general/notifications/review')
@require_auth()
def review_notification(user):
    payload = rpc_payload()
    with connect() as conn:
        row = conn.execute("SELECT * FROM notifications WHERE id = ?", (payload.get("id"),)).fetchone()
        if not row:
            return rpc_response({"search": None})
        metadata = {}
        raw_metadata = row["metadata"]
        if raw_metadata:
            try:
                metadata = json.loads(raw_metadata)
            except json.JSONDecodeError:
                metadata = {}
    search_value = metadata.get("voucherId") or metadata.get("renewalType")
    return rpc_response({"search": str(search_value) if search_value else None})


@app.post('/orpc/general/access/request')
@require_auth({"accountant"})
def request_access(user):
    payload = rpc_payload()
    page_name = (payload.get("pageName") or "").strip()
    resource_type = (payload.get("resourceType") or "").strip()
    resource_id = (payload.get("resourceId") or "").strip()
    primary_label = (payload.get("primaryLabel") or "").strip()
    actions = payload.get("actions") or ["edit", "delete"]
    actions = [a for a in actions if a in {"edit", "delete"}]
    if not page_name or not resource_type or not resource_id or not primary_label:
        return rpc_response({"message": "Missing access request details"}, 400)
    if not actions:
        return rpc_response({"message": "At least one action is required"}, 400)

    with connect() as conn:
        admins = rows_to_dicts(
            conn.execute(
                """
                SELECT DISTINCT u.id
                FROM users u
                JOIN user_roles r ON r.user_id = u.id
                WHERE r.role IN ('admin', 'owner')
                """
            ).fetchall()
        )
        request_id = str(uuid.uuid4())
        metadata = json.dumps({
            "requestId": request_id,
            "requesterName": user["name"],
            "requesterId": user["id"],
            "pageName": page_name,
            "resourceType": resource_type,
            "resourceId": resource_id,
            "primaryLabel": primary_label,
            "actions": actions,
        })
        title = f'{user["name"]} requested access'
        message = f'{user["name"]} requested access to edit/delete "{primary_label}" from page "{page_name}".'
        for admin in admins:
            conn.execute(
                "INSERT INTO notifications (id,recipient_user_id,type,title,message,resource_type,resource_id,metadata) VALUES (?,?,?,?,?,?,?,?)",
                (
                    str(uuid.uuid4()),
                    admin["id"],
                    "access_request",
                    title,
                    message,
                    resource_type,
                    resource_id,
                    metadata,
                ),
            )
        conn.execute(
            """
            INSERT INTO access_requests (
                id, requester_user_id, status, page_name, resource_type, resource_id, primary_label, requested_actions, notification_id
            ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?)
            """,
            (request_id, user["id"], page_name, resource_type, resource_id, primary_label, json.dumps(actions), None),
        )
        conn.commit()
    return rpc_response({"ok": True})


@app.post('/orpc/general/access/check')
@require_auth({"accountant"})
def check_access(user):
    payload = rpc_payload()
    page_name = payload.get("pageName")
    resource_type = payload.get("resourceType")
    resource_id = payload.get("resourceId")
    action = payload.get("action")
    if action not in {"edit", "delete"}:
        return rpc_response({"allowed": False})
    with connect() as conn:
        role_row = conn.execute(
            "SELECT 1 FROM user_roles WHERE user_id = ? AND role IN ('admin','owner') LIMIT 1",
            (user["id"],),
        ).fetchone()
        if role_row:
            return rpc_response({"allowed": True})
        row = conn.execute(
            """
            SELECT id
            FROM access_grants
            WHERE user_id = ? AND page_name = ? AND resource_type = ? AND resource_id = ? AND action = ?
            LIMIT 1
            """,
            (user["id"], page_name, resource_type, resource_id, action),
        ).fetchone()
    return rpc_response({"allowed": bool(row)})


@app.post('/orpc/general/access/resolve')
@require_auth({"admin"})
def resolve_access_request(user):
    payload = rpc_payload()
    notification_id = payload.get("notificationId")
    decision = payload.get("decision")
    if decision not in {"allow", "deny"}:
        return rpc_response({"message": "Invalid decision"}, 400)
    with connect() as conn:
        notification = conn.execute(
            "SELECT * FROM notifications WHERE id = ? AND recipient_user_id = ?",
            (notification_id, user["id"]),
        ).fetchone()
        if not notification:
            return rpc_response({"message": "Notification not found"}, 404)
        metadata = {}
        try:
            metadata = json.loads(notification["metadata"] or "{}")
        except json.JSONDecodeError:
            metadata = {}
        request_id = metadata.get("requestId")
        request_row = conn.execute("SELECT * FROM access_requests WHERE id = ?", (request_id,)).fetchone()
        if not request_row:
            conn.execute("DELETE FROM notifications WHERE id = ?", (notification_id,))
            conn.commit()
            return rpc_response({"ok": True})

        actions = []
        try:
            actions = json.loads(request_row["requested_actions"] or "[]")
        except json.JSONDecodeError:
            actions = []
        if decision == "allow":
            for action in actions:
                if action not in {"edit", "delete"}:
                    continue
                conn.execute(
                    """
                    INSERT OR IGNORE INTO access_grants (id,user_id,page_name,resource_type,resource_id,action,granted_by)
                    VALUES (?,?,?,?,?,?,?)
                    """,
                    (
                        str(uuid.uuid4()),
                        request_row["requester_user_id"],
                        request_row["page_name"],
                        request_row["resource_type"],
                        request_row["resource_id"],
                        action,
                        user["id"],
                    ),
                )
            new_status = "allowed"
        else:
            new_status = "denied"
        conn.execute(
            "UPDATE access_requests SET status = ?, reviewed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_status, user["id"], request_id),
        )
        conn.execute("DELETE FROM notifications WHERE id = ?", (notification_id,))
        conn.commit()
    return rpc_response({"ok": True})
