import uuid
from typing import Any

from flask import jsonify, request

from database import connect, rows_to_dicts
from fleet_backend.common import (
    format_impacts,
    now_iso,
    parse_impacts,
    random_color,
    require_auth,
    serialize_driver_row,
    rpc_error,
    rpc_payload,
    rpc_response,
    serialize_expense_category_row,
    serialize_journal_entry_row,
    serialize_vehicle_row,
    with_meta,
)
from fleet_backend.server import app


def refresh_driver_total_expense(conn, driver_id: str | None):
    if not driver_id:
        return
    row = conn.execute(
        """
            SELECT COALESCE(SUM(i.amount), 0) AS total
            FROM journal_entries j
            JOIN journal_entry_items i ON i.journal_entry_id = j.id
            JOIN expense_category c ON c.id = i.expense_category_id
            WHERE j.driver_id = ?
              AND i.type = 'debit'
              AND INSTR(',' || c.impact || ',', ',driver,') > 0
        """,
        (driver_id,),
    ).fetchone()
    conn.execute(
        "UPDATE drivers SET total_expense = ?, updated_at = ? WHERE id = ?",
        (float(row["total"] or 0), now_iso(), driver_id),
    )


def refresh_vehicle_total_expense(conn, vehicle_id: str | None):
    if not vehicle_id:
        return
    row = conn.execute(
        """
            SELECT COALESCE(SUM(i.amount), 0) AS total
            FROM journal_entry_items i
            JOIN expense_category c ON c.id = i.expense_category_id
            WHERE i.vehicle_id = ?
              AND i.type = 'debit'
              AND INSTR(',' || c.impact || ',', ',vehicle,') > 0
        """,
        (vehicle_id,),
    ).fetchone()
    conn.execute(
        "UPDATE vehicles SET total_expense = ?, updated_at = ? WHERE id = ?",
        (float(row["total"] or 0), now_iso(), vehicle_id),
    )


def next_voucher_id(conn) -> int:
    row = conn.execute(
        "SELECT COALESCE(MAX(voucher_id), 0) + 1 AS next_id FROM journal_entry_items"
    ).fetchone()
    return int(row["next_id"] or 1)

@app.post("/orpc/accountant/vehicles/list")
@require_auth({"accountant"})
def orpc_list_vehicles(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 20)), 100)
    search = payload.get("search")
    sort_by = payload.get("sortBy", "vehicleName")
    sort_order = str(payload.get("sortOrder", "desc")).lower()

    where_clauses: list[str] = []
    where_params: list[Any] = []
    if search:
        where_clauses.append("(v.name LIKE ? OR v.license_plate LIKE ? OR v.model LIKE ?)")
        search_term = f"%{search}%"
        where_params.extend([search_term, search_term, search_term])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    sort_map = {
        "vehicleName": "LOWER(v.name)",
        "model": "LOWER(v.model)",
        "year": "v.year",
        "revenue": "v.total_revenue",
        "renewalDate": "v.renewal_date",
        "loadCapacity": "v.load_capacity",
        "investmentMode": "v.investment_mode",
        "expense": "v.total_expense",
        "createdBy": "LOWER(COALESCE(u.name, ''))",
    }
    order_column = sort_map.get(sort_by, "LOWER(v.name)")
    order_direction = "ASC" if sort_order == "asc" else "DESC"

    with connect() as conn:
        query = f"""
            SELECT
                v.*,
                u.name AS created_by_name,
                u.image AS created_by_image
            FROM vehicles v
            LEFT JOIN users u ON u.id = v.created_by
            {where_sql}
            ORDER BY {order_column} {order_direction}
            LIMIT ? OFFSET ?
        """
        rows = rows_to_dicts(conn.execute(query, (*where_params, limit, offset)).fetchall())
        total = conn.execute(
            f"""
                SELECT COUNT(*) AS c
                FROM vehicles v
                LEFT JOIN users u ON u.id = v.created_by
                {where_sql}
            """,
            tuple(where_params),
        ).fetchone()["c"]

    vehicles = [serialize_vehicle_row(row) for row in rows]
    return rpc_response(with_meta(vehicles, offset, limit, total))


