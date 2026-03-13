import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, make_response, request
from werkzeug.security import check_password_hash, generate_password_hash

from database import connect, init_db, rows_to_dicts

load_dotenv()

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False
SESSION_TTL_DAYS = 30
PERIODS = {"all_time", "last_7d", "last_30d", "last_6m", "last_12m"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def make_session_token() -> tuple[str, str, str]:
    sid = secrets.token_urlsafe(18)
    secret = secrets.token_urlsafe(18)
    return sid, secret, f"{sid}.{secret}"


def random_color() -> str:
    return f"{secrets.randbelow(16**6):06x}"


def period_start(period: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    if period == "last_7d":
        return now - timedelta(days=7)
    if period == "last_30d":
        return now - timedelta(days=30)
    if period == "last_6m":
        return now - timedelta(days=183)
    if period == "last_12m":
        return now - timedelta(days=365)
    return None


def get_user_from_session() -> dict[str, Any] | None:
    token = request.cookies.get("session")
    if not token or "." not in token:
        return None

    sid, secret = token.split(".", 1)
    with connect() as conn:
        session = conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (sid,)
        ).fetchone()
        if not session:
            return None

        created_at = datetime.fromisoformat(session["created_at"].replace(" ", "T"))
        if datetime.now(timezone.utc).replace(tzinfo=None) - created_at > timedelta(days=SESSION_TTL_DAYS):
            conn.execute("DELETE FROM sessions WHERE id = ?", (sid,))
            conn.commit()
            return None

        if hash_secret(secret) != session["secret_hash"]:
            return None

        user = conn.execute("SELECT id, name, email, image FROM users WHERE id = ?", (session["user_id"],)).fetchone()
        if not user:
            return None

        roles = rows_to_dicts(conn.execute("SELECT role FROM user_roles WHERE user_id = ?", (user["id"],)).fetchall())
        user_data = dict(user)
        user_data["roles"] = roles
        return user_data


def require_auth(roles: set[str] | None = None):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            user = get_user_from_session()
            if not user:
                return jsonify({"error": "Unauthorized"}), 401
            if roles:
                user_roles = {r["role"] for r in user["roles"]}
                if not (user_roles & roles or "owner" in user_roles):
                    return jsonify({"error": "Forbidden"}), 403
            return fn(user, *args, **kwargs)

        return wrapped

    return decorator


def with_meta(data: list[dict[str, Any]], offset: int, limit: int, total: int):
    return {
        "data": data,
        "meta": {
            "total": total,
            "offset": offset,
            "limit": limit,
            "hasMore": offset + limit < total,
        },
    }


def seed_owner() -> None:
    with connect() as conn:
        owner = conn.execute("SELECT id FROM users WHERE email = ?", ("owner@fleet.dev",)).fetchone()
        if owner:
            return
        uid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id, name, email, password_hash) VALUES (?,?,?,?)",
            (uid, "Owner", "owner@fleet.dev", generate_password_hash("password")),
        )
        conn.execute(
            "INSERT INTO user_roles (id, user_id, role) VALUES (?,?,?)",
            (str(uuid.uuid4()), uid, "owner"),
        )
        conn.commit()


def rpc_payload() -> dict[str, Any]:
    """Decode oRPC payloads that wrap args as {"json": {...}}."""
    payload = request.get_json(silent=True)
    if isinstance(payload, dict):
        wrapped = payload.get("json")
        if isinstance(wrapped, dict):
            return wrapped
        return payload
    return {}


def rpc_response(data: Any, status: int = 200):
    """Encode oRPC responses using the {"json": ...} envelope."""
    return jsonify({"json": data}), status


@app.post("/api/auth/sign-in")
def sign_in():
    payload = request.get_json(force=True)
    email = payload.get("email")
    password = payload.get("password")
    with connect() as conn:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Invalid credentials"}), 401
        sid, secret, token = make_session_token()
        conn.execute(
            "INSERT INTO sessions (id, secret_hash, user_id) VALUES (?,?,?)",
            (sid, hash_secret(secret), user["id"]),
        )
        conn.commit()

    response = make_response(jsonify({"ok": True}))
    response.set_cookie("session", token, httponly=True, samesite="Lax", max_age=SESSION_TTL_DAYS * 24 * 3600)
    return response


