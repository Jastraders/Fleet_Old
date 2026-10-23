import uuid
from datetime import datetime
from typing import Any
from flask import jsonify, request
from database import connect, rows_to_dicts
from fleet_backend.common import require_auth, rpc_error, rpc_payload, rpc_response, now_iso, with_meta, period_date_bounds
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
    limit = min(int(payload.get("limit", 100)), 10000)
    section = payload.get("section", "JAS")
    status_filter = payload.get("status", "all")  # "all" | "paid" | "unpaid"
    period = payload.get("period", "all_time")
    start_date_str = payload.get("startDate")
    end_date_str = payload.get("endDate")
    search = (payload.get("search") or "").strip()
    product = (payload.get("product") or "").strip()

    if section not in ("JAS", "JKM", "General"):
        section = "JAS"

    where_clauses = ["COALESCE(w.section, 'JAS') = ?"]
    params: list[Any] = [section]

    if status_filter in ("paid", "unpaid"):
        where_clauses.append("w.status = ?")
        params.append(status_filter)

    # Validate custom date range
    if (period == "custom" or (start_date_str and end_date_str)) and start_date_str and end_date_str:
        try:
            d_s = datetime.fromisoformat(start_date_str.replace("Z", "")).date()
            d_e = datetime.fromisoformat(end_date_str.replace("Z", "")).date()
            if d_s > d_e:
                return rpc_error("Start date cannot be later than end date.", 400)
        except (ValueError, TypeError):
            return rpc_error("Invalid date format. Expected YYYY-MM-DD.", 400)

    effective_period = period
    if not payload.get("period") and (start_date_str or end_date_str):
        effective_period = "custom"

    current_start, current_end, _, _ = period_date_bounds(effective_period, start_date_str, end_date_str)
    if not current_start and start_date_str and effective_period == "custom":
        current_start = start_date_str[:10]
    if not current_end and end_date_str and effective_period == "custom":
        current_end = end_date_str[:10]

    if current_start:
        where_clauses.append("SUBSTR(w.record_date, 1, 10) >= ?")
        params.append(current_start)

    if current_end:
        where_clauses.append("SUBSTR(w.record_date, 1, 10) <= ?")
        params.append(current_end)

    if product and product != "all":
        where_clauses.append("LOWER(TRIM(w.product_name)) = ?")
        params.append(product.lower())

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
        stats_row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_count,
                COALESCE(SUM(w.total_unloads), 0) AS total_unloads,
                COALESCE(SUM(w.rate_per_unload * w.total_unloads), 0) AS total_value,
                COALESCE(SUM(
                    CASE WHEN (w.workers_count + w.union_count) > 0
                         THEN ((w.rate_per_unload * w.total_unloads) / (w.workers_count + w.union_count)) * w.workers_count
                         ELSE 0
                    END
                ), 0) AS total_own_staff_salary,
                COALESCE(SUM(
                    CASE WHEN (w.workers_count + w.union_count) > 0
                         THEN ((w.rate_per_unload * w.total_unloads) / (w.workers_count + w.union_count)) * w.union_count
                         ELSE 0
                    END
                ), 0) AS total_union_salary
            FROM warehouse_records w
            {where_sql}
            """,
            tuple(params),
        ).fetchone()

        total = stats_row["total_count"] if stats_row else 0
        total_own_staff_salary = float(stats_row["total_own_staff_salary"] or 0) if stats_row else 0.0
        total_union_salary = float(stats_row["total_union_salary"] or 0) if stats_row else 0.0
        total_value = float(stats_row["total_value"] or 0) if stats_row else 0.0
        total_unloads = float(stats_row["total_unloads"] or 0) if stats_row else 0.0

    records = [serialize_warehouse_row(row) for row in rows]
    return rpc_response(with_meta(
        records,
        offset,
        limit,
        total,
        totalOwnStaffSalary=round(total_own_staff_salary, 2),
        totalUnionSalary=round(total_union_salary, 2),
        totalValue=round(total_value, 2),
        totalUnloads=round(total_unloads, 2),
    ))


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
        status = payload.get("status") or "paid"
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
        if product_name:
            try:
                conn.execute(
                    """
                    INSERT INTO warehouse_products (id, section, name, created_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (section, LOWER(name)) DO NOTHING
                    """,
                    (str(uuid.uuid4()), section, product_name, now_iso()),
                )
            except Exception:
                pass

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
        if product_name:
            try:
                conn.execute(
                    """
                    INSERT INTO warehouse_products (id, section, name, created_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (section, LOWER(name)) DO NOTHING
                    """,
                    (str(uuid.uuid4()), section, product_name, now_iso()),
                )
            except Exception:
                pass

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
        product_rows = conn.execute(
            """
            SELECT name FROM (
                SELECT TRIM(name) AS name FROM warehouse_products WHERE section = ? AND name IS NOT NULL AND TRIM(name) != ''
                UNION
                SELECT TRIM(product_name) AS name FROM warehouse_records WHERE COALESCE(section, 'JAS') = ? AND product_name IS NOT NULL AND TRIM(product_name) != ''
            ) sub
            ORDER BY LOWER(name) ASC
            """,
            (section, section),
        ).fetchall()
        seen = set()
        products = []
        for r in product_rows:
            p_name = r["name"]
            if p_name and p_name.lower() not in seen:
                seen.add(p_name.lower())
                products.append(p_name)
    return rpc_response({"firms": firms, "products": products})


@app.post("/orpc/admin/warehouse/products/list")
@app.post("/api/orpc/admin/warehouse/products/list")
@require_auth({"admin", "accountant", "analyst"})
def orpc_warehouse_products_list(user):
    payload = rpc_payload()
    section = payload.get("section", "JAS")
    if section not in ("JAS", "JKM", "General"):
        section = "JAS"
    include_archived = bool(payload.get("includeArchived", False))

    with connect() as conn:
        if include_archived:
            rows = conn.execute(
                """
                SELECT name FROM (
                    SELECT TRIM(name) AS name FROM warehouse_products WHERE section = ? AND name IS NOT NULL AND TRIM(name) != ''
                    UNION
                    SELECT TRIM(product_name) AS name FROM warehouse_records WHERE COALESCE(section, 'JAS') = ? AND product_name IS NOT NULL AND TRIM(product_name) != ''
                ) sub
                ORDER BY LOWER(name) ASC
                """,
                (section, section),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT name FROM (
                    SELECT TRIM(name) AS name FROM warehouse_products 
                    WHERE section = ? AND COALESCE(status, 'active') = 'active' AND name IS NOT NULL AND TRIM(name) != ''
                    UNION
                    SELECT TRIM(product_name) AS name FROM warehouse_records 
                    WHERE COALESCE(section, 'JAS') = ? 
                      AND product_name IS NOT NULL 
                      AND TRIM(product_name) != ''
                      AND LOWER(TRIM(product_name)) NOT IN (
                          SELECT LOWER(TRIM(name)) FROM warehouse_products WHERE section = ? AND status = 'archived'
                      )
                ) sub
                ORDER BY LOWER(name) ASC
                """,
                (section, section, section),
            ).fetchall()

        seen = set()
        products = []
        for r in rows:
            p_name = r["name"]
            if p_name and p_name.lower() not in seen:
                seen.add(p_name.lower())
                products.append(p_name)

    return rpc_response({"products": products})


@app.post("/orpc/admin/warehouse/products/manage_list")
@app.post("/api/orpc/admin/warehouse/products/manage_list")
@require_auth({"admin", "accountant", "analyst"})
def orpc_warehouse_products_manage_list(user):
    payload = rpc_payload()
    section = payload.get("section", "JAS")
    if section not in ("JAS", "JKM", "General"):
        section = "JAS"

    with connect() as conn:
        rows = conn.execute(
            """
            SELECT 
                p.id,
                p.section,
                p.name,
                COALESCE(p.status, 'active') AS status,
                p.created_at,
                COALESCE(usage.record_count, 0) AS record_count
            FROM warehouse_products p
            LEFT JOIN (
                SELECT LOWER(TRIM(product_name)) AS prod_name, COUNT(*) AS record_count
                FROM warehouse_records
                WHERE COALESCE(section, 'JAS') = ? AND product_name IS NOT NULL AND TRIM(product_name) != ''
                GROUP BY LOWER(TRIM(product_name))
            ) usage ON LOWER(TRIM(p.name)) = usage.prod_name
            WHERE p.section = ?
            ORDER BY LOWER(p.name) ASC
            """,
            (section, section),
        ).fetchall()

        products = [
            {
                "id": r["id"],
                "section": r["section"],
                "name": r["name"],
                "status": r["status"] or "active",
                "inUse": int(r["record_count"] or 0) > 0,
                "recordCount": int(r["record_count"] or 0),
                "createdAt": r["created_at"],
            }
            for r in rows
        ]

    return rpc_response({"products": products})


@app.post("/orpc/admin/warehouse/products/create")
@app.post("/api/orpc/admin/warehouse/products/create")
@require_auth({"admin", "accountant"})
def orpc_warehouse_products_create(user):
    payload = rpc_payload()
    section = payload.get("section", "JAS")
    if section not in ("JAS", "JKM", "General"):
        section = "JAS"
    name = (payload.get("name") or "").strip()

    if not name:
        return rpc_error("Product name cannot be empty.", 400)

    with connect() as conn:
        # Check case-insensitive duplicate within this section in warehouse_products
        existing = conn.execute(
            """
            SELECT id, name, status FROM warehouse_products
            WHERE section = ? AND LOWER(TRIM(name)) = LOWER(?)
            LIMIT 1
            """,
            (section, name),
        ).fetchone()

        if existing:
            # If archived, unarchive / restore it back to active
            if existing.get("status") == "archived":
                conn.execute(
                    "UPDATE warehouse_products SET status = 'active' WHERE id = ?",
                    (existing["id"],),
                )
                conn.commit()
                return rpc_response({"name": existing["name"], "created": False, "restored": True, "status": "active"})
            return rpc_response({"name": existing["name"], "created": False, "status": existing.get("status", "active")})

        # Check existing records in this section
        existing_rec = conn.execute(
            """
            SELECT product_name AS name FROM warehouse_records
            WHERE COALESCE(section, 'JAS') = ? AND LOWER(TRIM(product_name)) = LOWER(?)
            LIMIT 1
            """,
            (section, name),
        ).fetchone()

        if existing_rec:
            try:
                pid = str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO warehouse_products (id, section, name, status, created_at)
                    VALUES (?, ?, ?, 'active', ?)
                    ON CONFLICT (section, LOWER(name)) DO NOTHING
                    """,
                    (pid, section, existing_rec["name"], now_iso()),
                )
                conn.commit()
            except Exception:
                pass
            return rpc_response({"name": existing_rec["name"], "created": False, "status": "active"})

        pid = str(uuid.uuid4())
        try:
            conn.execute(
                """
                INSERT INTO warehouse_products (id, section, name, status, created_at)
                VALUES (?, ?, ?, 'active', ?)
                ON CONFLICT (section, LOWER(name)) DO NOTHING
                """,
                (pid, section, name, now_iso()),
            )
            conn.commit()
        except Exception:
            pass

        # Query back canonical stored name (handles concurrent requests cleanly)
        stored = conn.execute(
            """
            SELECT name, status FROM warehouse_products
            WHERE section = ? AND LOWER(TRIM(name)) = LOWER(?)
            LIMIT 1
            """,
            (section, name),
        ).fetchone()

        stored_name = stored["name"] if stored else name
        return rpc_response({"name": stored_name, "created": True, "status": "active"})


@app.post("/orpc/admin/warehouse/products/archive")
@app.post("/api/orpc/admin/warehouse/products/archive")
@require_auth({"admin", "accountant"})
def orpc_warehouse_products_archive(user):
    payload = rpc_payload()
    section = payload.get("section", "JAS")
    if section not in ("JAS", "JKM", "General"):
        section = "JAS"
    pid = payload.get("id")
    name = (payload.get("name") or "").strip()

    if not pid and not name:
        return rpc_error("Product id or name is required.", 400)

    with connect() as conn:
        if pid:
            row = conn.execute(
                "SELECT id, name, section FROM warehouse_products WHERE id = ? AND section = ?",
                (pid, section),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id, name, section FROM warehouse_products WHERE section = ? AND LOWER(TRIM(name)) = LOWER(?)",
                (section, name),
            ).fetchone()

        if not row:
            # If historical product only in records, insert as archived
            if name:
                pid = str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO warehouse_products (id, section, name, status, created_at)
                    VALUES (?, ?, ?, 'archived', ?)
                    ON CONFLICT (section, LOWER(name)) DO UPDATE SET status = 'archived'
                    """,
                    (pid, section, name, now_iso()),
                )
                conn.commit()
                return rpc_response({"ok": True, "name": name, "status": "archived"})
            return rpc_error("Product not found.", 404)

        conn.execute(
            "UPDATE warehouse_products SET status = 'archived' WHERE id = ?",
            (row["id"],),
        )
        conn.commit()

    return rpc_response({"ok": True, "id": row["id"], "name": row["name"], "status": "archived"})