@app.post("/orpc/accountant/vehicles/create")
@require_auth({"accountant"})
def orpc_create_vehicle(user):
    payload = rpc_payload()
    with connect() as conn:
        color = random_color()
        vid = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO vehicles (
                id,name,license_plate,model,year,renewal_date,load_capacity,
                investment_mode,total_price,monthly_emi,emi_start_date,emi_duration_months,down_payment,
                total_revenue,color,created_by
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                vid,
                payload["name"],
                payload["licensePlate"],
                payload["model"],
                payload["year"],
                payload["renewalDate"],
                payload["loadCapacity"],
                payload["investmentMode"],
                payload.get("totalPrice"),
                payload.get("monthlyEmi"),
                payload.get("emiStartDate"),
                payload.get("emiDurationMonths"),
                payload.get("downPayment"),
                0,
                color,
                user["id"],
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM vehicles WHERE id = ?", (vid,)).fetchone()
    return rpc_response(serialize_vehicle_row(dict(row)))


@app.post("/orpc/accountant/vehicles/get")
@require_auth({"accountant"})
def orpc_get_vehicle(user):
    payload = rpc_payload()
    vehicle_id = payload.get("id")
    with connect() as conn:
        row = conn.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
    if not row:
        return rpc_error("Vehicle not found", 404)
    return rpc_response(serialize_vehicle_row(dict(row)))


@app.post("/orpc/accountant/vehicles/update")
@require_auth({"accountant"})
def orpc_update_vehicle(user):
    payload = rpc_payload()
    vehicle_id = payload.get("id")
    updates = []
    params: list[Any] = []
    for field, db_col in (
        ("name", "name"),
        ("licensePlate", "license_plate"),
        ("model", "model"),
        ("year", "year"),
        ("renewalDate", "renewal_date"),
        ("loadCapacity", "load_capacity"),
        ("investmentMode", "investment_mode"),
        ("totalPrice", "total_price"),
        ("monthlyEmi", "monthly_emi"),
        ("emiStartDate", "emi_start_date"),
        ("emiDurationMonths", "emi_duration_months"),
        ("downPayment", "down_payment"),
        ("totalRevenue", "total_revenue"),
    ):
        if payload.get(field) is not None:
            updates.append(f"{db_col} = ?")
            params.append(payload[field])
    if not updates:
        return rpc_error("No fields to update", 400)
    params.extend([now_iso(), vehicle_id])
    with connect() as conn:
        exists = conn.execute("SELECT id FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
        if not exists:
            return rpc_error("Vehicle not found", 404)
        conn.execute(f"UPDATE vehicles SET {', '.join(updates)}, updated_at = ? WHERE id = ?", tuple(params))
        conn.commit()
        row = conn.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
    return rpc_response(serialize_vehicle_row(dict(row)))


@app.post("/orpc/accountant/vehicles/delete")
@require_auth({"accountant"})
def orpc_delete_vehicle(user):
    payload = rpc_payload()
    vehicle_id = payload.get("id")
    with connect() as conn:
        row = conn.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
        if not row:
            return rpc_error("Vehicle not found", 404)
        conn.execute("DELETE FROM vehicles WHERE id = ?", (vehicle_id,))
        conn.commit()
    return rpc_response(serialize_vehicle_row(dict(row)))


@app.post("/orpc/accountant/drivers/list")
@require_auth({"accountant"})
def orpc_list_drivers(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 20)), 100)
    search = payload.get("search")
    sort_by = payload.get("sortBy", "createdAt")
    sort_order = str(payload.get("sortOrder", "desc")).lower()

    where_clauses: list[str] = []
    where_params: list[Any] = []
    if search:
        where_clauses.append("(d.name LIKE ? OR d.phone_number LIKE ?)")
        search_term = f"%{search}%"
        where_params.extend([search_term, search_term])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    sort_map = {
        "driverName": "LOWER(d.name)",
        "driverPhoneNumber": "d.phone_number",
        "totalExpense": "d.total_expense",
        "createdAt": "d.created_at",
        "createdBy": "LOWER(COALESCE(u.name, ''))",
    }
    order_column = sort_map.get(sort_by, "d.created_at")
    order_direction = "ASC" if sort_order == "asc" else "DESC"

    with connect() as conn:
        query = f"""
            SELECT
                d.*,
                u.name AS created_by_name,
                u.image AS created_by_image
            FROM drivers d
            LEFT JOIN users u ON u.id = d.created_by
            {where_sql}
            ORDER BY {order_column} {order_direction}
            LIMIT ? OFFSET ?
        """
        rows = rows_to_dicts(conn.execute(query, (*where_params, limit, offset)).fetchall())
        total = conn.execute(
            f"""
                SELECT COUNT(*) AS c
                FROM drivers d
                LEFT JOIN users u ON u.id = d.created_by
                {where_sql}
            """,
            tuple(where_params),
        ).fetchone()["c"]

    drivers = [serialize_driver_row(row) for row in rows]
    return rpc_response(with_meta(drivers, offset, limit, total))


@app.post("/orpc/accountant/drivers/create")
@require_auth({"accountant"})
def orpc_create_driver(user):
    payload = rpc_payload()
    with connect() as conn:
        did = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO drivers (id,name,phone_number,color,created_by) VALUES (?,?,?,?,?)",
            (did, payload["name"], payload["phoneNumber"], random_color(), user["id"]),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM drivers WHERE id = ?", (did,)).fetchone()
    return rpc_response(serialize_driver_row(dict(row)))


@app.post("/orpc/accountant/drivers/get")
@require_auth({"accountant"})
def orpc_get_driver(user):
    payload = rpc_payload()
    driver_id = payload.get("id")
    with connect() as conn:
        row = conn.execute("SELECT * FROM drivers WHERE id = ?", (driver_id,)).fetchone()
    if not row:
        return rpc_error("Driver not found", 404)
    return rpc_response(serialize_driver_row(dict(row)))


