import uuid
from typing import Any
from flask import jsonify, request
from database import connect, rows_to_dicts
from fleet_backend.common import require_auth, rpc_error, rpc_payload, rpc_response, now_iso, with_meta
from fleet_backend.server import app

def check_warehouse_permission(conn: Any, user: dict[str, Any], resource_id: str, action: str) -> bool:
    """Check if the user has permission to edit or delete a warehouse record."""
    role_row = conn.execute(
        "SELECT 1 FROM user_roles WHERE user_id = ? AND role IN ('admin','owner') LIMIT 1",
        (user["id"],),
    ).fetchone()
    if role_row:
        return True

    grant_row = conn.execute(
        """
        SELECT id FROM access_grants
        WHERE user_id = ? AND resource_id = ? AND action = ?
        LIMIT 1
        """,
        (user["id"], resource_id, action),
    ).fetchone()
    return bool(grant_row)

def serialize_warehouse_row(row: dict) -> dict:
    section = row.get("section") or "JAS"
    firm_name = row.get("firm_name") or ""
    product_name = row.get("product_name") or ""
    workers = float(row.get("workers_count") or 0)
    union = float(row.get("union_count") or 0)
    rate = float(row.get("rate_per_unload") or 0)
    unloads = float(row.get("total_unloads") or 0)
    union_sum = float(row.get("union_sum") or 0)
    own_staff_amount = float(row.get("own_staff_amount") or 0)

    total_labours = workers + union
    total_value = rate * unloads

    # Calculate One Person Salary, Own Staff Salary, and Union Salary strictly from formulas
    if total_labours > 0:
        per_person_salary = total_value / total_labours
        total_workers_salary = per_person_salary * workers
        total_union_salary = per_person_salary * union
    else:
        total_workers_salary = 0.0
        total_union_salary = 0.0

    created_by_user = None
    if row.get("created_by"):
        created_by_user = {
            "id": row["created_by"],
            "name": row.get("created_by_name") or "",
            "image": row.get("created_by_image"),
        }

    return {
        "id": row["id"],
        "section": section,
        "recordDate": row["record_date"],
        "firmName": firm_name,
        "productName": product_name,
        "workersCount": workers,
        "unionCount": union,
        "ratePerUnload": rate,
        "totalUnloads": unloads,
        "totalValue": round(total_value, 2),
        "totalLabours": total_labours,
        "unionSum": union_sum,
        "ownStaffAmount": own_staff_amount,
        "totalWorkersSalary": round(total_workers_salary, 2),
        "totalUnionSalary": round(total_union_salary, 2),
        "status": row.get("status", "unpaid"),
        "paidBy": row.get("paid_by"),
        "paidAt": row.get("paid_at"),
        "paidByName": row.get("paid_by_name") or "",
        "reason": row.get("reason") or "",
        "createdBy": row.get("created_by"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "createdByUser": created_by_user,
    }


@app.post("/orpc/admin/warehouse/list")
@app.post("/api/orpc/admin/warehouse/list")
@require_auth({"admin", "accountant", "analyst"})
def orpc_list_warehouse(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 100)), 200)
    section = payload.get("section", "JAS")
    status_filter = payload.get("status", "all")  # "all" | "paid" | "unpaid"
    start_date = payload.get("startDate")
    end_date = payload.get("endDate")
    search = (payload.get("search") or "").strip()

    if section not in ("JAS", "JKM", "General"):
        section = "JAS"

    where_clauses = ["COALESCE(w.section, 'JAS') = ?"]
    params: list[Any] = [section]

    if status_filter in ("paid", "unpaid"):
        where_clauses.append("w.status = ?")
        params.append(status_filter)

    if start_date:
        where_clauses.append("SUBSTR(w.record_date, 1, 10) >= ?")
        params.append(start_date)

    if end_date:
        where_clauses.append("SUBSTR(w.record_date, 1, 10) <= ?")
        params.append(end_date)

    if search:
        where_clauses.append("(LOWER(w.firm_name) LIKE ? OR LOWER(w.product_name) LIKE ?)")
        params.extend([f"%{search.lower()}%", f"%{search.lower()}%"])

    where_sql = f"WHERE {' AND '.join(where_clauses)}"

    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                f"""
                SELECT w.*, u.name as created_by_name, u.image as created_by_image, pb.name as paid_by_name
                FROM warehouse_records w
                LEFT JOIN users u ON u.id = w.created_by
                LEFT JOIN users pb ON pb.id = w.paid_by
                {where_sql}
                ORDER BY w.record_date DESC, w.created_at DESC
                LIMIT ? OFFSET ?
                """,
                (*params, limit, offset),
            ).fetchall()
        )
        total = conn.execute(
            f"SELECT COUNT(*) AS c FROM warehouse_records w {where_sql}",
            tuple(params),
        ).fetchone()["c"]

    records = [serialize_warehouse_row(row) for row in rows]
    return rpc_response(with_meta(records, offset, limit, total))


