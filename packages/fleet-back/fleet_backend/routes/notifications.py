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
        SELECT i.id, i.vehicle_id, i.voucher_id, i.next_renewal_date, i.transaction_date, i.expense_category_id,
               c.name AS category_name, v.name AS vehicle_name
        FROM journal_entry_items i
        LEFT JOIN vehicles v ON v.id = i.vehicle_id
        LEFT JOIN expense_category c ON c.id = i.expense_category_id
        WHERE i.type = 'debit' AND i.next_renewal_date IS NOT NULL
        """
    ).fetchall())

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
        params = []
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
        row = conn.execute('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0').fetchone()
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
        conn.execute('DELETE FROM notifications WHERE id = ?', (payload.get('id'),))
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