@app.post("/orpc/user/auth/signInWithEmailAndPassword")
def orpc_sign_in_with_email_and_password():
    payload = rpc_payload()
    email = payload.get("email")
    password = payload.get("password")
    with connect() as conn:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Invalid credentials"}), 401
        sid, secret, token = make_session_token()
        conn.execute(
            "INSERT INTO sessions (id, secret_hash, user_id) VALUES (?,?,?)",
            (sid, hash_secret(secret), user["id"]),
        )
        conn.commit()

    response = make_response(rpc_response({"ok": True}))
    response.set_cookie("session", token, httponly=True, samesite="Lax", max_age=SESSION_TTL_DAYS * 24 * 3600)
    return response


@app.post("/api/auth/sign-out")
def sign_out():
    token = request.cookies.get("session", "")
    if "." in token:
        sid = token.split(".", 1)[0]
        with connect() as conn:
            conn.execute("DELETE FROM sessions WHERE id = ?", (sid,))
            conn.commit()
    response = make_response(jsonify({"ok": True}))
    response.set_cookie("session", "", expires=0)
    return response


@app.post("/orpc/user/auth/signOut")
def orpc_sign_out():
    token = request.cookies.get("session", "")
    if "." in token:
        sid = token.split(".", 1)[0]
        with connect() as conn:
            conn.execute("DELETE FROM sessions WHERE id = ?", (sid,))
            conn.commit()
    response = make_response(rpc_response({"ok": True}))
    response.set_cookie("session", "", expires=0)
    return response


@app.get("/api/auth/me")
@require_auth()
def me(user):
    return jsonify(user)


@app.post("/orpc/user/auth/getMe")
@require_auth()
def orpc_get_me(user):
    return rpc_response(user)


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
            "INSERT INTO vehicles (id,name,license_plate,color,created_by) VALUES (?,?,?,?,?)",
            (vid, payload["name"], payload["licensePlate"], color, user["id"]),
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
    for field, db_col in (("name", "name"), ("licensePlate", "license_plate")):
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
    with connect() as conn:
        cid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO expense_category (id,name,color,created_by) VALUES (?,?,?,?)",
            (cid, payload["name"], random_color(), user["id"]),
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
    if payload.get("name") is None:
        return jsonify({"error": "No fields to update"}), 400
    with connect() as conn:
        exists = conn.execute("SELECT id FROM expense_category WHERE id = ?", (category_id,)).fetchone()
        if not exists:
            return jsonify({"error": "Category not found"}), 404
        conn.execute(
            "UPDATE expense_category SET name = ?, updated_at = ? WHERE id = ?",
            (payload["name"], now_iso(), category_id),
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
                "INSERT INTO journal_entry_items (id,journal_entry_id,vehicle_id,transaction_date,type,amount,expense_category_id) VALUES (?,?,?,?,?,?,?)",
                (
                    str(uuid.uuid4()),
                    eid,
                    payload["vehicleId"],
                    item["transactionDate"],
                    item["type"],
                    float(item["amount"]),
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
                    "INSERT INTO journal_entry_items (id,journal_entry_id,vehicle_id,transaction_date,type,amount,expense_category_id) VALUES (?,?,?,?,?,?,?)",
                    (
                        str(uuid.uuid4()),
                        entry_id,
                        existing["vehicle_id"],
                        item["transactionDate"],
                        item["type"],
                        float(item["amount"]),
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


@app.get("/api/admin/members")
@require_auth({"admin"})
def list_members(user):
    offset = int(request.args.get("offset", 0))
    limit = min(int(request.args.get("limit", 20)), 100)
    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                """
                SELECT u.id, u.name, u.email, u.created_at, u.updated_at
                FROM users u
                WHERE u.id NOT IN (SELECT user_id FROM user_roles WHERE role='owner')
                ORDER BY u.created_at DESC LIMIT ? OFFSET ?
                """,
                (limit, offset),
            ).fetchall()
        )
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM users WHERE id NOT IN (SELECT user_id FROM user_roles WHERE role='owner')"
        ).fetchone()["c"]
    return jsonify(with_meta(rows, offset, limit, total))