@app.post("/orpc/accountant/drivers/update")
@require_auth({"accountant"})
def orpc_update_driver(user):
    payload = rpc_payload()
    driver_id = payload.get("id")
    updates = []
    params: list[Any] = []
    for field, db_col in (("name", "name"), ("phoneNumber", "phone_number")):
        if payload.get(field) is not None:
            updates.append(f"{db_col} = ?")
            params.append(payload[field])
    if not updates:
        return rpc_error("No fields to update", 400)
    params.extend([now_iso(), driver_id])

    with connect() as conn:
        exists = conn.execute("SELECT id FROM drivers WHERE id = ?", (driver_id,)).fetchone()
        if not exists:
            return rpc_error("Driver not found", 404)
        conn.execute(
            f"UPDATE drivers SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            tuple(params),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM drivers WHERE id = ?", (driver_id,)).fetchone()
    return rpc_response(serialize_driver_row(dict(row)))


@app.post("/orpc/accountant/drivers/delete")
@require_auth({"accountant"})
def orpc_delete_driver(user):
    payload = rpc_payload()
    driver_id = payload.get("id")
    with connect() as conn:
        row = conn.execute("SELECT * FROM drivers WHERE id = ?", (driver_id,)).fetchone()
        if not row:
            return rpc_error("Driver not found", 404)
        conn.execute("DELETE FROM drivers WHERE id = ?", (driver_id,))
        conn.commit()
    return rpc_response(serialize_driver_row(dict(row)))


@app.post("/orpc/accountant/expenseCategories/list")
@require_auth({"accountant"})
def orpc_list_categories(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 20)), 100)
    search = payload.get("search")
    sort_by = payload.get("sortBy", "createdAt")
    sort_order = str(payload.get("sortOrder", "desc")).lower()

    where_clauses: list[str] = []
    where_params: list[Any] = []
    if search:
        where_clauses.append("c.name LIKE ?")
        where_params.append(f"%{search}%")

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    sort_map = {
        "categoryName": "LOWER(c.name)",
        "createdAt": "c.created_at",
        "createdBy": "LOWER(COALESCE(u.name, ''))",
    }
    order_column = sort_map.get(sort_by, "c.created_at")
    order_direction = "ASC" if sort_order == "asc" else "DESC"

    with connect() as conn:
        query = f"""
            SELECT
                c.*,
                u.name AS created_by_name,
                u.image AS created_by_image
            FROM expense_category c
            LEFT JOIN users u ON u.id = c.created_by
            {where_sql}
            ORDER BY {order_column} {order_direction}
            LIMIT ? OFFSET ?
        """
        rows = rows_to_dicts(conn.execute(query, (*where_params, limit, offset)).fetchall())
        total = conn.execute(
            f"""
                SELECT COUNT(*) AS c
                FROM expense_category c
                LEFT JOIN users u ON u.id = c.created_by
                {where_sql}
            """,
            tuple(where_params),
        ).fetchone()["c"]

    categories = [serialize_expense_category_row(row) for row in rows]
    return rpc_response(with_meta(categories, offset, limit, total))


@app.post("/orpc/accountant/expenseCategories/create")
@require_auth({"accountant"})
def orpc_create_category(user):
    payload = rpc_payload()
    impacts = parse_impacts(payload.get("impact"))
    if not impacts:
        return rpc_error("Invalid impact", 400)
    with connect() as conn:
        cid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO expense_category (id,name,color,impact,created_by) VALUES (?,?,?,?,?)",
            (cid, payload["name"], random_color(), format_impacts(impacts), user["id"]),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM expense_category WHERE id = ?", (cid,)).fetchone()
    return rpc_response(serialize_expense_category_row(dict(row)))


@app.post("/orpc/accountant/expenseCategories/get")
@require_auth({"accountant"})
def orpc_get_category(user):
    payload = rpc_payload()
    category_id = payload.get("id")
    with connect() as conn:
        row = conn.execute("SELECT * FROM expense_category WHERE id = ?", (category_id,)).fetchone()
    if not row:
        return rpc_error("Category not found", 404)
    return rpc_response(serialize_expense_category_row(dict(row)))


@app.post("/orpc/accountant/expenseCategories/update")
@require_auth({"accountant"})
def orpc_update_category(user):
    payload = rpc_payload()
    category_id = payload.get("id")
    updates = []
    params: list[Any] = []
    if payload.get("name") is not None:
        updates.append("name = ?")
        params.append(payload["name"])
    if payload.get("impact") is not None:
        impacts = parse_impacts(payload["impact"])
        if not impacts:
            return rpc_error("Invalid impact", 400)
        updates.append("impact = ?")
        params.append(format_impacts(impacts))
    if not updates:
        return rpc_error("No fields to update", 400)

    with connect() as conn:
        exists = conn.execute("SELECT id FROM expense_category WHERE id = ?", (category_id,)).fetchone()
        if not exists:
            return rpc_error("Category not found", 404)
        params.extend([now_iso(), category_id])
        conn.execute(
            f"UPDATE expense_category SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            tuple(params),
        )
        if payload.get("impact") is not None:
            driver_ids = rows_to_dicts(conn.execute("SELECT id FROM drivers").fetchall())
            for driver in driver_ids:
                refresh_driver_total_expense(conn, driver["id"])
            vehicle_ids = rows_to_dicts(conn.execute("SELECT id FROM vehicles").fetchall())
            for vehicle in vehicle_ids:
                refresh_vehicle_total_expense(conn, vehicle["id"])
        conn.commit()
        row = conn.execute("SELECT * FROM expense_category WHERE id = ?", (category_id,)).fetchone()
    return rpc_response(serialize_expense_category_row(dict(row)))