@app.post("/orpc/admin/warehouse/get")
@app.post("/api/orpc/admin/warehouse/get")
@require_auth({"admin", "accountant", "analyst"})
def orpc_get_warehouse_record(user):
    payload = rpc_payload()
    wid = payload.get("id")
    if not wid:
        return rpc_error("Record ID is required.", 400)

    with connect() as conn:
        row = conn.execute(
            """
            SELECT w.*, u.name as created_by_name, u.image as created_by_image, pb.name as paid_by_name
            FROM warehouse_records w
            LEFT JOIN users u ON u.id = w.created_by
            LEFT JOIN users pb ON pb.id = w.paid_by
            WHERE w.id = ?
            """,
            (wid,),
        ).fetchone()

    if not row:
        return rpc_error("Warehouse record not found.", 404)

    return rpc_response(serialize_warehouse_row(dict(row)))


@app.post("/orpc/admin/warehouse/create")
@app.post("/api/orpc/admin/warehouse/create")
@require_auth({"admin", "accountant"})
def orpc_create_warehouse(user):
    payload = rpc_payload()
    section = payload.get("section", "JAS")
    if section not in ("JAS", "JKM", "General"):
        section = "JAS"

    try:
        workers = float(payload.get("workersCount", 0) or 0)
        union = float(payload.get("unionCount", 0) or 0)
        rate = float(payload.get("ratePerUnload", 0.0) or 0.0)
        unloads = float(payload.get("totalUnloads", 0) or 0)
        record_date = payload.get("recordDate")
        firm_name = (payload.get("firmName") or "").strip()
        product_name = (payload.get("productName") or "").strip()
        status = payload.get("status", "unpaid")
    except (ValueError, TypeError):
        return rpc_error("Invalid numerical input values.", 400)

    total_labours = workers + union
    total_value = rate * unloads
    per_person_salary = total_value / total_labours if total_labours > 0 else 0.0
    union_sum = per_person_salary * union
    own_staff_amount = per_person_salary * workers

    if not record_date:
        return rpc_error("Record date is required.", 400)
    if status not in ("paid", "unpaid"):
        status = "unpaid"

    paid_by = user["id"] if status == "paid" else None
    paid_at = now_iso() if status == "paid" else None

    with connect() as conn:
        wid = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO warehouse_records (
                id, section, record_date, firm_name, product_name, workers_count, union_count,
                rate_per_unload, total_unloads, union_sum, own_staff_amount, status, paid_by, paid_at,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                wid,
                section,
                record_date,
                firm_name,
                product_name,
                workers,
                union,
                rate,
                unloads,
                union_sum,
                own_staff_amount,
                status,
                paid_by,
                paid_at,
                user["id"],
                now_iso(),
                now_iso(),
            ),
        )
        conn.commit()

        row = conn.execute(
            """
            SELECT w.*, u.name as created_by_name, u.image as created_by_image, pb.name as paid_by_name
            FROM warehouse_records w
            LEFT JOIN users u ON u.id = w.created_by
            LEFT JOIN users pb ON pb.id = w.paid_by
            WHERE w.id = ?
            """,
            (wid,),
        ).fetchone()

    return rpc_response(serialize_warehouse_row(dict(row)))


