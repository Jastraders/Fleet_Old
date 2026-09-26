import uuid
from typing import Any

from flask import jsonify, request

from database import connect, rows_to_dicts
from fleet_backend.common import (
    format_impacts,
    now_iso,
    parse_impacts,
    period_date_bounds,
    random_color,
    require_auth,
    serialize_driver_row,
    rpc_error,
    rpc_payload,
    rpc_response,
    serialize_expense_category_row,
    serialize_journal_entry_row,
    serialize_vehicle_row,
    to_iso_datetime,
    with_meta,
)
from fleet_backend.routes.notifications import sync_renewal_notifications
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
                AND (',' || c.impact || ',') LIKE '%,driver,%'
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
                AND (',' || c.impact || ',') LIKE '%,vehicle,%'
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
        "investmentMode": "v.investment_mode",
        "investmentAmount": """
            CASE
                WHEN v.investment_mode = 'full_amount' THEN COALESCE(v.total_price, 0)
                WHEN v.investment_mode = 'full_loan' THEN COALESCE(v.monthly_emi, 0) * (
                    CASE
                        WHEN v.emi_start_date IS NULL OR v.emi_duration_months IS NULL OR v.emi_duration_months <= 0 THEN 0
                                ELSE LEAST(
                            v.emi_duration_months,
                            GREATEST(
                                0,
                                ((CAST(EXTRACT(YEAR FROM now()) AS INTEGER) - CAST(EXTRACT(YEAR FROM v.emi_start_date::timestamp) AS INTEGER)) * 12)
                                + (CAST(EXTRACT(MONTH FROM now()) AS INTEGER) - CAST(EXTRACT(MONTH FROM v.emi_start_date::timestamp) AS INTEGER))
                                + CASE
                                    WHEN CAST(EXTRACT(DAY FROM now()) AS INTEGER) >= CAST(EXTRACT(DAY FROM v.emi_start_date::timestamp) AS INTEGER)
                                        THEN 1
                                    ELSE 0
                                END
                            )
                        )
                    END
                )
                WHEN v.investment_mode = 'flexible' THEN COALESCE(v.down_payment, 0) + (COALESCE(v.monthly_emi, 0) * (
                    CASE
                        WHEN v.emi_start_date IS NULL OR v.emi_duration_months IS NULL OR v.emi_duration_months <= 0 THEN 0
                                ELSE LEAST(
                            v.emi_duration_months,
                            GREATEST(
                                0,
                                ((CAST(EXTRACT(YEAR FROM now()) AS INTEGER) - CAST(EXTRACT(YEAR FROM v.emi_start_date::timestamp) AS INTEGER)) * 12)
                                + (CAST(EXTRACT(MONTH FROM now()) AS INTEGER) - CAST(EXTRACT(MONTH FROM v.emi_start_date::timestamp) AS INTEGER))
                                + CASE
                                    WHEN CAST(EXTRACT(DAY FROM now()) AS INTEGER) >= CAST(EXTRACT(DAY FROM v.emi_start_date::timestamp) AS INTEGER)
                                        THEN 1
                                    ELSE 0
                                END
                            )
                        )
                    END
                ))
                ELSE 0
            END
        """,
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
                id,name,license_plate,model,year,load_capacity,
                investment_mode,total_price,monthly_emi,emi_start_date,emi_duration_months,down_payment,
                total_revenue,color,created_by
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                vid,
                payload["name"],
                payload["licensePlate"],
                payload["model"],
                payload["year"],
                payload.get("loadCapacity", 0),
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
        duplicate = conn.execute(
            "SELECT id FROM expense_category WHERE LOWER(name) = LOWER(?)",
            (payload["name"],),
        ).fetchone()
        if duplicate:
            return rpc_error("Expense category already exists", 409)
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
        with connect() as conn:
            duplicate = conn.execute(
                "SELECT id FROM expense_category WHERE LOWER(name) = LOWER(?) AND id != ?",
                (payload["name"], category_id),
            ).fetchone()
        if duplicate:
            return rpc_error("Expense category already exists", 409)
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
    period = payload.get("period", "all_time")
    start_date_str = payload.get("startDate")
    end_date_str = payload.get("endDate")
    sort_by = payload.get("sortBy", "createdAt")
    sort_order = str(payload.get("sortOrder", "desc")).lower()

    where_clauses: list[str] = []
    where_params: list[Any] = []

    current_start, current_end, _, _ = period_date_bounds(period, start_date_str, end_date_str)
    if current_start:
        where_clauses.append("SUBSTR(COALESCE(t.transaction_date, j.created_at), 1, 10) >= ?")
        where_params.append(current_start)
    if current_end:
        where_clauses.append("SUBSTR(COALESCE(t.transaction_date, j.created_at), 1, 10) <= ?")
        where_params.append(current_end)

    if search:
        search_term = f"%{search}%"
        where_clauses.append("(j.id::text = ? OR v.name ILIKE ? OR v.license_plate ILIKE ? OR COALESCE(u.name, '') ILIKE ?)") 
        where_params.extend([search, search_term, search_term, search_term])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    sort_map = {
        "vehicleName": "LOWER(COALESCE(v.name, ''))",
        "revenue": "COALESCE(t.revenue, 0)",
        "expenses": "COALESCE(t.expenses, 0)",
        "transactionDate": "COALESCE(t.transaction_date, j.created_at)",
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
                        COALESCE(t.revenue, 0) - COALESCE(t.expenses, 0) AS amount,
                        t.transaction_date AS transaction_date
                    FROM journal_entries j
                    LEFT JOIN vehicles v ON v.id = j.vehicle_id
                    LEFT JOIN drivers d ON d.id = j.driver_id
                    LEFT JOIN users u ON u.id = j.created_by
                    LEFT JOIN (
                        SELECT
                            journal_entry_id,
                            SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) AS revenue,
                            SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) AS expenses,
                            MAX(CASE WHEN type = 'credit' THEN transaction_date ELSE NULL END) AS transaction_date
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
        total_row = conn.execute(
            f"""
                SELECT
                    COUNT(*) AS c,
                    COALESCE(SUM(COALESCE(t.revenue, 0) - COALESCE(t.expenses, 0)), 0) AS s
                FROM journal_entries j
                LEFT JOIN vehicles v ON v.id = j.vehicle_id
                LEFT JOIN drivers d ON d.id = j.driver_id
                LEFT JOIN users u ON u.id = j.created_by
                LEFT JOIN (
                    SELECT
                        journal_entry_id,
                        SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) AS revenue,
                        SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) AS expenses,
                        MAX(CASE WHEN type = 'credit' THEN transaction_date ELSE NULL END) AS transaction_date
                    FROM journal_entry_items
                    GROUP BY journal_entry_id
                ) t ON t.journal_entry_id = j.id
                {where_sql}
            """,
            tuple(where_params),
        ).fetchone()
        total_count = total_row["c"]
        total_amount = float(total_row["s"] or 0)
    return rpc_response(with_meta(serialized_entries, offset, limit, total_count, totalAmount=total_amount))