@app.post("/orpc/accountant/expenseCategories/delete")
@require_auth({"accountant"})
def orpc_delete_category(user):
    payload = rpc_payload()
    category_id = payload.get("id")
    with connect() as conn:
        row = conn.execute("SELECT * FROM expense_category WHERE id = ?", (category_id,)).fetchone()
        if not row:
            return rpc_error("Category not found", 404)
        conn.execute("DELETE FROM expense_category WHERE id = ?", (category_id,))
        impacts = parse_impacts(row["impact"])
        if "driver" in impacts:
            driver_ids = rows_to_dicts(conn.execute("SELECT id FROM drivers").fetchall())
            for driver in driver_ids:
                refresh_driver_total_expense(conn, driver["id"])
        if "vehicle" in impacts:
            vehicle_ids = rows_to_dicts(conn.execute("SELECT id FROM vehicles").fetchall())
            for vehicle in vehicle_ids:
                refresh_vehicle_total_expense(conn, vehicle["id"])
        conn.commit()
    return rpc_response(serialize_expense_category_row(dict(row)))


@app.post("/orpc/accountant/journalEntries/list")
@require_auth({"accountant"})
def orpc_list_entries(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 20)), 100)
    search = payload.get("search")
    sort_by = payload.get("sortBy", "createdAt")
    sort_order = str(payload.get("sortOrder", "desc")).lower()

    where_clauses: list[str] = []
    where_params: list[Any] = []
    if search:
        search_term = f"%{search}%"
        where_clauses.append("(v.name LIKE ? OR v.license_plate LIKE ? OR COALESCE(u.name, '') LIKE ?)")
        where_params.extend([search_term, search_term, search_term])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    sort_map = {
        "vehicleName": "LOWER(COALESCE(v.name, ''))",
        "revenue": "COALESCE(t.revenue, 0)",
        "expenses": "COALESCE(t.expenses, 0)",
        "amount": "COALESCE(t.revenue, 0) - COALESCE(t.expenses, 0)",
        "createdBy": "LOWER(COALESCE(u.name, ''))",
        "createdAt": "j.created_at",
    }
    order_column = sort_map.get(sort_by, "j.created_at")
    order_direction = "ASC" if sort_order == "asc" else "DESC"

    with connect() as conn:
        entries = rows_to_dicts(
            conn.execute(
                f"""
                    SELECT
                        j.*,
                        v.name AS vehicle_name,
                        v.license_plate AS vehicle_license_plate,
                        d.name AS driver_name,
                        d.phone_number AS driver_phone_number,
                        u.name AS created_by_name,
                        u.image AS created_by_image,
                        COALESCE(t.revenue, 0) AS revenue,
                        COALESCE(t.expenses, 0) AS expenses,
                        COALESCE(t.revenue, 0) - COALESCE(t.expenses, 0) AS amount
                    FROM journal_entries j
                    LEFT JOIN vehicles v ON v.id = j.vehicle_id
                    LEFT JOIN drivers d ON d.id = j.driver_id
                    LEFT JOIN users u ON u.id = j.created_by
                    LEFT JOIN (
                        SELECT
                            journal_entry_id,
                            SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) AS revenue,
                            SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) AS expenses
                        FROM journal_entry_items
                        GROUP BY journal_entry_id
                    ) t ON t.journal_entry_id = j.id
                    {where_sql}
                    ORDER BY {order_column} {order_direction}
                    LIMIT ? OFFSET ?
                """,
                (*where_params, limit, offset),
            ).fetchall()
        )
        serialized_entries = []
        for entry in entries:
            items = rows_to_dicts(
                conn.execute(
                    "SELECT * FROM journal_entry_items WHERE journal_entry_id = ? ORDER BY transaction_date DESC",
                    (entry["id"],),
                ).fetchall()
            )
            serialized_entries.append(serialize_journal_entry_row(entry, items))
        total = conn.execute(
            f"""
                SELECT COUNT(*) AS c
                FROM journal_entries j
                LEFT JOIN vehicles v ON v.id = j.vehicle_id
                LEFT JOIN drivers d ON d.id = j.driver_id
                LEFT JOIN users u ON u.id = j.created_by
                {where_sql}
            """,
            tuple(where_params),
        ).fetchone()["c"]
    return rpc_response(with_meta(serialized_entries, offset, limit, total))


