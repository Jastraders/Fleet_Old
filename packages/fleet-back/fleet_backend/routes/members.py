import uuid
from typing import Any

from flask import jsonify, request
from werkzeug.security import generate_password_hash

from database import connect, rows_to_dicts
from fleet_backend.common import now_iso, require_auth, rpc_error, rpc_payload, rpc_response, serialize_member_row, with_meta
from fleet_backend.server import app

@app.post("/orpc/admin/members/list")
@require_auth({"admin"})
def orpc_list_members(user):
    payload = rpc_payload()
    offset = int(payload.get("offset", 0))
    limit = min(int(payload.get("limit", 20)), 100)
    search = payload.get("search")
    sort_by = payload.get("sortBy", "createdAt")
    sort_order = payload.get("sortOrder", "desc")

    sort_map = {
        "memberName": "u.name",
        "createdAt": "u.created_at",
        "createdBy": "cb.name",
    }
    order_field = sort_map.get(sort_by, "u.created_at")
    order_dir = "ASC" if sort_order == "asc" else "DESC"

    conditions = ["u.id NOT IN (SELECT user_id FROM user_roles WHERE role = 'owner')"]
    params: list[Any] = []
    if isinstance(search, str) and search.strip():
        query = f"%{search.strip()}%"
        conditions.append("(u.name LIKE ? OR u.email LIKE ?)")
        params.extend([query, query])

    where_clause = " AND ".join(conditions)

    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                f"""
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.image,
                    u.created_by,
                    u.created_at,
                    u.updated_at,
                    cb.name AS created_by_name,
                    cb.image AS created_by_image
                FROM users u
                LEFT JOIN users cb ON cb.id = u.created_by
                WHERE {where_clause}
                ORDER BY {order_field} {order_dir}, u.created_at DESC
                LIMIT ? OFFSET ?
                """,
                (*params, limit, offset),
            ).fetchall()
        )
        total = conn.execute(
            f"SELECT COUNT(*) AS c FROM users u WHERE {where_clause}",
            tuple(params),
        ).fetchone()["c"]

        members = []
        for row in rows:
            roles = rows_to_dicts(
                conn.execute(
                    "SELECT role FROM user_roles WHERE user_id = ? ORDER BY role ASC",
                    (row["id"],),
                ).fetchall()
            )
            members.append(serialize_member_row(row, roles))

    return rpc_response(with_meta(members, offset, limit, total))


@app.post("/orpc/admin/members/create")
@require_auth({"admin"})
def orpc_create_member(user):
    payload = rpc_payload()
    roles = payload.get("roles")
    if not isinstance(roles, list) or not roles:
        return rpc_error("roles must be a non-empty list", 400)

    with connect() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?",
            (payload["email"],),
        ).fetchone()
        if existing:
            return rpc_error("Email already exists", 409)

        uid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id,name,email,password_hash,created_by) VALUES (?,?,?,?,?)",
            (uid, payload["name"], payload["email"], generate_password_hash(payload["password"]), user["id"]),
        )
        for role in roles:
            conn.execute(
                "INSERT INTO user_roles (id,user_id,role) VALUES (?,?,?)",
                (str(uuid.uuid4()), uid, role),
            )
        conn.commit()

        row = conn.execute(
            """
            SELECT
                u.id,
                u.name,
                u.email,
                u.image,
                u.created_by,
                u.created_at,
                u.updated_at,
                cb.name AS created_by_name,
                cb.image AS created_by_image
            FROM users u
            LEFT JOIN users cb ON cb.id = u.created_by
            WHERE u.id = ?
            """,
            (uid,),
        ).fetchone()

        role_rows = rows_to_dicts(
            conn.execute(
                "SELECT role FROM user_roles WHERE user_id = ? ORDER BY role ASC",
                (uid,),
            ).fetchall()
        )

    return rpc_response(serialize_member_row(dict(row), role_rows))


@app.post("/orpc/admin/members/get")
@require_auth({"admin"})
def orpc_get_member(user):
    payload = rpc_payload()
    member_id = payload.get("id")

    with connect() as conn:
        row = conn.execute(
            """
            SELECT
                u.id,
                u.name,
                u.email,
                u.image,
                u.created_by,
                u.created_at,
                u.updated_at,
                cb.name AS created_by_name,
                cb.image AS created_by_image
            FROM users u
            LEFT JOIN users cb ON cb.id = u.created_by
            WHERE u.id = ? AND u.id NOT IN (SELECT user_id FROM user_roles WHERE role='owner')
            """,
            (member_id,),
        ).fetchone()
        if not row:
            return rpc_error("User not found", 404)
        roles = rows_to_dicts(conn.execute("SELECT role FROM user_roles WHERE user_id = ?", (member_id,)).fetchall())

    return rpc_response(serialize_member_row(dict(row), roles))


@app.post("/orpc/admin/members/update")
@require_auth({"admin"})
def orpc_update_member(user):
    payload = rpc_payload()
    member_id = payload.get("id")
    roles = payload.get("roles")
    if not isinstance(roles, list) or not roles:
        return rpc_error("roles must be a non-empty list", 400)

    with connect() as conn:
        owner = conn.execute(
            "SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner'",
            (member_id,),
        ).fetchone()
        if owner:
            return rpc_error("Cannot update owner", 403)
        existing = conn.execute("SELECT id FROM users WHERE id = ?", (member_id,)).fetchone()
        if not existing:
            return rpc_error("User not found", 404)
        conn.execute("DELETE FROM user_roles WHERE user_id = ?", (member_id,))
        for role in roles:
            conn.execute(
                "INSERT INTO user_roles (id,user_id,role) VALUES (?,?,?)",
                (str(uuid.uuid4()), member_id, role),
            )
        conn.execute(
            "UPDATE users SET updated_at = ? WHERE id = ?",
            (now_iso(), member_id),
        )
        conn.commit()

        row = conn.execute(
            """
            SELECT
                u.id,
                u.name,
                u.email,
                u.image,
                u.created_by,
                u.created_at,
                u.updated_at,
                cb.name AS created_by_name,
                cb.image AS created_by_image
            FROM users u
            LEFT JOIN users cb ON cb.id = u.created_by
            WHERE u.id = ?
            """,
            (member_id,),
        ).fetchone()
        role_rows = rows_to_dicts(
            conn.execute(
                "SELECT role FROM user_roles WHERE user_id = ? ORDER BY role ASC",
                (member_id,),
            ).fetchall()
        )

    return rpc_response(serialize_member_row(dict(row), role_rows))


@app.post("/orpc/admin/members/delete")
@require_auth({"admin"})
def orpc_delete_member(user):
    payload = rpc_payload()
    member_id = payload.get("id")

    with connect() as conn:
        owner = conn.execute(
            "SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner'",
            (member_id,),
        ).fetchone()
        if owner:
            return rpc_error("Cannot delete owner", 403)
        existing = conn.execute(
            """
            SELECT
                u.id,
                u.name,
                u.email,
                u.image,
                u.created_by,
                u.created_at,
                u.updated_at,
                cb.name AS created_by_name,
                cb.image AS created_by_image
            FROM users u
            LEFT JOIN users cb ON cb.id = u.created_by
            WHERE u.id = ?
            """,
            (member_id,),
        ).fetchone()
        if not existing:
            return rpc_error("User not found", 404)
        roles = rows_to_dicts(conn.execute("SELECT role FROM user_roles WHERE user_id = ?", (member_id,)).fetchall())
        conn.execute("DELETE FROM users WHERE id = ?", (member_id,))
        conn.commit()

    return rpc_response(serialize_member_row(dict(existing), roles))



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