@app.post("/orpc/accountant/expenses/list")
@require_auth({"accountant"})
def orpc_list_expenses(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 20)), 100)
    search = payload.get("search")
    sort_by = payload.get("sortBy", "createdAt")
    sort_order = str(payload.get("sortOrder", "desc")).lower()
    period = payload.get("period", "all_time")
    start_date_str = payload.get("startDate")
    end_date_str = payload.get("endDate")

    where_clauses = ["i.type = 'debit'"]
    where_params: list[Any] = []

    current_start, current_end, _, _ = period_date_bounds(period, start_date_str, end_date_str)
    if current_start:
        where_clauses.append("SUBSTR(i.transaction_date, 1, 10) >= ?")
        where_params.append(current_start)
    if current_end:
        where_clauses.append("SUBSTR(i.transaction_date, 1, 10) <= ?")
        where_params.append(current_end)

    driver_id = payload.get("driverId")
    if driver_id:
        where_clauses.append("j.driver_id = ?")
        where_params.append(driver_id)

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
                        i.transaction_date AS expense_date,
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
        for row in rows:
            raw_tx = row.get("expense_date") or row.get("transaction_date") or row.get("created_at") or row.get("entry_created_at")
            iso_tx = to_iso_datetime(raw_tx)
            row["expense_date"] = iso_tx
            row["expenseDate"] = iso_tx
            row["transaction_date"] = iso_tx
            row["transactionDate"] = iso_tx
            row["created_at"] = to_iso_datetime(row.get("created_at") or row.get("entry_created_at"))
            row["createdAt"] = row["created_at"]
        total_count = conn.execute(
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

        total_amount = conn.execute(
            f"""
                SELECT COALESCE(SUM(i.amount), 0) AS s
                FROM journal_entry_items i
                LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
                LEFT JOIN expense_category c ON c.id = i.expense_category_id
                LEFT JOIN vehicles v ON v.id = i.vehicle_id
                LEFT JOIN drivers d ON d.id = j.driver_id
                {where_sql}
            """,
            tuple(where_params),
        ).fetchone()["s"]

    meta = {
        "offset": offset,
        "limit": limit,
        "total": total_count,
        "totalAmount": float(total_amount or 0),
    }

    return rpc_response({"data": rows, "meta": meta})


def get_or_create_bata_expense_category(conn, user_id: str | None = None) -> str:
    row = conn.execute("SELECT id FROM expense_category WHERE LOWER(name) = 'driver bata' LIMIT 1").fetchone()
    if row:
        return row["id"]
    cat_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO expense_category (id, name, color, impact, created_by) VALUES (?, ?, ?, ?, ?)",
        (cat_id, "Driver Bata", "f59e0b", "driver,vehicle,company", user_id),
    )
    return cat_id


def _validate_journal_entry_items(items: list) -> str | None:
    credit_items = [i for i in items if isinstance(i, dict) and i.get("type") == "credit"]
    if len(credit_items) != 1:
        return "Journal entry must contain exactly one revenue/credit item."

    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "credit":
            revenue_mode = item.get("revenueMode", "direct")
            quantity = item.get("quantity")
            per_item_rate = item.get("perItemRate")
            bata_percentage = item.get("bataPercentage")
            bata_type = item.get("bataType", "percentage")
            fixed_bata_amount = item.get("fixedBataAmount")
            amount_val = float(item.get("amount") or 0.0)

            try:
                if revenue_mode == "calculated":
                    qty_val = float(quantity) if quantity is not None and quantity != "" else 0.0
                    rate_val = float(per_item_rate) if per_item_rate is not None and per_item_rate != "" else 0.0

                    if qty_val < 0 or rate_val < 0:
                        return "Quantity and Per Item Rate cannot be negative."

                    gross_revenue = qty_val * rate_val
                else:
                    if amount_val < 0:
                        return "Revenue amount cannot be negative."
                    gross_revenue = amount_val

                if bata_type == "fixed":
                    fixed_val = float(fixed_bata_amount) if fixed_bata_amount is not None and fixed_bata_amount != "" else 0.0
                    if fixed_val < 0:
                        return "Fixed Bata Amount cannot be negative."
                    if fixed_val > gross_revenue:
                        return "Fixed Bata Amount cannot be greater than Gross Revenue."
                else:
                    bata_val = float(bata_percentage) if bata_percentage is not None and bata_percentage != "" else 0.0
                    if bata_val < 0:
                        return "Bata Percentage cannot be negative."
            except (ValueError, TypeError):
                return "Invalid numeric value provided in journal entry item."
    return None