@app.post("/orpc/accountant/expenses/list")
@require_auth({"accountant"})
def orpc_list_expenses(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 20)), 100)
    search = payload.get("search")
    sort_by = payload.get("sortBy", "createdAt")
    sort_order = str(payload.get("sortOrder", "desc")).lower()

    where_clauses = ["i.type = 'debit'"]
    where_params: list[Any] = []
    if search:
        search_term = f"%{search}%"
        where_clauses.append(
            "(COALESCE(c.name, '') LIKE ? OR COALESCE(i.handler, '') LIKE ? OR COALESCE(v.name, '') LIKE ? OR COALESCE(d.name, '') LIKE ? OR CAST(COALESCE(i.voucher_id, 0) AS TEXT) LIKE ?)"
        )
        where_params.extend([search_term, search_term, search_term, search_term, search_term])

    where_sql = f"WHERE {' AND '.join(where_clauses)}"

    sort_map = {
        "voucherId": "COALESCE(i.voucher_id, 0)",
        "expenseCategory": "LOWER(COALESCE(c.name, ''))",
        "amount": "i.amount",
        "handler": "LOWER(COALESCE(i.handler, ''))",
        "nextRenewalDate": "COALESCE(i.next_renewal_date, '')",
        "expenseImpact": "LOWER(COALESCE(c.impact, ''))",
        "vehicle": "LOWER(COALESCE(v.name, ''))",
        "driver": "LOWER(COALESCE(d.name, ''))",
        "createdBy": "LOWER(COALESCE(u.name, ''))",
        "createdAt": "i.created_at",
    }
    order_column = sort_map.get(sort_by, "i.created_at")
    order_direction = "ASC" if sort_order == "asc" else "DESC"

    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                f"""
                    SELECT
                        i.*,
                        c.name AS category_name,
                        c.impact AS category_impact,
                        j.driver_id,
                        j.created_by AS expense_created_by,
                        j.created_at AS entry_created_at,
                        v.name AS vehicle_name,
                        v.license_plate AS vehicle_license_plate,
                        d.name AS driver_name,
                        u.name AS created_by_name
                    FROM journal_entry_items i
                    LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
                    LEFT JOIN expense_category c ON c.id = i.expense_category_id
                    LEFT JOIN vehicles v ON v.id = i.vehicle_id
                    LEFT JOIN drivers d ON d.id = j.driver_id
                    LEFT JOIN users u ON u.id = j.created_by
                    {where_sql}
                    ORDER BY {order_column} {order_direction}
                    LIMIT ? OFFSET ?
                """,
                (*where_params, limit, offset),
            ).fetchall()
        )
        total = conn.execute(
            f"""
                SELECT COUNT(*) AS c
                FROM journal_entry_items i
                LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
                LEFT JOIN expense_category c ON c.id = i.expense_category_id
                LEFT JOIN vehicles v ON v.id = i.vehicle_id
                LEFT JOIN drivers d ON d.id = j.driver_id
                {where_sql}
            """,
            tuple(where_params),
        ).fetchone()["c"]

    return rpc_response(with_meta(rows, offset, limit, total))


@app.post("/orpc/accountant/journalEntries/create")
@require_auth({"accountant"})
def orpc_create_entry(user):
    payload = rpc_payload()
    with connect() as conn:
        eid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO journal_entries (id,vehicle_id,driver_id,notes,created_by) VALUES (?,?,?,?,?)",
            (
                eid,
                payload["vehicleId"],
                payload.get("driverId"),
                payload.get("notes"),
                user["id"],
            ),
        )
        for item in payload.get("items", []):
            conn.execute(
                "INSERT INTO journal_entry_items (id,journal_entry_id,vehicle_id,transaction_date,type,amount,voucher_id,handler,next_renewal_date,expense_category_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    str(uuid.uuid4()),
                    eid,
                    payload["vehicleId"],
                    item["transactionDate"],
                    item["type"],
                    float(item["amount"]),
                    next_voucher_id(conn) if item["type"] == "debit" else None,
                    item.get("handler"),
                    item.get("nextRenewalDate"),
                    item.get("expenseCategoryId"),
                ),
            )
        refresh_driver_total_expense(conn, payload.get("driverId"))
        refresh_vehicle_total_expense(conn, payload["vehicleId"])
        conn.commit()
        entry = dict(conn.execute("SELECT * FROM journal_entries WHERE id = ?", (eid,)).fetchone())
        items = rows_to_dicts(conn.execute("SELECT * FROM journal_entry_items WHERE journal_entry_id = ?", (eid,)).fetchall())
    return rpc_response(serialize_journal_entry_row(entry, items))


@app.post("/orpc/accountant/journalEntries/get")
@require_auth({"accountant"})
def orpc_get_entry(user):
    payload = rpc_payload()
    entry_id = payload.get("id")
    with connect() as conn:
        row = conn.execute(
            """
                SELECT
                    j.*,
                    v.name AS vehicle_name,
                    v.license_plate AS vehicle_license_plate,
                    d.name AS driver_name,
                    d.phone_number AS driver_phone_number,
                    u.name AS created_by_name,
                    u.image AS created_by_image
                FROM journal_entries j
                LEFT JOIN vehicles v ON v.id = j.vehicle_id
                LEFT JOIN drivers d ON d.id = j.driver_id
                LEFT JOIN users u ON u.id = j.created_by
                WHERE j.id = ?
            """,
            (entry_id,),
        ).fetchone()
        if not row:
            return rpc_error("Journal entry not found", 404)
        entry = dict(row)
        items = rows_to_dicts(
            conn.execute(
                "SELECT * FROM journal_entry_items WHERE journal_entry_id = ? ORDER BY transaction_date DESC",
                (entry_id,),
            ).fetchall()
        )
    return rpc_response(serialize_journal_entry_row(entry, items))


