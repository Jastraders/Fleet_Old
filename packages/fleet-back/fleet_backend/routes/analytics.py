from typing import Any

from flask import jsonify, request

from database import connect, rows_to_dicts
from fleet_backend.common import (
    PERIODS,
    VEHICLE_PERIODS,
    calculate_percentage_change,
    period_bounds,
    period_start,
    require_auth,
    rpc_payload,
    rpc_response,
    sum_amount,
    vehicle_period_bounds,
    vehicle_period_start,
)
from fleet_backend.server import app

@app.get("/api/analytics/summary")
@require_auth({"analyst"})
def analytics_summary(user):
    period = request.args.get("period", "all_time")
    if period not in PERIODS:
        return jsonify({"error": "Invalid period"}), 400
    current_start, previous_start, previous_end = period_bounds(period)
    with connect() as conn:
        current_revenue = sum_amount(conn, "credit", start=current_start)
        current_expenses = sum_amount(conn, "debit", start=current_start)
        previous_revenue = sum_amount(conn, "credit", start=previous_start, end=previous_end)
        previous_expenses = sum_amount(conn, "debit", start=previous_start, end=previous_end)

    current_profit = current_revenue - current_expenses
    current_profit_percentage = (current_profit / current_revenue * 100) if current_revenue else 0
    previous_profit = previous_revenue - previous_expenses
    previous_profit_percentage = (previous_profit / previous_revenue * 100) if previous_revenue else 0

    return jsonify({
        "revenue": {
            "value": current_revenue,
            "change": calculate_percentage_change(current_revenue, previous_revenue),
        },
        "expenses": {
            "value": current_expenses,
            "change": calculate_percentage_change(current_expenses, previous_expenses),
        },
        "profit": {
            "value": current_profit,
            "change": calculate_percentage_change(current_profit, previous_profit),
        },
        "profitPercentage": {
            "value": current_profit_percentage,
            "change": calculate_percentage_change(current_profit_percentage, previous_profit_percentage),
        },
    })


@app.post("/orpc/analyst/analytics/summaryStats")
@app.post("/api/orpc/analyst/analytics/summaryStats")
@app.post("/analyst/analytics/summaryStats")
@require_auth({"analyst"})
def orpc_analytics_summary_stats(user):
    period = rpc_payload().get("period", "all_time")
    if period not in PERIODS:
        return rpc_response({"message": "Invalid period"}, 400)
    current_start, previous_start, previous_end = period_bounds(period)
    with connect() as conn:
        current_revenue = sum_amount(conn, "credit", start=current_start)
        current_expenses = sum_amount(conn, "debit", start=current_start)
        previous_revenue = sum_amount(conn, "credit", start=previous_start, end=previous_end)
        previous_expenses = sum_amount(conn, "debit", start=previous_start, end=previous_end)

    current_profit = current_revenue - current_expenses
    current_profit_percentage = (current_profit / current_revenue * 100) if current_revenue else 0
    previous_profit = previous_revenue - previous_expenses
    previous_profit_percentage = (previous_profit / previous_revenue * 100) if previous_revenue else 0

    return rpc_response({
        "revenue": {
            "value": current_revenue,
            "change": calculate_percentage_change(current_revenue, previous_revenue),
        },
        "expenses": {
            "value": current_expenses,
            "change": calculate_percentage_change(current_expenses, previous_expenses),
        },
        "profit": {
            "value": current_profit,
            "change": calculate_percentage_change(current_profit, previous_profit),
        },
        "profitPercentage": {
            "value": current_profit_percentage,
            "change": calculate_percentage_change(current_profit_percentage, previous_profit_percentage),
        },
    })