@app.post("/orpc/accountant/journalEntries/create")
@require_auth({"accountant"})
def orpc_create_entry(user):
    payload = rpc_payload()
    source_notification_id = payload.get("sourceNotificationId")
    items = payload.get("items", [])

    validation_err = _validate_journal_entry_items(items)
    if validation_err:
        return rpc_error(validation_err, 400)

    with connect() as conn:
        try:
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
            credit_bata_val = 0.0
            credit_product_name = None
            credit_tx_date = None
            for item in items:
                item_id = str(uuid.uuid4())
                
                # Read calculation values from the payload item
                revenue_mode = item.get("revenueMode", "direct")
                quantity = item.get("quantity")
                per_item_rate = item.get("perItemRate")
                bata_percentage = item.get("bataPercentage")
                bata_type = item.get("bataType", "percentage")
                fixed_bata_amount = item.get("fixedBataAmount")
                product_name = item.get("productName")
                
                value = None
                bata_value = None
                amount = float(item["amount"])
                
                # Recalculate on the backend if mode is calculated
                if item["type"] == "credit":
                    credit_tx_date = item.get("transactionDate")
                    if product_name:
                        credit_product_name = product_name
                    if revenue_mode == "calculated":
                        qty_val = float(quantity) if quantity is not None and quantity != "" else 0.0
                        rate_val = float(per_item_rate) if per_item_rate is not None and per_item_rate != "" else 0.0
                        
                        if qty_val < 0 or rate_val < 0:
                            conn.rollback()
                            return rpc_error("Quantity and Per Item Rate cannot be negative.", 400)
                        
                        value = qty_val * rate_val
                        
                        if bata_type == "fixed":
                            fixed_val = float(fixed_bata_amount) if fixed_bata_amount is not None and fixed_bata_amount != "" else 0.0
                            if fixed_val < 0:
                                conn.rollback()
                                return rpc_error("Fixed Bata Amount cannot be negative.", 400)
                            if fixed_val > value:
                                conn.rollback()
                                return rpc_error("Fixed Bata Amount cannot be greater than Calculated Value.", 400)
                            bata_value = fixed_val
                        else:
                            bata_val = float(bata_percentage) if bata_percentage is not None and bata_percentage != "" else 0.0
                            if bata_val < 0:
                                conn.rollback()
                                return rpc_error("Bata Percentage cannot be negative.", 400)
                            bata_value = (value * bata_val) / 100.0
                        
                        amount = value  # Gross Revenue = Calculated Value (Quantity * Rate)
                        credit_bata_val = float(bata_value or 0.0)
                    else:
                        if bata_type == "fixed":
                            fixed_val = float(fixed_bata_amount) if fixed_bata_amount is not None and fixed_bata_amount != "" else 0.0
                            bata_value = fixed_val
                        elif bata_percentage:
                            bata_val = float(bata_percentage) if bata_percentage is not None and bata_percentage != "" else 0.0
                            bata_value = (amount * bata_val) / 100.0
                        if bata_value:
                            credit_bata_val = float(bata_value)

                conn.execute(
                    """
                    INSERT INTO journal_entry_items (
                        id, journal_entry_id, vehicle_id, transaction_date, type, amount, 
                        voucher_id, handler, next_renewal_date, expense_category_id,
                        revenue_mode, quantity, per_item_rate, value, bata_percentage, bata_value,
                        depo, delivery_location, product_name, bata_type, fixed_bata_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item_id,
                        eid,
                        payload["vehicleId"],
                        item["transactionDate"],
                        item["type"],
                        amount,
                        next_voucher_id(conn) if item["type"] == "debit" else None,
                        item.get("handler") or "Driver",
                        item.get("nextRenewalDate"),
                        item.get("expenseCategoryId"),
                        revenue_mode,
                        quantity,
                        per_item_rate,
                        value,
                        bata_percentage,
                        bata_value,
                        item.get("depo"),
                        item.get("deliveryLocation") or item.get("delivery_location"),
                        product_name,
                        bata_type,
                        fixed_bata_amount,
                    ),
                )

                
                if item["type"] == "debit" and item.get("expenseCategoryId"):
                    stale_rows = rows_to_dicts(
                        conn.execute(
                            """
                            SELECT n.id
                            FROM notifications n
                            JOIN journal_entry_items ji ON ji.id = n.resource_id
                            WHERE n.type = 'renewal_reminder'
                              AND ji.vehicle_id = ?
                              AND ji.expense_category_id = ?
                              AND ji.id != ?
                            """,
                            (payload["vehicleId"], item.get("expenseCategoryId"), item_id),
                        ).fetchall()
                    )
                    for stale in stale_rows:
                        conn.execute("DELETE FROM notifications WHERE id = ?", (stale["id"],))

            # Create corresponding 1:1 Bata record for this journal entry
            bata_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO bata (
                    id, journal_entry_id, driver_id, vehicle_id, product_name,
                    bata_amount, status, created_by, bata_date
                ) VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?)
                """,
                (
                    bata_id,
                    eid,
                    payload.get("driverId") or "",
                    payload["vehicleId"],
                    credit_product_name,
                    credit_bata_val,
                    user["id"],
                    credit_tx_date,
                ),
            )

            refresh_driver_total_expense(conn, payload.get("driverId"))
            refresh_vehicle_total_expense(conn, payload["vehicleId"])
            if source_notification_id:
                conn.execute("DELETE FROM notifications WHERE id = ?", (source_notification_id,))
            sync_renewal_notifications(conn)
            conn.commit()
            entry = dict(conn.execute("SELECT * FROM journal_entries WHERE id = ?", (eid,)).fetchone())
            items_res = rows_to_dicts(conn.execute("SELECT * FROM journal_entry_items WHERE journal_entry_id = ?", (eid,)).fetchall())
        except Exception:
            conn.rollback()
            raise
    return rpc_response(serialize_journal_entry_row(entry, items_res))