@app.post("/orpc/accountant/journalEntries/update")
@require_auth({"accountant"})
def orpc_update_entry(user):
    payload = rpc_payload()
    entry_id = payload.get("id")
    with connect() as conn:
        existing = conn.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,)).fetchone()
        if not existing:
            return rpc_error("Journal entry not found", 404)
        if existing["created_by"] != user["id"]:
            return rpc_error("Forbidden", 403)
        update_parts = []
        update_params: list[Any] = []
        if "notes" in payload:
            update_parts.append("notes = ?")
            update_params.append(payload.get("notes"))
        if "driverId" in payload:
            update_parts.append("driver_id = ?")
            update_params.append(payload.get("driverId"))
        if update_parts:
            conn.execute(
                f"UPDATE journal_entries SET {', '.join(update_parts)}, updated_at = ? WHERE id = ?",
                (*update_params, now_iso(), entry_id),
            )
        if isinstance(payload.get("items"), list) and payload["items"]:
            conn.execute("DELETE FROM journal_entry_items WHERE journal_entry_id = ?", (entry_id,))
            for item in payload["items"]:
                conn.execute(
                    "INSERT INTO journal_entry_items (id,journal_entry_id,vehicle_id,transaction_date,type,amount,voucher_id,handler,next_renewal_date,expense_category_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (
                        str(uuid.uuid4()),
                        entry_id,
                        existing["vehicle_id"],
                        item["transactionDate"],
                        item["type"],
                        float(item["amount"]),
                        next_voucher_id(conn) if item["type"] == "debit" else None,
                        item.get("handler"),
                        item.get("nextRenewalDate"),
                        item.get("expenseCategoryId"),
                    ),
                )
        updated_driver_id = payload.get("driverId", existing["driver_id"])
        refresh_driver_total_expense(conn, existing["driver_id"])
        refresh_driver_total_expense(conn, updated_driver_id)
        refresh_vehicle_total_expense(conn, existing["vehicle_id"])
        conn.commit()
        row = conn.execute(
            """
                SELECT
                    j.*,
                    v.name AS vehicle_name,
                    v.license_plate AS vehicle_license_plate,
                    d.name AS driver_name,
                    d.phone_number AS driver_phone_number,
                    u.name AS created_by_name,
                    u.image AS created_by_image
                FROM journal_entries j
                LEFT JOIN vehicles v ON v.id = j.vehicle_id
                LEFT JOIN drivers d ON d.id = j.driver_id
                LEFT JOIN users u ON u.id = j.created_by
                WHERE j.id = ?
            """,
            (entry_id,),
        ).fetchone()
        entry = dict(row)
        items = rows_to_dicts(
            conn.execute(
                "SELECT * FROM journal_entry_items WHERE journal_entry_id = ? ORDER BY transaction_date DESC",
                (entry_id,),
            ).fetchall()
        )
    return rpc_response(serialize_journal_entry_row(entry, items))


@app.post("/orpc/accountant/journalEntries/delete")
@require_auth({"accountant"})
def orpc_delete_entry(user):
    payload = rpc_payload()
    entry_id = payload.get("id")
    with connect() as conn:
        existing = conn.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,)).fetchone()
        if not existing:
            return rpc_error("Journal entry not found", 404)
        if existing["created_by"] != user["id"]:
            return rpc_error("Forbidden", 403)
        conn.execute("DELETE FROM journal_entries WHERE id = ?", (entry_id,))
        refresh_driver_total_expense(conn, existing["driver_id"])
        refresh_vehicle_total_expense(conn, existing["vehicle_id"])
        conn.commit()
    return rpc_response({"success": True})