@app.post("/orpc/admin/warehouse/update")
@app.post("/api/orpc/admin/warehouse/update")
@require_auth({"admin", "accountant"})
def orpc_update_warehouse(user):
    payload = rpc_payload()
    wid = payload.get("id")
    reason = (payload.get("reason") or "").strip()

    if not wid:
        return rpc_error("Record ID is required for updates.", 400)

    with connect() as conn:
        existing = conn.execute("SELECT * FROM warehouse_records WHERE id = ?", (wid,)).fetchone()
        if not existing:
            return rpc_error("Warehouse record not found.", 404)

        if not check_warehouse_permission(conn, user, wid, "edit"):
            return rpc_error("Access denied. Permission required to edit warehouse records.", 403)

        if not reason:
            return rpc_error("A reason is required to update a warehouse record.", 400)

        section = payload.get("section") or existing["section"] or "JAS"
        if section not in ("JAS", "JKM", "General"):
            section = "JAS"

        try:
            workers = float(payload.get("workersCount", existing["workers_count"]) or 0)
            union = float(payload.get("unionCount", existing["union_count"]) or 0)
            rate = float(payload.get("ratePerUnload", existing["rate_per_unload"]) or 0.0)
            unloads = float(payload.get("totalUnloads", existing["total_unloads"]) or 0)
            record_date = payload.get("recordDate") or existing["record_date"]
            firm_name = payload.get("firmName") if payload.get("firmName") is not None else existing.get("firm_name")
            product_name = payload.get("productName") if payload.get("productName") is not None else existing.get("product_name")
            status = payload.get("status") or existing["status"]
        except (ValueError, TypeError):
            return rpc_error("Invalid numerical input values.", 400)

        total_labours = workers + union
        total_value = rate * unloads
        per_person_salary = total_value / total_labours if total_labours > 0 else 0.0
        union_sum = per_person_salary * union
        own_staff_amount = per_person_salary * workers

        if status not in ("paid", "unpaid"):
            return rpc_error("Invalid status value.", 400)

        paid_by = existing.get("paid_by")
        paid_at = existing.get("paid_at")
        if status == "paid" and existing["status"] != "paid":
            paid_by = user["id"]
            paid_at = now_iso()
        elif status == "unpaid":
            paid_by = None
            paid_at = None

        conn.execute(
            """
            UPDATE warehouse_records
            SET section = ?, record_date = ?, firm_name = ?, product_name = ?, workers_count = ?,
                union_count = ?, rate_per_unload = ?, total_unloads = ?, union_sum = ?,
                own_staff_amount = ?, status = ?, paid_by = ?, paid_at = ?, reason = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                section,
                record_date,
                firm_name,
                product_name,
                workers,
                union,
                rate,
                unloads,
                union_sum,
                own_staff_amount,
                status,
                paid_by,
                paid_at,
                reason,
                now_iso(),
                wid,
            ),
        )
        conn.commit()

        row = conn.execute(
            """
            SELECT w.*, u.name as created_by_name, u.image as created_by_image, pb.name as paid_by_name
            FROM warehouse_records w
            LEFT JOIN users u ON u.id = w.created_by
            LEFT JOIN users pb ON pb.id = w.paid_by
            WHERE w.id = ?
            """,
            (wid,),
        ).fetchone()

    return rpc_response(serialize_warehouse_row(dict(row)))


@app.post("/orpc/admin/warehouse/update_status")
@app.post("/api/orpc/admin/warehouse/update_status")
@require_auth({"admin", "accountant"})
def orpc_update_status(user):
    payload = rpc_payload()
    wid = payload.get("id")
    status = payload.get("status")

    if not wid:
        return rpc_error("Record ID is required.", 400)
    if status not in ("paid", "unpaid"):
        return rpc_error("Invalid status value.", 400)

    with connect() as conn:
        existing = conn.execute("SELECT * FROM warehouse_records WHERE id = ?", (wid,)).fetchone()
        if not existing:
            return rpc_error("Warehouse record not found.", 404)

        paid_by = user["id"] if status == "paid" else None
        paid_at = now_iso() if status == "paid" else None

        conn.execute(
            """
            UPDATE warehouse_records
            SET status = ?, paid_by = ?, paid_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (status, paid_by, paid_at, now_iso(), wid),
        )
        conn.commit()

        row = conn.execute(
            """
            SELECT w.*, u.name as created_by_name, u.image as created_by_image, pb.name as paid_by_name
            FROM warehouse_records w
            LEFT JOIN users u ON u.id = w.created_by
            LEFT JOIN users pb ON pb.id = w.paid_by
            WHERE w.id = ?
            """,
            (wid,),
        ).fetchone()

    return rpc_response(serialize_warehouse_row(dict(row)))