@app.post("/orpc/analyst/analytics/fleetStats")
@app.post("/api/orpc/analyst/analytics/fleetStats")
@app.post("/analyst/analytics/fleetStats")
@require_auth({"analyst"})
def orpc_analytics_fleet_stats(user):
    period = rpc_payload().get("period", "all_time")
    if period not in PERIODS:
        return rpc_response({"message": "Invalid period"}, 400)
    start = period_start(period)
    with connect() as conn:
        vehicles = rows_to_dicts(conn.execute("SELECT id, name, color FROM vehicles ORDER BY name ASC").fetchall())
        conditions = []
        params: list[Any] = []
        if start is not None:
            conditions.append("transaction_date >= ?")
            params.append(start.isoformat())
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        credits = rows_to_dicts(conn.execute(
            f"SELECT vehicle_id, COALESCE(SUM(amount), 0) AS total FROM journal_entry_items {where_clause} AND type = 'credit' GROUP BY vehicle_id"
            if where_clause else "SELECT vehicle_id, COALESCE(SUM(amount), 0) AS total FROM journal_entry_items WHERE type = 'credit' GROUP BY vehicle_id",
            tuple(params),
        ).fetchall())
        debits = rows_to_dicts(conn.execute(
            f"SELECT vehicle_id, COALESCE(SUM(amount), 0) AS total FROM journal_entry_items {where_clause} AND type = 'debit' GROUP BY vehicle_id"
            if where_clause else "SELECT vehicle_id, COALESCE(SUM(amount), 0) AS total FROM journal_entry_items WHERE type = 'debit' GROUP BY vehicle_id",
            tuple(params),
        ).fetchall())

    credit_map = {row["vehicle_id"]: float(row["total"] or 0) for row in credits}
    debit_map = {row["vehicle_id"]: float(row["total"] or 0) for row in debits}
    vehicle_data = []
    for vehicle in vehicles:
        credit = credit_map.get(vehicle["id"], 0.0)
        debit = debit_map.get(vehicle["id"], 0.0)
        vehicle_data.append({
            "vehicleId": vehicle["id"],
            "vehicleName": vehicle["name"],
            "vehicleColor": vehicle["color"],
            "credit": credit,
            "debit": debit,
            "profit": credit - debit,
        })

    vehicle_data.sort(key=lambda row: row["profit"], reverse=True)
    return rpc_response(vehicle_data)


@app.post("/orpc/analyst/analytics/expensesStats")
@app.post("/api/orpc/analyst/analytics/expensesStats")
@app.post("/analyst/analytics/expensesStats")
@require_auth({"analyst"})
def orpc_analytics_expenses_stats(user):
    period = rpc_payload().get("period", "all_time")
    if period not in PERIODS:
        return rpc_response({"message": "Invalid period"}, 400)
    start = period_start(period)
    params: list[Any] = []
    where = ["jei.type = 'debit'"]
    if start is not None:
        where.append("jei.transaction_date >= ?")
        params.append(start.isoformat())

    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            f"""
            SELECT
                COALESCE(ec.id, 'uncategorized') AS id,
                COALESCE(ec.name, 'Uncategorized') AS name,
                COALESCE(ec.color, '6b7280') AS color,
                COALESCE(SUM(jei.amount), 0) AS amount
            FROM journal_entry_items jei
            LEFT JOIN expense_category ec ON ec.id = jei.expense_category_id
            WHERE {' AND '.join(where)}
            GROUP BY
                COALESCE(ec.id, 'uncategorized'),
                COALESCE(ec.name, 'Uncategorized'),
                COALESCE(ec.color, '6b7280')
            ORDER BY amount DESC
            """,
            tuple(params),
        ).fetchall())
    return rpc_response(rows)