@app.post("/orpc/admin/warehouse/products/restore")
@app.post("/api/orpc/admin/warehouse/products/restore")
@require_auth({"admin", "accountant"})
def orpc_warehouse_products_restore(user):
    payload = rpc_payload()
    section = payload.get("section", "JAS")
    if section not in ("JAS", "JKM", "General"):
        section = "JAS"
    pid = payload.get("id")
    name = (payload.get("name") or "").strip()

    if not pid and not name:
        return rpc_error("Product id or name is required.", 400)

    with connect() as conn:
        if pid:
            row = conn.execute(
                "SELECT id, name, section FROM warehouse_products WHERE id = ? AND section = ?",
                (pid, section),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id, name, section FROM warehouse_products WHERE section = ? AND LOWER(TRIM(name)) = LOWER(?)",
                (section, name),
            ).fetchone()

        if not row:
            return rpc_error("Product not found.", 404)

        conn.execute(
            "UPDATE warehouse_products SET status = 'active' WHERE id = ?",
            (row["id"],),
        )
        conn.commit()

    return rpc_response({"ok": True, "id": row["id"], "name": row["name"], "status": "active"})


@app.post("/orpc/admin/warehouse/products/delete")
@app.post("/api/orpc/admin/warehouse/products/delete")
@require_auth({"admin", "accountant"})
def orpc_warehouse_products_delete(user):
    payload = rpc_payload()
    section = payload.get("section", "JAS")
    if section not in ("JAS", "JKM", "General"):
        section = "JAS"
    pid = payload.get("id")
    name = (payload.get("name") or "").strip()

    if not pid and not name:
        return rpc_error("Product id or name is required.", 400)

    with connect() as conn:
        if pid:
            row = conn.execute(
                "SELECT id, name, section FROM warehouse_products WHERE id = ? AND section = ?",
                (pid, section),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id, name, section FROM warehouse_products WHERE section = ? AND LOWER(TRIM(name)) = LOWER(?)",
                (section, name),
            ).fetchone()

        if not row:
            return rpc_error("Product not found.", 404)

        # Check whether the product is referenced by any warehouse record in the same section
        usage = conn.execute(
            """
            SELECT COUNT(*) AS c FROM warehouse_records 
            WHERE COALESCE(section, 'JAS') = ? AND LOWER(TRIM(product_name)) = LOWER(?)
            """,
            (section, row["name"]),
        ).fetchone()

        count = usage["c"] if usage else 0
        if count > 0:
            return rpc_error(
                f"Cannot delete product '{row['name']}': it is used by {count} warehouse record(s) in {section} Warehouse. You can archive it instead.",
                400,
            )

        conn.execute("DELETE FROM warehouse_products WHERE id = ?", (row["id"],))
        conn.commit()

    return rpc_response({"ok": True, "deleted": True, "name": row["name"]})