def _has_entry_access(conn, user, entry, action):
    if entry["created_by"] == user["id"]:
        return True
    role_row = conn.execute(
        "SELECT 1 FROM user_roles WHERE user_id = ? AND role IN ('admin','owner') LIMIT 1",
        (user["id"],),
    ).fetchone()
    if role_row:
        return True
    grant_row = conn.execute(
        """
        SELECT 1 FROM access_grants
        WHERE user_id = ? AND page_name = 'Expenses' AND resource_type = 'journal_entry' AND resource_id = ? AND action = ?
        LIMIT 1
        """,
        (user["id"], entry["id"], action),
    ).fetchone()
    return bool(grant_row)
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
    items = payload.get("items")
    if isinstance(items, list) and items:
        validation_err = _validate_journal_entry_items(items)
        if validation_err:
            return rpc_error(validation_err, 400)

    with connect() as conn:
        try:
            existing = conn.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,)).fetchone()
            if not existing:
                conn.rollback()
                return rpc_error("Journal entry not found", 404)
            if not _has_entry_access(conn, user, existing, "edit"):
                conn.rollback()
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

            bata_row = conn.execute("SELECT * FROM bata WHERE journal_entry_id = ?", (entry_id,)).fetchone()
            linked_expense_item_id = bata_row["linked_expense_item_id"] if bata_row else None

            if isinstance(items, list) and items:
                if linked_expense_item_id:
                    conn.execute("DELETE FROM journal_entry_items WHERE journal_entry_id = ? AND id != ?", (entry_id, linked_expense_item_id))
                else:
                    conn.execute("DELETE FROM journal_entry_items WHERE journal_entry_id = ?", (entry_id,))

                credit_bata_val = 0.0
                credit_product_name = None
                credit_tx_date = None
                for item in items:
                    item_id = str(uuid.uuid4())
                    
                    # Read calculation values from the payload item
                    revenue_mode = item.get("revenueMode", "direct")
                    quantity = item.get("quantity")
                    per_item_rate = item.get("perItemRate")
                    bata_percentage = item.get("bataPercentage")
                    bata_type = item.get("bataType", "percentage")
                    fixed_bata_amount = item.get("fixedBataAmount")
                    product_name = item.get("productName")
                    
                    value = None
                    bata_value = None
                    amount = float(item["amount"])
                    
                    # Recalculate on the backend if mode is calculated
                    if item["type"] == "credit":
                        credit_tx_date = item.get("transactionDate")
                        if product_name:
                            credit_product_name = product_name
                        if revenue_mode == "calculated":
                            qty_val = float(quantity) if quantity is not None and quantity != "" else 0.0
                            rate_val = float(per_item_rate) if per_item_rate is not None and per_item_rate != "" else 0.0
                            
                            if qty_val < 0 or rate_val < 0:
                                conn.rollback()
                                return rpc_error("Quantity and Per Item Rate cannot be negative.", 400)
                            
                            value = qty_val * rate_val
                            
                            if bata_type == "fixed":
                                fixed_val = float(fixed_bata_amount) if fixed_bata_amount is not None and fixed_bata_amount != "" else 0.0
                                if fixed_val < 0:
                                    conn.rollback()
                                    return rpc_error("Fixed Bata Amount cannot be negative.", 400)
                                if fixed_val > value:
                                    conn.rollback()
                                    return rpc_error("Fixed Bata Amount cannot be greater than Calculated Value.", 400)
                                bata_value = fixed_val
                            else:
                                bata_val = float(bata_percentage) if bata_percentage is not None and bata_percentage != "" else 0.0
                                if bata_val < 0:
                                    conn.rollback()
                                    return rpc_error("Bata Percentage cannot be negative.", 400)
                                bata_value = (value * bata_val) / 100.0
                            
                            amount = value  # Gross Revenue = Calculated Value
                            credit_bata_val = float(bata_value or 0.0)
                        else:
                            if bata_type == "fixed":
                                fixed_val = float(fixed_bata_amount) if fixed_bata_amount is not None and fixed_bata_amount != "" else 0.0
                                bata_value = fixed_val
                            elif bata_percentage:
                                bata_val = float(bata_percentage) if bata_percentage is not None and bata_percentage != "" else 0.0
                                bata_value = (amount * bata_val) / 100.0
                            if bata_value:
                                credit_bata_val = float(bata_value)
                        
                    conn.execute(
                        """
                        INSERT INTO journal_entry_items (
                            id, journal_entry_id, vehicle_id, transaction_date, type, amount, 
                            voucher_id, handler, next_renewal_date, expense_category_id,
                            revenue_mode, quantity, per_item_rate, value, bata_percentage, bata_value,
                            depo, delivery_location, product_name, bata_type, fixed_bata_amount
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            item_id,
                            entry_id,
                            existing["vehicle_id"],
                            item["transactionDate"],
                            item["type"],
                            amount,
                            next_voucher_id(conn) if item["type"] == "debit" else None,
                            item.get("handler") or "Driver",
                            item.get("nextRenewalDate"),
                            item.get("expenseCategoryId"),
                            revenue_mode,
                            quantity,
                            per_item_rate,
                            value,
                            bata_percentage,
                            bata_value,
                            item.get("depo"),
                            item.get("deliveryLocation") or item.get("delivery_location"),
                            product_name,
                            bata_type,
                            fixed_bata_amount,
                        ),
                    )

                updated_driver_id = payload.get("driverId", existing["driver_id"]) or ""
                if bata_row:
                    conn.execute(
                        """
                        UPDATE bata
                        SET driver_id = ?, vehicle_id = ?, product_name = ?, bata_amount = ?, bata_date = ?, updated_at = ?
                        WHERE journal_entry_id = ?
                        """,
                        (updated_driver_id, existing["vehicle_id"], credit_product_name, credit_bata_val, credit_tx_date, now_iso(), entry_id),
                    )
                    if bata_row["status"] == "paid" and linked_expense_item_id:
                        conn.execute(
                            "UPDATE journal_entry_items SET amount = ?, product_name = ?, transaction_date = ? WHERE id = ?",
                            (credit_bata_val, credit_product_name, credit_tx_date, linked_expense_item_id),
                        )
                else:
                    conn.execute(
                        """
                        INSERT INTO bata (
                            id, journal_entry_id, driver_id, vehicle_id, product_name,
                            bata_amount, status, created_by, bata_date
                        ) VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?)
                        """,
                        (
                            str(uuid.uuid4()),
                            entry_id,
                            updated_driver_id,
                            existing["vehicle_id"],
                            credit_product_name,
                            credit_bata_val,
                            user["id"],
                            credit_tx_date,
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
            items_res = rows_to_dicts(
                conn.execute(
                    "SELECT * FROM journal_entry_items WHERE journal_entry_id = ? ORDER BY transaction_date DESC",
                    (entry_id,),
                ).fetchall()
            )
        except Exception:
            conn.rollback()
            raise
    return rpc_response(serialize_journal_entry_row(entry, items_res))


@app.post("/orpc/accountant/journalEntries/delete")
@require_auth({"accountant"})
def orpc_delete_entry(user):
    payload = rpc_payload()
    entry_id = payload.get("id")
    with connect() as conn:
        try:
            existing = conn.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,)).fetchone()
            if not existing:
                conn.rollback()
                return rpc_error("Journal entry not found", 404)
            if not _has_entry_access(conn, user, existing, "delete"):
                conn.rollback()
                return rpc_error("Forbidden", 403)
            bata_row = conn.execute("SELECT linked_expense_item_id FROM bata WHERE journal_entry_id = ?", (entry_id,)).fetchone()
            if bata_row and bata_row.get("linked_expense_item_id"):
                conn.execute("DELETE FROM journal_entry_items WHERE id = ?", (bata_row["linked_expense_item_id"],))
            conn.execute("DELETE FROM bata WHERE journal_entry_id = ?", (entry_id,))
            conn.execute("DELETE FROM journal_entry_items WHERE journal_entry_id = ?", (entry_id,))
            conn.execute("DELETE FROM journal_entries WHERE id = ?", (entry_id,))
            refresh_driver_total_expense(conn, existing["driver_id"])
            refresh_vehicle_total_expense(conn, existing["vehicle_id"])
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    return rpc_response({"success": True})


@app.post("/orpc/accountant/bata/list")
@require_auth({"accountant"})
def orpc_list_bata(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 20)), 100)
    search = payload.get("search")
    status_filter = payload.get("status", "all")
    period = payload.get("period", "all_time")
    start_date_str = payload.get("startDate")
    end_date_str = payload.get("endDate")
    driver_id = payload.get("driverId")
    vehicle_id = payload.get("vehicleId")
    sort_by = payload.get("sortBy", "transactionDate")
    sort_order = str(payload.get("sortOrder", "desc")).lower()

    where_clauses: list[str] = []
    where_params: list[Any] = []

    if status_filter in ("paid", "unpaid"):
        where_clauses.append("b.status = ?")
        where_params.append(status_filter)

    if driver_id:
        where_clauses.append("b.driver_id = ?")
        where_params.append(driver_id)

    if vehicle_id:
        where_clauses.append("b.vehicle_id = ?")
        where_params.append(vehicle_id)

    current_start, current_end, _, _ = period_date_bounds(period, start_date_str, end_date_str)
    if current_start:
        where_clauses.append("SUBSTR(COALESCE(b.bata_date, t.transaction_date), 1, 10) >= ?")
        where_params.append(current_start)
    if current_end:
        where_clauses.append("SUBSTR(COALESCE(b.bata_date, t.transaction_date), 1, 10) <= ?")
        where_params.append(current_end)

    if search:
        search_term = f"%{search}%"
        where_clauses.append("(COALESCE(d.name, '') ILIKE ? OR COALESCE(v.name, '') ILIKE ? OR COALESCE(v.license_plate, '') ILIKE ? OR COALESCE(b.product_name, '') ILIKE ?)")
        where_params.extend([search_term, search_term, search_term, search_term])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    sort_map = {
        "driverName": "LOWER(COALESCE(d.name, ''))",
        "vehicleName": "LOWER(COALESCE(v.name, ''))",
        "bataAmount": "b.bata_amount",
        "transactionDate": "COALESCE(b.bata_date, t.transaction_date)",
        "createdAt": "b.created_at",
        "status": "b.status",
    }
    order_column = sort_map.get(sort_by, "COALESCE(b.bata_date, t.transaction_date)")
    order_direction = "ASC" if sort_order == "asc" else "DESC"

    with connect() as conn:
        query = f"""
            SELECT
                b.*,
                j.notes AS journal_notes,
                COALESCE(b.bata_date, t.transaction_date) AS transaction_date,
                COALESCE(t.gross_revenue, 0) AS gross_revenue,
                COALESCE(t.quantity, 0) AS quantity,
                COALESCE(t.per_item_rate, 0) AS per_item_rate,
                v.name AS vehicle_name,
                v.license_plate AS vehicle_license_plate,
                d.name AS driver_name,
                d.phone_number AS driver_phone_number,
                u_creator.name AS created_by_name,
                u_creator.image AS created_by_image,
                u_payer.name AS paid_by_name
            FROM bata b
            JOIN journal_entries j ON j.id = b.journal_entry_id
            LEFT JOIN vehicles v ON v.id = b.vehicle_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN users u_creator ON u_creator.id = b.created_by
            LEFT JOIN users u_payer ON u_payer.id = b.paid_by
            LEFT JOIN (
                SELECT
                    journal_entry_id,
                    MAX(CASE WHEN type = 'credit' THEN transaction_date ELSE NULL END) AS transaction_date,
                    SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) AS gross_revenue,
                    MAX(CASE WHEN type = 'credit' THEN quantity ELSE NULL END) AS quantity,
                    MAX(CASE WHEN type = 'credit' THEN per_item_rate ELSE NULL END) AS per_item_rate
                FROM journal_entry_items
                GROUP BY journal_entry_id
            ) t ON t.journal_entry_id = b.journal_entry_id
            {where_sql}
            ORDER BY {order_column} {order_direction}
            LIMIT ? OFFSET ?
        """
        rows = rows_to_dicts(conn.execute(query, (*where_params, limit, offset)).fetchall())

        kpi_row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_count,
                COALESCE(SUM(b.bata_amount), 0) AS total_bata,
                COALESCE(SUM(CASE WHEN b.status = 'paid' THEN b.bata_amount ELSE 0 END), 0) AS paid_bata,
                COALESCE(SUM(CASE WHEN b.status = 'unpaid' THEN b.bata_amount ELSE 0 END), 0) AS unpaid_bata
            FROM bata b
            JOIN journal_entries j ON j.id = b.journal_entry_id
            LEFT JOIN vehicles v ON v.id = b.vehicle_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN (
                SELECT journal_entry_id, MAX(CASE WHEN type = 'credit' THEN transaction_date ELSE NULL END) AS transaction_date
                FROM journal_entry_items
                GROUP BY journal_entry_id
            ) t ON t.journal_entry_id = b.journal_entry_id
            {where_sql}
            """,
            tuple(where_params),
        ).fetchone()

    total_count = kpi_row["total_count"] if kpi_row else 0
    total_bata = float(kpi_row["total_bata"] or 0) if kpi_row else 0.0
    paid_bata = float(kpi_row["paid_bata"] or 0) if kpi_row else 0.0
    unpaid_bata = float(kpi_row["unpaid_bata"] or 0) if kpi_row else 0.0

    return rpc_response(with_meta(rows, offset, limit, total_count, totalBata=total_bata, paidBata=paid_bata, unpaidBata=unpaid_bata))