@app.post("/orpc/analyst/analytics/vehicle/summaryStats")
@require_auth({"analyst"})
def orpc_vehicle_summary_stats(user):
    payload = rpc_payload()
    vehicle_id = payload.get("vehicleId")
    period = payload.get("period", "all_time")
    if not vehicle_id:
        return rpc_response({"message": "vehicleId is required"}, 400)
    if period not in VEHICLE_PERIODS:
        return rpc_response({"message": "Invalid period"}, 400)

    current_start, previous_start, previous_end = vehicle_period_bounds(period)
    with connect() as conn:
        current_revenue = sum_amount(conn, "credit", start=current_start, vehicle_id=vehicle_id)
        current_expenses = sum_amount(conn, "debit", start=current_start, vehicle_id=vehicle_id)
        previous_revenue = sum_amount(conn, "credit", start=previous_start, end=previous_end, vehicle_id=vehicle_id)
        previous_expenses = sum_amount(conn, "debit", start=previous_start, end=previous_end, vehicle_id=vehicle_id)

    current_profit = current_revenue - current_expenses
    current_profit_percentage = (current_profit / current_revenue * 100) if current_revenue else 0
    previous_profit = previous_revenue - previous_expenses
    previous_profit_percentage = (previous_profit / previous_revenue * 100) if previous_revenue else 0

    return rpc_response({
        "revenue": {
            "value": current_revenue,
            "change": calculate_percentage_change(current_revenue, previous_revenue),
        },
        "expenses": {
            "value": current_expenses,
            "change": calculate_percentage_change(current_expenses, previous_expenses),
        },
        "profit": {
            "value": current_profit,
            "change": calculate_percentage_change(current_profit, previous_profit),
        },
        "profitPercentage": {
            "value": current_profit_percentage,
            "change": calculate_percentage_change(current_profit_percentage, previous_profit_percentage),
        },
    })


@app.post("/orpc/analyst/analytics/vehicle/vehicleStats")
@require_auth({"analyst"})
def orpc_vehicle_vehicle_stats(user):
    payload = rpc_payload()
    vehicle_id = payload.get("vehicleId")
    period = payload.get("period", "all_time")
    if not vehicle_id:
        return rpc_response({"message": "vehicleId is required"}, 400)
    if period not in VEHICLE_PERIODS:
        return rpc_response({"message": "Invalid period"}, 400)

    start = vehicle_period_start(period)
    params: list[Any] = [vehicle_id]
    where = ["vehicle_id = ?"]
    if start is not None:
        where.append("transaction_date >= ?")
        params.append(start.isoformat())

    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            f"""
            SELECT strftime('%Y-%m-01T00:00:00', transaction_date) AS bucket,
                   COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS credit,
                   COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS debit
            FROM journal_entry_items
            WHERE {' AND '.join(where)}
            GROUP BY strftime('%Y-%m-01T00:00:00', transaction_date)
            ORDER BY bucket
            """,
            tuple(params),
        ).fetchall())

    stats = [
        {
            "bucket": row["bucket"],
            "credit": float(row["credit"] or 0),
            "debit": float(row["debit"] or 0),
            "profit": float(row["credit"] or 0) - float(row["debit"] or 0),
        }
        for row in rows
    ]
    return rpc_response(stats)


@app.post("/orpc/analyst/analytics/vehicle/expensesStats")
@require_auth({"analyst"})
def orpc_vehicle_expenses_stats(user):
    payload = rpc_payload()
    vehicle_id = payload.get("vehicleId")
    period = payload.get("period", "all_time")
    if not vehicle_id:
        return rpc_response({"message": "vehicleId is required"}, 400)
    if period not in VEHICLE_PERIODS:
        return rpc_response({"message": "Invalid period"}, 400)

    start = vehicle_period_start(period)
    params: list[Any] = [vehicle_id]
    where = ["jei.type = 'debit'", "jei.vehicle_id = ?"]
    if start is not None:
        where.append("jei.transaction_date >= ?")
        params.append(start.isoformat())

    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            f"""
            SELECT
                COALESCE(ec.id, 'uncategorized') AS id,
                COALESCE(ec.name, 'Uncategorized') AS name,
                COALESCE(ec.color, '6b7280') AS color,
                COALESCE(SUM(jei.amount), 0) AS amount
            FROM journal_entry_items jei
            LEFT JOIN expense_category ec ON ec.id = jei.expense_category_id
            WHERE {' AND '.join(where)}
            GROUP BY
                COALESCE(ec.id, 'uncategorized'),
                COALESCE(ec.name, 'Uncategorized'),
                COALESCE(ec.color, '6b7280')
            ORDER BY amount DESC
            """,
            tuple(params),
        ).fetchall())
    return rpc_response(rows)