@app.post("/orpc/admin/warehouse/bulk_update_status")
@app.post("/api/orpc/admin/warehouse/bulk_update_status")
@require_auth({"admin", "accountant"})
def orpc_bulk_update_status(user):
    payload = rpc_payload()
    ids = payload.get("ids")
    status = payload.get("status")

    if not isinstance(ids, list) or not ids:
        return rpc_error("A non-empty list of IDs is required.", 400)
    if status not in ("paid", "unpaid"):
        return rpc_error("Invalid status value.", 400)

    paid_by = user["id"] if status == "paid" else None
    paid_at = now_iso() if status == "paid" else None

    placeholders = ",".join("?" for _ in ids)
    with connect() as conn:
        conn.execute(
            f"""
            UPDATE warehouse_records
            SET status = ?, paid_by = ?, paid_at = ?, updated_at = ?
            WHERE id IN ({placeholders})
            """,
            (status, paid_by, paid_at, now_iso(), *ids),
        )
        conn.commit()

    return rpc_response({"ok": True})


@app.post("/orpc/admin/warehouse/delete")
@app.post("/api/orpc/admin/warehouse/delete")
@require_auth({"admin", "accountant"})
def orpc_delete_warehouse(user):
    payload = rpc_payload()
    wid = payload.get("id")
    reason = (payload.get("reason") or "").strip()

    if not wid:
        return rpc_error("Record ID is required.", 400)

    with connect() as conn:
        existing = conn.execute("SELECT id FROM warehouse_records WHERE id = ?", (wid,)).fetchone()
        if not existing:
            return rpc_error("Warehouse record not found.", 404)

        if not check_warehouse_permission(conn, user, wid, "delete"):
            return rpc_error("Access denied. Permission required to delete warehouse records.", 403)

        if not reason:
            return rpc_error("A reason is required to delete a warehouse record.", 400)

        conn.execute("DELETE FROM warehouse_records WHERE id = ?", (wid,))
        conn.commit()

    return rpc_response({"ok": True})


@app.post("/orpc/admin/warehouse/firms_and_products")
@app.post("/api/orpc/admin/warehouse/firms_and_products")
@require_auth({"admin", "accountant", "analyst"})
def orpc_firms_and_products(user):
    payload = rpc_payload()
    section = payload.get("section", "JAS")
    with connect() as conn:
        firms = [
            row["firm_name"]
            for row in conn.execute(
                "SELECT DISTINCT firm_name FROM warehouse_records WHERE COALESCE(section, 'JAS') = ? AND firm_name IS NOT NULL AND firm_name != '' ORDER BY firm_name ASC",
                (section,),
            ).fetchall()
        ]
        products = [
            row["product_name"]
            for row in conn.execute(
                "SELECT DISTINCT product_name FROM warehouse_records WHERE COALESCE(section, 'JAS') = ? AND product_name IS NOT NULL AND product_name != '' ORDER BY product_name ASC",
                (section,),
            ).fetchall()
        ]
    return rpc_response({"firms": firms, "products": products})