@app.post("/orpc/accountant/bata/get")
@require_auth({"accountant"})
def orpc_get_bata(user):
    payload = rpc_payload()
    bata_id = payload.get("id")
    with connect() as conn:
        row = conn.execute(
            """
            SELECT
                b.*,
                j.notes AS journal_notes,
                COALESCE(b.bata_date, t.transaction_date) AS transaction_date,
                COALESCE(t.gross_revenue, 0) AS gross_revenue,
                COALESCE(t.quantity, 0) AS quantity,
                COALESCE(t.per_item_rate, 0) AS per_item_rate,
                COALESCE(t.revenue_mode, 'direct') AS revenue_mode,
                v.name AS vehicle_name,
                v.license_plate AS vehicle_license_plate,
                d.name AS driver_name,
                d.phone_number AS driver_phone_number,
                u_creator.name AS created_by_name,
                u_creator.image AS created_by_image,
                u_payer.name AS paid_by_name
            FROM bata b
            JOIN journal_entries j ON j.id = b.journal_entry_id
            LEFT JOIN vehicles v ON v.id = b.vehicle_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN users u_creator ON u_creator.id = b.created_by
            LEFT JOIN users u_payer ON u_payer.id = b.paid_by
            LEFT JOIN (
                SELECT
                    journal_entry_id,
                    MAX(CASE WHEN type = 'credit' THEN transaction_date ELSE NULL END) AS transaction_date,
                    SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) AS gross_revenue,
                    MAX(CASE WHEN type = 'credit' THEN quantity ELSE NULL END) AS quantity,
                    MAX(CASE WHEN type = 'credit' THEN per_item_rate ELSE NULL END) AS per_item_rate,
                    MAX(CASE WHEN type = 'credit' THEN revenue_mode ELSE NULL END) AS revenue_mode
                FROM journal_entry_items
                GROUP BY journal_entry_id
            ) t ON t.journal_entry_id = b.journal_entry_id
            WHERE b.id = ? OR b.journal_entry_id = ?
            """,
            (bata_id, bata_id),
        ).fetchone()

        if not row:
            return rpc_error("Bata record not found", 404)

    return rpc_response(dict(row))