@app.get("/api/vehicles")
@require_auth({"accountant"})
def list_vehicles(user):
    offset = int(request.args.get("offset", 0))
    limit = min(int(request.args.get("limit", 20)), 100)
    with connect() as conn:
        rows = rows_to_dicts(conn.execute("SELECT * FROM vehicles ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)).fetchall())
        total = conn.execute("SELECT COUNT(*) AS c FROM vehicles").fetchone()["c"]
    return jsonify(with_meta(rows, offset, limit, total))


@app.post("/api/vehicles")
@require_auth({"accountant"})
def create_vehicle(user):
    payload = request.get_json(force=True)
    with connect() as conn:
        color = random_color()
        vid = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO vehicles (
                id,name,license_plate,model,year,renewal_date,load_capacity,
                investment_mode,total_price,monthly_emi,emi_start_date,emi_duration_months,down_payment,
                total_revenue,color,created_by
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                vid,
                payload["name"],
                payload["licensePlate"],
                payload["model"],
                payload["year"],
                payload["renewalDate"],
                payload["loadCapacity"],
                payload["investmentMode"],
                payload.get("totalPrice"),
                payload.get("monthlyEmi"),
                payload.get("emiStartDate"),
                payload.get("emiDurationMonths"),
                payload.get("downPayment"),
                0,
                color,
                user["id"],
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM vehicles WHERE id = ?", (vid,)).fetchone()
    return jsonify(dict(row))


@app.get("/api/vehicles/<vehicle_id>")
@require_auth({"accountant"})
def get_vehicle(user, vehicle_id):
    with connect() as conn:
        row = conn.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
    if not row:
        return jsonify({"error": "Vehicle not found"}), 404
    return jsonify(dict(row))


@app.put("/api/vehicles/<vehicle_id>")
@require_auth({"accountant"})
def update_vehicle(user, vehicle_id):
    payload = request.get_json(force=True)
    updates = []
    params: list[Any] = []
    for field, db_col in (
        ("name", "name"),
        ("licensePlate", "license_plate"),
        ("model", "model"),
        ("year", "year"),
        ("renewalDate", "renewal_date"),
        ("loadCapacity", "load_capacity"),
        ("investmentMode", "investment_mode"),
        ("totalPrice", "total_price"),
        ("monthlyEmi", "monthly_emi"),
        ("emiStartDate", "emi_start_date"),
        ("emiDurationMonths", "emi_duration_months"),
        ("downPayment", "down_payment"),
        ("totalRevenue", "total_revenue"),
    ):
        if payload.get(field) is not None:
            updates.append(f"{db_col} = ?")
            params.append(payload[field])
    if not updates:
        return jsonify({"error": "No fields to update"}), 400
    params.extend([now_iso(), vehicle_id])
    with connect() as conn:
        exists = conn.execute("SELECT id FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
        if not exists:
            return jsonify({"error": "Vehicle not found"}), 404
        conn.execute(f"UPDATE vehicles SET {', '.join(updates)}, updated_at = ? WHERE id = ?", tuple(params))
        conn.commit()
        row = conn.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
    return jsonify(dict(row))


@app.delete("/api/vehicles/<vehicle_id>")
@require_auth({"accountant"})
def delete_vehicle(user, vehicle_id):
    with connect() as conn:
        row = conn.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
        if not row:
            return jsonify({"error": "Vehicle not found"}), 404
        conn.execute("DELETE FROM vehicles WHERE id = ?", (vehicle_id,))
        conn.commit()
    return jsonify(dict(row))


@app.get("/api/expense-categories")
@require_auth({"accountant"})
def list_categories(user):
    offset = int(request.args.get("offset", 0))
    limit = min(int(request.args.get("limit", 20)), 100)
    with connect() as conn:
        rows = rows_to_dicts(conn.execute("SELECT * FROM expense_category ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)).fetchall())
        total = conn.execute("SELECT COUNT(*) AS c FROM expense_category").fetchone()["c"]
    return jsonify(with_meta(rows, offset, limit, total))


@app.post("/api/expense-categories")
@require_auth({"accountant"})
def create_category(user):
    payload = request.get_json(force=True)
    impacts = parse_impacts(payload.get("impact"))
    with connect() as conn:
        cid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO expense_category (id,name,color,impact,created_by) VALUES (?,?,?,?,?)",
            (cid, payload["name"], random_color(), format_impacts(impacts), user["id"]),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM expense_category WHERE id = ?", (cid,)).fetchone()
    return jsonify(dict(row))


@app.get("/api/expense-categories/<category_id>")
@require_auth({"accountant"})
def get_category(user, category_id):
    with connect() as conn:
        row = conn.execute("SELECT * FROM expense_category WHERE id = ?", (category_id,)).fetchone()
    if not row:
        return jsonify({"error": "Category not found"}), 404
    return jsonify(dict(row))


@app.put("/api/expense-categories/<category_id>")
@require_auth({"accountant"})
def update_category(user, category_id):
    payload = request.get_json(force=True)
    if payload.get("name") is None and payload.get("impact") is None:
        return jsonify({"error": "No fields to update"}), 400
    updates = []
    params: list[Any] = []
    if payload.get("name") is not None:
        updates.append("name = ?")
        params.append(payload["name"])
    if payload.get("impact") is not None:
        updates.append("impact = ?")
        params.append(format_impacts(payload.get("impact")))
    with connect() as conn:
        exists = conn.execute("SELECT id FROM expense_category WHERE id = ?", (category_id,)).fetchone()
        if not exists:
            return jsonify({"error": "Category not found"}), 404
        params.extend([now_iso(), category_id])
        conn.execute(
            f"UPDATE expense_category SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            tuple(params),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM expense_category WHERE id = ?", (category_id,)).fetchone()
    return jsonify(dict(row))


@app.delete("/api/expense-categories/<category_id>")
@require_auth({"accountant"})
def delete_category(user, category_id):
    with connect() as conn:
        row = conn.execute("SELECT * FROM expense_category WHERE id = ?", (category_id,)).fetchone()
        if not row:
            return jsonify({"error": "Category not found"}), 404
        conn.execute("DELETE FROM expense_category WHERE id = ?", (category_id,))
        conn.commit()
    return jsonify(dict(row))


@app.get("/api/journal-entries")
@require_auth({"accountant"})
def list_entries(user):
    offset = int(request.args.get("offset", 0))
    limit = min(int(request.args.get("limit", 20)), 100)
    with connect() as conn:
        entries = rows_to_dicts(conn.execute("SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)).fetchall())
        for entry in entries:
            entry["items"] = rows_to_dicts(conn.execute("SELECT * FROM journal_entry_items WHERE journal_entry_id = ? ORDER BY transaction_date DESC", (entry["id"],)).fetchall())
        total = conn.execute("SELECT COUNT(*) AS c FROM journal_entries").fetchone()["c"]
    return jsonify(with_meta(entries, offset, limit, total))


@app.post("/api/journal-entries")
@require_auth({"accountant"})
def create_entry(user):
    payload = request.get_json(force=True)
    with connect() as conn:
        eid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO journal_entries (id,vehicle_id,notes,created_by) VALUES (?,?,?,?)",
            (eid, payload["vehicleId"], payload.get("notes"), user["id"]),
        )
        for item in payload.get("items", []):
            conn.execute(
                "INSERT INTO journal_entry_items (id,journal_entry_id,vehicle_id,transaction_date,type,amount,voucher_id,handler,next_renewal_date,expense_category_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    str(uuid.uuid4()),
                    eid,
                    payload["vehicleId"],
                    item["transactionDate"],
                    item["type"],
                    float(item["amount"]),
                    next_voucher_id(conn) if item["type"] == "debit" else None,
                    item.get("handler"),
                    item.get("nextRenewalDate"),
                    item.get("expenseCategoryId"),
                ),
            )
        conn.commit()
        entry = dict(conn.execute("SELECT * FROM journal_entries WHERE id = ?", (eid,)).fetchone())
        entry["items"] = rows_to_dicts(conn.execute("SELECT * FROM journal_entry_items WHERE journal_entry_id = ?", (eid,)).fetchall())
    return jsonify(entry)


@app.get("/api/journal-entries/<entry_id>")
@require_auth({"accountant"})
def get_entry(user, entry_id):
    with connect() as conn:
        row = conn.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,)).fetchone()
        if not row:
            return jsonify({"error": "Journal entry not found"}), 404
        entry = dict(row)
        entry["items"] = rows_to_dicts(
            conn.execute(
                "SELECT * FROM journal_entry_items WHERE journal_entry_id = ? ORDER BY transaction_date DESC",
                (entry_id,),
            ).fetchall()
        )
    return jsonify(entry)


@app.put("/api/journal-entries/<entry_id>")
@require_auth({"accountant"})
def update_entry(user, entry_id):
    payload = request.get_json(force=True)
    with connect() as conn:
        existing = conn.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,)).fetchone()
        if not existing:
            return jsonify({"error": "Journal entry not found"}), 404
        if existing["created_by"] != user["id"]:
            return jsonify({"error": "Forbidden"}), 403
        if "notes" in payload:
            conn.execute(
                "UPDATE journal_entries SET notes = ?, updated_at = ? WHERE id = ?",
                (payload.get("notes"), now_iso(), entry_id),
            )
        if isinstance(payload.get("items"), list) and payload["items"]:
            conn.execute("DELETE FROM journal_entry_items WHERE journal_entry_id = ?", (entry_id,))
            for item in payload["items"]:
                conn.execute(
                    "INSERT INTO journal_entry_items (id,journal_entry_id,vehicle_id,transaction_date,type,amount,voucher_id,handler,next_renewal_date,expense_category_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (
                        str(uuid.uuid4()),
                        entry_id,
                        existing["vehicle_id"],
                        item["transactionDate"],
                        item["type"],
                        float(item["amount"]),
                        next_voucher_id(conn) if item["type"] == "debit" else None,
                        item.get("handler"),
                        item.get("nextRenewalDate"),
                        item.get("expenseCategoryId"),
                    ),
                )
        conn.commit()
        row = conn.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,)).fetchone()
        entry = dict(row)
        entry["items"] = rows_to_dicts(
            conn.execute(
                "SELECT * FROM journal_entry_items WHERE journal_entry_id = ? ORDER BY transaction_date DESC",
                (entry_id,),
            ).fetchall()
        )
    return jsonify(entry)


@app.delete("/api/journal-entries/<entry_id>")
@require_auth({"accountant"})
def delete_entry(user, entry_id):
    with connect() as conn:
        existing = conn.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,)).fetchone()
        if not existing:
            return jsonify({"error": "Journal entry not found"}), 404
        if existing["created_by"] != user["id"]:
            return jsonify({"error": "Forbidden"}), 403
        conn.execute("DELETE FROM journal_entries WHERE id = ?", (entry_id,))
        conn.commit()
    return jsonify({"success": True})
