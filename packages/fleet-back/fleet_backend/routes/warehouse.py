import uuid
from typing import Any
from flask import jsonify, request
from database import connect, rows_to_dicts
from fleet_backend.common import require_auth, rpc_error, rpc_payload, rpc_response, now_iso, with_meta
from fleet_backend.server import app

def serialize_warehouse_row(row: dict) -> dict:
    workers = int(row.get("workers_count") or 0)
    union = int(row.get("union_count") or 0)
    rate = float(row.get("rate_per_unload") or 0)
    unloads = int(row.get("total_unloads") or 0)
    
    total_labours = workers + union
    total_sum_of_unload = rate * unloads
    
    if total_labours == 0:
        per_person_salary = 0.0
        total_workers_salary = 0.0
    else:
        per_person_salary = total_sum_of_unload / total_labours
        total_workers_salary = per_person_salary * workers

    created_by_user = None
    if row.get("created_by"):
        created_by_user = {
            "id": row["created_by"],
            "name": row.get("created_by_name") or "",
            "image": row.get("created_by_image"),
        }

    return {
        "id": row["id"],
        "recordDate": row["record_date"],
        "workersCount": workers,
        "unionCount": union,
        "ratePerUnload": rate,
        "totalUnloads": unloads,
        "totalLabours": total_labours,
        "totalSumOfUnload": round(total_sum_of_unload, 2),
        "perPersonSalary": round(per_person_salary, 4),
        "totalWorkersSalary": round(total_workers_salary, 2),
        "status": row.get("status", "unpaid"),
        "createdBy": row.get("created_by"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "createdByUser": created_by_user,
    }

@app.post("/orpc/admin/warehouse/list")
@require_auth({"admin"})
def orpc_list_warehouse(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 100)), 200)
    status_filter = payload.get("status", "all")  # "all" | "paid" | "unpaid"
    
    where_clauses = []
    params = []
    
    if status_filter in ("paid", "unpaid"):
        where_clauses.append("w.status = ?")
        params.append(status_filter)
        
    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    
    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                f"""
                SELECT w.*, u.name as created_by_name, u.image as created_by_image
                FROM warehouse_records w
                LEFT JOIN users u ON u.id = w.created_by
                {where_sql}
                ORDER BY w.record_date DESC, w.created_at DESC
                LIMIT ? OFFSET ?
                """,
                (*params, limit, offset),
            ).fetchall()
        )
        total = conn.execute(
            f"SELECT COUNT(*) AS c FROM warehouse_records w {where_sql}",
            tuple(params)
        ).fetchone()["c"]
        
    records = [serialize_warehouse_row(row) for row in rows]
    return rpc_response(with_meta(records, offset, limit, total))

@app.post("/orpc/admin/warehouse/create")
@require_auth({"admin"})
def orpc_create_warehouse(user):
    payload = rpc_payload()
    
    try:
        workers = int(payload.get("workersCount", 0))
        union = int(payload.get("unionCount", 0))
        rate = float(payload.get("ratePerUnload", 0.0))
        unloads = int(payload.get("totalUnloads", 0))
        record_date = payload.get("recordDate")
        status = payload.get("status", "unpaid")
    except (ValueError, TypeError):
        return rpc_error("Invalid numerical input values.", 400)
        
    if not record_date:
        return rpc_error("Record date is required.", 400)
    if workers + union == 0:
        return rpc_error("Total Labours (Workers + Union) cannot be zero.", 400)
    if status not in ("paid", "unpaid"):
        status = "unpaid"

    with connect() as conn:
        wid = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO warehouse_records (
                id, record_date, workers_count, union_count, rate_per_unload, total_unloads, status, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (wid, record_date, workers, union, rate, unloads, status, user["id"], now_iso(), now_iso())
        )
        conn.commit()
        
        row = conn.execute(
            """
            SELECT w.*, u.name as created_by_name, u.image as created_by_image
            FROM warehouse_records w
            LEFT JOIN users u ON u.id = w.created_by
            WHERE w.id = ?
            """,
            (wid,)
        ).fetchone()
        
    return rpc_response(serialize_warehouse_row(dict(row)))

@app.post("/orpc/admin/warehouse/update")
@require_auth({"admin"})
def orpc_update_warehouse(user):
    payload = rpc_payload()
    wid = payload.get("id")
    
    if not wid:
        return rpc_error("Record ID is required for updates.", 400)

    try:
        workers = int(payload.get("workersCount", 0))
        union = int(payload.get("unionCount", 0))
        rate = float(payload.get("ratePerUnload", 0.0))
        unloads = int(payload.get("totalUnloads", 0))
        record_date = payload.get("recordDate")
        status = payload.get("status", "unpaid")
    except (ValueError, TypeError):
        return rpc_error("Invalid numerical input values.", 400)

    if workers + union == 0:
        return rpc_error("Total Labours (Workers + Union) cannot be zero.", 400)
    if status not in ("paid", "unpaid"):
        return rpc_error("Invalid status value.", 400)

    with connect() as conn:
        existing = conn.execute("SELECT id FROM warehouse_records WHERE id = ?", (wid,)).fetchone()
        if not existing:
            return rpc_error("Warehouse record not found.", 404)

        conn.execute(
            """
            UPDATE warehouse_records
            SET record_date = ?, workers_count = ?, union_count = ?, rate_per_unload = ?, total_unloads = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (record_date, workers, union, rate, unloads, status, now_iso(), wid)
        )
        conn.commit()
        
        row = conn.execute(
            """
            SELECT w.*, u.name as created_by_name, u.image as created_by_image
            FROM warehouse_records w
            LEFT JOIN users u ON u.id = w.created_by
            WHERE w.id = ?
            """,
            (wid,)
        ).fetchone()

    return rpc_response(serialize_warehouse_row(dict(row)))

@app.post("/orpc/admin/warehouse/bulk_update_status")
@require_auth({"admin"})
def orpc_bulk_update_status(user):
    payload = rpc_payload()
    ids = payload.get("ids")
    status = payload.get("status")
    
    if not isinstance(ids, list) or not ids:
        return rpc_error("A non-empty list of IDs is required.", 400)
    if status not in ("paid", "unpaid"):
        return rpc_error("Invalid status value.", 400)

    placeholders = ",".join("?" for _ in ids)
    with connect() as conn:
        conn.execute(
            f"""
            UPDATE warehouse_records
            SET status = ?, updated_at = ?
            WHERE id IN ({placeholders})
            """,
            (status, now_iso(), *ids)
        )
        conn.commit()
        
    return rpc_response({"ok": True})

@app.post("/orpc/admin/warehouse/delete")
@require_auth({"admin"})
def orpc_delete_warehouse(user):
    payload = rpc_payload()
    wid = payload.get("id")
    
    if not wid:
        return rpc_error("Record ID is required.", 400)

    with connect() as conn:
        existing = conn.execute("SELECT id FROM warehouse_records WHERE id = ?", (wid,)).fetchone()
        if not existing:
            return rpc_error("Warehouse record not found.", 404)
            
        conn.execute("DELETE FROM warehouse_records WHERE id = ?", (wid,))
        conn.commit()
        
    return rpc_response({"ok": True})