@app.post("/orpc/accountant/bata/markPaid")
@require_auth({"accountant"})
def orpc_mark_bata_paid(user):
    payload = rpc_payload()
    bata_id = payload.get("id")
    paid_at = payload.get("paidAt") or now_iso()
    with connect() as conn:
        try:
            bata = conn.execute("SELECT * FROM bata WHERE id = ?", (bata_id,)).fetchone()
            if not bata:
                conn.rollback()
                return rpc_error("Bata record not found", 404)
            if bata["status"] == "paid":
                return rpc_response(dict(bata))
            
            tx_date = bata.get("bata_date")
            if not tx_date:
                tx_row = conn.execute(
                    "SELECT transaction_date FROM journal_entry_items WHERE journal_entry_id = ? AND type = 'credit' LIMIT 1",
                    (bata["journal_entry_id"],),
                ).fetchone()
                if not tx_row or not tx_row["transaction_date"]:
                    tx_row = conn.execute(
                        "SELECT transaction_date FROM journal_entry_items WHERE journal_entry_id = ? LIMIT 1",
                        (bata["journal_entry_id"],),
                    ).fetchone()
                tx_date = tx_row["transaction_date"] if tx_row and tx_row["transaction_date"] else None

            if not tx_date:
                conn.rollback()
                return rpc_error("Associated Journal Entry transaction date not found", 400)

            cat_id = get_or_create_bata_expense_category(conn, user["id"])
            item_id = str(uuid.uuid4())

            conn.execute(
                """
                INSERT INTO journal_entry_items (
                    id, journal_entry_id, vehicle_id, transaction_date, type, amount,
                    voucher_id, handler, expense_category_id, product_name
                ) VALUES (?, ?, ?, ?, 'debit', ?, ?, 'Driver', ?, ?)
                """,
                (
                    item_id,
                    bata["journal_entry_id"],
                    bata["vehicle_id"],
                    tx_date,
                    float(bata["bata_amount"] or 0.0),
                    next_voucher_id(conn),
                    cat_id,
                    bata["product_name"],
                ),
            )

            conn.execute(
                """
                UPDATE bata
                SET status = 'paid', paid_by = ?, paid_at = ?, linked_expense_item_id = ?, updated_at = ?
                WHERE id = ?
                """,
                (user["id"], paid_at, item_id, now_iso(), bata_id),
            )

            refresh_driver_total_expense(conn, bata["driver_id"])
            refresh_vehicle_total_expense(conn, bata["vehicle_id"])
            conn.commit()

            updated = conn.execute("SELECT * FROM bata WHERE id = ?", (bata_id,)).fetchone()
        except Exception:
            conn.rollback()
            raise
    return rpc_response(dict(updated))


