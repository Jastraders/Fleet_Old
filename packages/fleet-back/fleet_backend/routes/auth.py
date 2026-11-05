import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from flask import jsonify, make_response, request
from werkzeug.security import check_password_hash, generate_password_hash

from database import connect
from fleet_backend.common import (
    SESSION_TTL_DAYS,
    hash_secret,
    make_session_token,
    now_iso,
    require_auth,
    rpc_error,
    rpc_payload,
    rpc_response,
)
from fleet_backend.email import get_admin_reset_email, send_password_reset_code_email
from fleet_backend.server import app

log = logging.getLogger(__name__)


def _find_user_by_email(conn, raw_email: str | None):
    clean_email = (raw_email or "").strip().lower()
    return conn.execute(
        """
        SELECT * FROM users 
        WHERE LOWER(email) = ? 
           OR (LOWER(email) = 'owner@fleet.dev' AND ? = 'anwarjas123@gmail.com')
           OR (LOWER(email) = 'anwarjas123@gmail.com' AND ? = 'owner@fleet.dev')
        """,
        (clean_email, clean_email, clean_email),
    ).fetchone()


@app.post("/api/auth/sign-in")
def sign_in():
    payload = request.get_json(force=True)
    email = payload.get("email")
    password = payload.get("password")
    with connect() as conn:
        user = _find_user_by_email(conn, email)
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Invalid credentials"}), 401
        sid, secret, token = make_session_token()
        conn.execute(
            "INSERT INTO sessions (id, secret_hash, user_id) VALUES (?,?,?)",
            (sid, hash_secret(secret), user["id"]),
        )
        conn.execute("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), user["id"]))
        conn.commit()

    response = make_response(jsonify({"ok": True}))
    response.set_cookie(
        "session",
        token,
        httponly=True,
        samesite="None",
        secure=True,
    )
    return response


@app.post("/orpc/user/auth/signInWithEmailAndPassword")
def orpc_sign_in_with_email_and_password():
    payload = rpc_payload()
    email = payload.get("email")
    password = payload.get("password")
    with connect() as conn:
        user = _find_user_by_email(conn, email)
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Invalid credentials"}), 401
        sid, secret, token = make_session_token()
        conn.execute(
            "INSERT INTO sessions (id, secret_hash, user_id) VALUES (?,?,?)",
            (sid, hash_secret(secret), user["id"]),
        )
        conn.execute("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), user["id"]))
        conn.commit()

    response = make_response(rpc_response({"ok": True}))
    response.set_cookie(
        "session",
        token,
        httponly=True,
        samesite="None",
        secure=True,
    )
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


# Password reset endpoints for Admin
@app.get("/api/auth/admin-reset-info")
def get_admin_reset_info():
    return jsonify({"targetEmail": get_admin_reset_email()})


@app.post("/orpc/user/auth/getAdminResetInfo")
def orpc_get_admin_reset_info():
    return rpc_response({"targetEmail": get_admin_reset_email()})


@app.post("/api/auth/request-admin-reset-code")
def request_admin_reset_code():
    return _handle_request_admin_reset_code(is_rpc=False)


@app.post("/orpc/user/auth/requestAdminResetCode")
def orpc_request_admin_reset_code():
    return _handle_request_admin_reset_code(is_rpc=True)


def _handle_request_admin_reset_code(is_rpc: bool):
    target_email = get_admin_reset_email()
    with connect() as conn:
        admin_user = conn.execute(
            """
            SELECT u.id, u.name, u.email 
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            WHERE ur.role IN ('owner', 'admin') 
               OR LOWER(u.email) IN ('owner@fleet.dev', ?)
            ORDER BY CASE WHEN ur.role = 'owner' THEN 1 WHEN ur.role = 'admin' THEN 2 ELSE 3 END
            LIMIT 1
            """,
            (target_email,),
        ).fetchone()

        if not admin_user:
            msg = "Admin account not found"
            return rpc_error(msg, 404) if is_rpc else (jsonify({"error": msg}), 404)

        # Check rate-limit (60 seconds cooldown)
        recent = conn.execute(
            """
            SELECT created_at FROM password_resets 
            WHERE target_email = ? 
            ORDER BY created_at DESC LIMIT 1
            """,
            (target_email,),
        ).fetchone()

        if recent and recent.get("created_at"):
            try:
                created_dt_str = str(recent["created_at"]).replace("Z", "+00:00")
                if " " in created_dt_str and "+" not in created_dt_str:
                    created_dt = datetime.fromisoformat(created_dt_str).replace(tzinfo=timezone.utc)
                else:
                    created_dt = datetime.fromisoformat(created_dt_str)
                elapsed = (datetime.now(timezone.utc) - created_dt).total_seconds()
                if elapsed < 60:
                    remaining = int(60 - elapsed)
                    msg = f"Please wait {remaining} seconds before requesting a new code."
                    return rpc_error(msg, 429) if is_rpc else (jsonify({"error": msg, "retryAfter": remaining}), 429)
            except Exception:
                pass

        # Generate 6-digit code
        code = f"{secrets.randbelow(900000) + 100000:06d}"
        code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        reset_id = str(uuid.uuid4())

        conn.execute(
            """
            INSERT INTO password_resets (id, target_email, user_id, code_hash, attempts, expires_at, created_at)
            VALUES (?, ?, ?, ?, 0, ?, ?)
            """,
            (reset_id, target_email, admin_user["id"], code_hash, expires_at, now_iso()),
        )
        conn.commit()

    # Send email
    try:
        send_password_reset_code_email(target_email, code, expires_in_minutes=10)
    except Exception as e:
        log.exception("Failed to send password reset email to %s", target_email)
        msg = f"Failed to send email: {str(e)}"
        return rpc_error(msg, 500) if is_rpc else (jsonify({"error": msg}), 500)

    data = {
        "ok": True,
        "targetEmail": target_email,
        "cooldownSeconds": 60,
        "message": f"Verification code sent to {target_email}",
    }
    return rpc_response(data) if is_rpc else jsonify(data)


@app.post("/api/auth/verify-admin-reset-code")
def verify_admin_reset_code():
    return _handle_verify_admin_reset_code(is_rpc=False)


@app.post("/orpc/user/auth/verifyAdminResetCode")
def orpc_verify_admin_reset_code():
    return _handle_verify_admin_reset_code(is_rpc=True)


def _handle_verify_admin_reset_code(is_rpc: bool):
    payload = rpc_payload() if is_rpc else request.get_json(force=True)
    code = str(payload.get("code", "")).strip()
    new_password = str(payload.get("newPassword", ""))

    if not code or len(code) != 6 or not code.isdigit():
        msg = "Please enter a valid 6-digit verification code"
        return rpc_error(msg, 400) if is_rpc else (jsonify({"error": msg}), 400)

    if not new_password or len(new_password) < 8:
        msg = "Password must be at least 8 characters long"
        return rpc_error(msg, 400) if is_rpc else (jsonify({"error": msg}), 400)

    target_email = get_admin_reset_email()

    with connect() as conn:
        record = conn.execute(
            """
            SELECT * FROM password_resets 
            WHERE target_email = ? AND used_at IS NULL 
            ORDER BY created_at DESC LIMIT 1
            """,
            (target_email,),
        ).fetchone()

        if not record:
            msg = "No active reset request found. Please request a new code."
            return rpc_error(msg, 400) if is_rpc else (jsonify({"error": msg}), 400)

        # Check attempts
        if (record.get("attempts") or 0) >= 5:
            msg = "Too many incorrect attempts. Please request a new code."
            return rpc_error(msg, 400) if is_rpc else (jsonify({"error": msg}), 400)

        # Check expiration
        expires_at_str = str(record.get("expires_at", "")).replace("Z", "+00:00")
        try:
            exp_dt = datetime.fromisoformat(expires_at_str)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                msg = "Verification code has expired. Please request a new code."
                return rpc_error(msg, 400) if is_rpc else (jsonify({"error": msg}), 400)
        except Exception:
            pass

        # Verify hash
        input_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
        if input_hash != record["code_hash"]:
            new_attempts = (record.get("attempts") or 0) + 1
            conn.execute("UPDATE password_resets SET attempts = ? WHERE id = ?", (new_attempts, record["id"]))
            conn.commit()
            remaining = max(0, 5 - new_attempts)
            msg = f"Invalid verification code. {remaining} attempt(s) remaining."
            return rpc_error(msg, 400) if is_rpc else (jsonify({"error": msg}), 400)

        # Code is valid! Update password for user
        new_password_hash = generate_password_hash(new_password)
        conn.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
            (new_password_hash, now_iso(), record["user_id"]),
        )
        # Mark reset as used
        conn.execute(
            "UPDATE password_resets SET used_at = ? WHERE id = ?",
            (now_iso(), record["id"]),
        )
        # Invalidate sessions for security
        conn.execute(
            "DELETE FROM sessions WHERE user_id = ?",
            (record["user_id"],),
        )
        conn.commit()

    data = {
        "ok": True,
        "message": "Password updated successfully. You can now log in with your new password.",
    }
    return rpc_response(data) if is_rpc else jsonify(data)