@app.post("/api/admin/members")
@require_auth({"admin"})
def create_member(user):
    payload = request.get_json(force=True)
    with connect() as conn:
        uid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id,name,email,password_hash,created_by) VALUES (?,?,?,?,?)",
            (uid, payload["name"], payload["email"], generate_password_hash(payload["password"]), user["id"]),
        )
        for role in payload.get("roles", []):
            conn.execute(
                "INSERT INTO user_roles (id,user_id,role) VALUES (?,?,?)",
                (str(uuid.uuid4()), uid, role),
            )
        conn.commit()
    return jsonify({"id": uid})


@app.get("/api/admin/members/<member_id>")
@require_auth({"admin"})
def get_member(user, member_id):
    with connect() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.name, u.email, u.created_at, u.updated_at
            FROM users u
            WHERE u.id = ? AND u.id NOT IN (SELECT user_id FROM user_roles WHERE role='owner')
            """,
            (member_id,),
        ).fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404
        roles = rows_to_dicts(conn.execute("SELECT role FROM user_roles WHERE user_id = ?", (member_id,)).fetchall())
    member = dict(row)
    member["roles"] = roles
    return jsonify(member)


@app.put("/api/admin/members/<member_id>")
@require_auth({"admin"})
def update_member(user, member_id):
    payload = request.get_json(force=True)
    roles = payload.get("roles")
    if not isinstance(roles, list) or not roles:
        return jsonify({"error": "roles must be a non-empty list"}), 400
    with connect() as conn:
        owner = conn.execute(
            "SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner'",
            (member_id,),
        ).fetchone()
        if owner:
            return jsonify({"error": "Cannot update owner"}), 403
        existing = conn.execute("SELECT id FROM users WHERE id = ?", (member_id,)).fetchone()
        if not existing:
            return jsonify({"error": "User not found"}), 404
        conn.execute("DELETE FROM user_roles WHERE user_id = ?", (member_id,))
        for role in roles:
            conn.execute(
                "INSERT INTO user_roles (id,user_id,role) VALUES (?,?,?)",
                (str(uuid.uuid4()), member_id, role),
            )
        conn.commit()
    return get_member(user, member_id)


@app.delete("/api/admin/members/<member_id>")
@require_auth({"admin"})
def delete_member(user, member_id):
    with connect() as conn:
        owner = conn.execute(
            "SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner'",
            (member_id,),
        ).fetchone()
        if owner:
            return jsonify({"error": "Cannot delete owner"}), 403
        existing = conn.execute("SELECT id, name, email FROM users WHERE id = ?", (member_id,)).fetchone()
        if not existing:
            return jsonify({"error": "User not found"}), 404
        conn.execute("DELETE FROM users WHERE id = ?", (member_id,))
        conn.commit()
    return jsonify(dict(existing))


@app.get("/api/analytics/summary")
@require_auth({"analyst"})
def analytics_summary(user):
    period = request.args.get("period", "all_time")
    if period not in PERIODS:
        return jsonify({"error": "Invalid period"}), 400
    start = period_start(period)
    where = "" if start is None else "WHERE transaction_date >= ?"
    params: tuple[Any, ...] = () if start is None else (start.isoformat(),)
    with connect() as conn:
        credit = conn.execute(f"SELECT COALESCE(SUM(amount),0) AS t FROM journal_entry_items {where} AND type='credit'" if where else "SELECT COALESCE(SUM(amount),0) AS t FROM journal_entry_items WHERE type='credit'", params).fetchone()["t"]
        debit = conn.execute(f"SELECT COALESCE(SUM(amount),0) AS t FROM journal_entry_items {where} AND type='debit'" if where else "SELECT COALESCE(SUM(amount),0) AS t FROM journal_entry_items WHERE type='debit'", params).fetchone()["t"]
    profit = credit - debit
    return jsonify({
        "revenue": {"value": credit, "change": None},
        "expenses": {"value": debit, "change": None},
        "profit": {"value": profit, "change": None},
        "profitPercentage": {"value": (profit / credit * 100) if credit else 0, "change": None},
    })


@app.get("/")
def root():
    return jsonify({"service": "fleet-backend", "stack": "Flask + SQLite"})


if __name__ == "__main__":
    init_db()
    seed_owner()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3001")), debug=True)