@app.post("/orpc/accountant/bata/unmarkPaid")
@require_auth({"accountant"})
def orpc_unmark_bata_paid(user):
    payload = rpc_payload()
    bata_id = payload.get("id")
    with connect() as conn:
        try:
            bata = conn.execute("SELECT * FROM bata WHERE id = ?", (bata_id,)).fetchone()
            if not bata:
                conn.rollback()
                return rpc_error("Bata record not found", 404)
            if bata["status"] == "unpaid":
                return rpc_response(dict(bata))
            
            is_admin = False
            role_row = conn.execute(
                "SELECT 1 FROM user_roles WHERE user_id = ? AND role IN ('admin','owner') LIMIT 1",
                (user["id"],),
            ).fetchone()
            if role_row:
                is_admin = True
            else:
                grant_row = conn.execute(
                    """
                    SELECT 1 FROM access_grants
                    WHERE user_id = ? AND page_name = 'Bata' AND resource_type = 'bata' AND resource_id = ? AND action = 'edit'
                    LIMIT 1
                    """,
                    (user["id"], bata_id),
                ).fetchone()
                if grant_row:
                    is_admin = True
            
            if not is_admin:
                conn.rollback()
                return rpc_error("Non-admin users cannot directly unmark paid Bata. Please request access from an admin.", 403)

            if bata["linked_expense_item_id"]:
                conn.execute("DELETE FROM journal_entry_items WHERE id = ?", (bata["linked_expense_item_id"],))

            conn.execute(
                """
                UPDATE bata
                SET status = 'unpaid', paid_by = NULL, paid_at = NULL, linked_expense_item_id = NULL, updated_at = ?
                WHERE id = ?
                """,
                (now_iso(), bata_id),
            )

            refresh_driver_total_expense(conn, bata["driver_id"])
            refresh_vehicle_total_expense(conn, bata["vehicle_id"])
            conn.commit()

            updated = conn.execute("SELECT * FROM bata WHERE id = ?", (bata_id,)).fetchone()
        except Exception:
            conn.rollback()
            raise
    return rpc_response(dict(updated))



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
                id,name,license_plate,model,year,renewal,renewal_date,load_capacity,
                investment_mode,total_price,monthly_emi,emi_start_date,emi_duration_months,down_payment,
                total_revenue,color,created_by
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                vid,
                payload["name"],
                payload["licensePlate"],
                payload["model"],
                payload["year"],
                payload.get("renewal"),
                payload["renewalDate"],
                payload.get("loadCapacity", 0),
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
        ("renewal", "renewal"),
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
                    item.get("handler") or "Driver",
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
                        item.get("handler") or "Driver",
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


def serialize_revenue_item_row(row: dict) -> dict:
    created_by_user = None
    if row.get("created_by") or row.get("entry_created_by"):
        created_by_user = {
            "id": row.get("entry_created_by") or row.get("created_by"),
            "name": row.get("created_by_name") or "",
            "image": row.get("created_by_image"),
        }

    vehicle = None
    if row.get("vehicle_id"):
        vehicle = {
            "id": row["vehicle_id"],
            "name": row.get("vehicle_name") or "",
            "licensePlate": row.get("vehicle_license_plate"),
        }

    driver = None
    if row.get("driver_id"):
        driver = {
            "id": row["driver_id"],
            "name": row.get("driver_name") or "",
        }

    raw_tx = row.get("revenue_date") or row.get("transaction_date") or row.get("created_at")
    iso_tx = to_iso_datetime(raw_tx)

    v_id = row.get("voucher_id")
    if v_id is not None and str(v_id).isdigit():
        voucher_number = f"JV-{int(v_id):03d}"
    elif v_id:
        voucher_number = str(v_id)
    else:
        voucher_number = "-"

    return {
        "id": row["id"],
        "journalEntryId": row["journal_entry_id"],
        "voucherId": v_id,
        "voucherNumber": voucher_number,
        "vehicleId": row.get("vehicle_id"),
        "vehicleName": row.get("vehicle_name") or "",
        "vehicleLicensePlate": row.get("vehicle_license_plate") or "",
        "vehicle": vehicle,
        "driverId": row.get("driver_id"),
        "driverName": row.get("driver_name") or "",
        "driver": driver,
        "revenueDate": iso_tx,
        "transactionDate": iso_tx,
        "amount": float(row.get("amount") or 0.0),
        "productName": row.get("product_name") or "",
        "depo": row.get("depo") or "",
        "deliveryLocation": row.get("delivery_location") or "",
        "revenueMode": row.get("revenue_mode") or "direct",
        "quantity": float(row.get("quantity") or 0) if row.get("quantity") is not None else None,
        "perItemRate": float(row.get("per_item_rate") or 0) if row.get("per_item_rate") is not None else None,
        "value": float(row.get("value") or 0) if row.get("value") is not None else None,
        "createdBy": row.get("entry_created_by") or row.get("created_by"),
        "createdByName": row.get("created_by_name") or "",
        "createdByUser": created_by_user,
        "createdAt": to_iso_datetime(row.get("created_at")),
    }


