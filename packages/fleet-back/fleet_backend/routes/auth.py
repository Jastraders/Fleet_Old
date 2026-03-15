from flask import jsonify, make_response, request
from werkzeug.security import check_password_hash

from database import connect
from fleet_backend.common import SESSION_TTL_DAYS, hash_secret, make_session_token, require_auth, rpc_payload, rpc_response
from fleet_backend.server import app

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