@app.post("/orpc/admin/revenue/list")
@app.post("/api/orpc/admin/revenue/list")
@require_auth({"admin"})
def orpc_list_admin_revenue(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 20)), 100)
    search = payload.get("search")
    sort_by = payload.get("sortBy", "createdAt")
    sort_order = str(payload.get("sortOrder", "desc")).lower()
    period = payload.get("period", "all_time")
    start_date_str = payload.get("startDate")
    end_date_str = payload.get("endDate")

    where_clauses = ["i.type = 'credit'"]
    where_params: list[Any] = []

    current_start, current_end, _, _ = period_date_bounds(period, start_date_str, end_date_str)
    if current_start:
        where_clauses.append("SUBSTR(i.transaction_date, 1, 10) >= ?")
        where_params.append(current_start)
    if current_end:
        where_clauses.append("SUBSTR(i.transaction_date, 1, 10) <= ?")
        where_params.append(current_end)

    if search:
        search_term = f"%{search}%"
        where_clauses.append(
            "(COALESCE(i.product_name, '') LIKE ? OR COALESCE(i.depo, '') LIKE ? OR COALESCE(i.delivery_location, '') LIKE ? OR COALESCE(v.name, '') LIKE ? OR COALESCE(d.name, '') LIKE ? OR CAST(COALESCE(i.voucher_id, 0) AS TEXT) LIKE ?)"
        )
        where_params.extend([search_term, search_term, search_term, search_term, search_term, search_term])

    where_sql = f"WHERE {' AND '.join(where_clauses)}"

    sort_map = {
        "voucherId": "COALESCE(i.voucher_id, 0)",
        "amount": "i.amount",
        "productName": "LOWER(COALESCE(i.product_name, ''))",
        "depo": "LOWER(COALESCE(i.depo, ''))",
        "deliveryLocation": "LOWER(COALESCE(i.delivery_location, ''))",
        "vehicle": "LOWER(COALESCE(v.name, ''))",
        "driver": "LOWER(COALESCE(d.name, ''))",
        "createdBy": "LOWER(COALESCE(u.name, ''))",
        "createdAt": "i.created_at",
        "revenueDate": "i.transaction_date",
    }
    order_column = sort_map.get(sort_by, "i.created_at")
    order_direction = "ASC" if sort_order == "asc" else "DESC"

    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                f"""
                    SELECT
                        i.*,
                        i.transaction_date AS revenue_date,
                        j.driver_id,
                        j.created_by AS entry_created_by,
                        j.created_at AS entry_created_at,
                        v.name AS vehicle_name,
                        v.license_plate AS vehicle_license_plate,
                        d.name AS driver_name,
                        u.name AS created_by_name,
                        u.image AS created_by_image
                    FROM journal_entry_items i
                    LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
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
        total_row = conn.execute(
            f"""
                SELECT
                    COUNT(*) AS c,
                    COALESCE(SUM(i.amount), 0) AS s
                FROM journal_entry_items i
                LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
                LEFT JOIN vehicles v ON v.id = i.vehicle_id
                LEFT JOIN drivers d ON d.id = j.driver_id
                LEFT JOIN users u ON u.id = j.created_by
                {where_sql}
            """,
            tuple(where_params),
        ).fetchone()

        total_count = total_row["c"]
        total_amount = float(total_row["s"] or 0)

    records = [serialize_revenue_item_row(row) for row in rows]
    return rpc_response(with_meta(records, offset, limit, total_count, totalAmount=total_amount))


@app.post("/orpc/admin/revenue/get")
@app.post("/api/orpc/admin/revenue/get")
@require_auth({"admin"})
def orpc_get_admin_revenue(user):
    payload = rpc_payload()
    revenue_id = payload.get("id")
    if not revenue_id:
        return rpc_error("Revenue ID is required", 400)

    with connect() as conn:
        row = conn.execute(
            """
                SELECT
                    i.*,
                    i.transaction_date AS revenue_date,
                    j.driver_id,
                    j.created_by AS entry_created_by,
                    j.created_at AS entry_created_at,
                    v.name AS vehicle_name,
                    v.license_plate AS vehicle_license_plate,
                    d.name AS driver_name,
                    u.name AS created_by_name,
                    u.image AS created_by_image
                FROM journal_entry_items i
                LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
                LEFT JOIN vehicles v ON v.id = i.vehicle_id
                LEFT JOIN drivers d ON d.id = j.driver_id
                LEFT JOIN users u ON u.id = j.created_by
                WHERE i.id = ? AND i.type = 'credit'
            """,
            (revenue_id,),
        ).fetchone()

    if not row:
        return rpc_error("Revenue record not found", 404)

    return rpc_response(serialize_revenue_item_row(dict(row)))

