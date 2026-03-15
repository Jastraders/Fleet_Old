import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any

from flask import jsonify, request
from werkzeug.security import generate_password_hash

from database import connect, rows_to_dicts

SESSION_TTL_DAYS = 30
PERIODS = {"all_time", "last_7d", "last_30d", "last_6m", "last_12m"}
VEHICLE_PERIODS = {"all_time", "last_30d", "last_3m", "last_6m", "last_9m", "last_12m"}

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


def vehicle_period_start(period: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    if period == "last_30d":
        return now - timedelta(days=30)
    if period == "last_3m":
        return now - timedelta(days=91)
    if period == "last_6m":
        return now - timedelta(days=183)
    if period == "last_9m":
        return now - timedelta(days=274)
    if period == "last_12m":
        return now - timedelta(days=365)
    return None


def period_bounds(period: str) -> tuple[datetime | None, datetime | None, datetime | None]:
    if period == "all_time":
        return None, None, None
    now = datetime.now(timezone.utc)
    current_start = period_start(period)
    if not current_start:
        return None, None, None
    span = now - current_start
    previous_end = current_start
    previous_start = previous_end - span
    return current_start, previous_start, previous_end


def vehicle_period_bounds(period: str) -> tuple[datetime | None, datetime | None, datetime | None]:
    if period == "all_time":
        return None, None, None
    now = datetime.now(timezone.utc)
    current_start = vehicle_period_start(period)
    if not current_start:
        return None, None, None
    span = now - current_start
    previous_end = current_start
    previous_start = previous_end - span
    return current_start, previous_start, previous_end


def calculate_percentage_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return 100.0 if current > 0 else None
    return ((current - previous) / previous) * 100


def sum_amount(
    conn,
    entry_type: str,
    start: datetime | None = None,
    end: datetime | None = None,
    vehicle_id: str | None = None,
) -> float:
    conditions = ["type = ?"]
    params: list[Any] = [entry_type]
    if start is not None:
        conditions.append("transaction_date >= ?")
        params.append(start.isoformat())
    if end is not None:
        conditions.append("transaction_date < ?")
        params.append(end.isoformat())
    if vehicle_id is not None:
        conditions.append("vehicle_id = ?")
        params.append(vehicle_id)
    row = conn.execute(
        f"SELECT COALESCE(SUM(amount), 0) AS total FROM journal_entry_items WHERE {' AND '.join(conditions)}",
        tuple(params),
    ).fetchone()
    return float(row["total"] or 0)


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


def rpc_error(message: str, status: int):
    return rpc_response({"message": message}, status)




def to_iso_datetime(value: str | None) -> str | None:
    if not value:
        return value
    return value.replace(" ", "T")


def serialize_vehicle_row(vehicle: dict[str, Any]) -> dict[str, Any]:
    created_by_user = None
    if vehicle.get("created_by"):
        created_by_user = {
            "id": vehicle["created_by"],
            "name": vehicle.get("created_by_name") or "",
            "image": vehicle.get("created_by_image"),
        }

    return {
        "id": vehicle["id"],
        "name": vehicle["name"],
        "licensePlate": vehicle["license_plate"],
        "color": vehicle.get("color"),
        "createdBy": vehicle.get("created_by"),
        "createdAt": to_iso_datetime(vehicle.get("created_at")),
        "updatedAt": to_iso_datetime(vehicle.get("updated_at")),
        "createdByUser": created_by_user,
    }


def serialize_expense_category_row(category: dict[str, Any]) -> dict[str, Any]:
    created_by_user = None
    if category.get("created_by"):
        created_by_user = {
            "id": category["created_by"],
            "name": category.get("created_by_name") or "",
            "image": category.get("created_by_image"),
        }

    return {
        "id": category["id"],
        "name": category["name"],
        "color": category.get("color"),
        "createdBy": category.get("created_by"),
        "createdAt": to_iso_datetime(category.get("created_at")),
        "updatedAt": to_iso_datetime(category.get("updated_at")),
        "createdByUser": created_by_user,
    }


def serialize_journal_item_row(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item["id"],
        "journalEntryId": item["journal_entry_id"],
        "vehicleId": item["vehicle_id"],
        "transactionDate": to_iso_datetime(item.get("transaction_date")),
        "type": item["type"],
        "amount": item["amount"],
        "expenseCategoryId": item.get("expense_category_id"),
        "createdAt": to_iso_datetime(item.get("created_at")),
    }


def serialize_journal_entry_row(entry: dict[str, Any], items: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    created_by_user = None
    if entry.get("created_by"):
        created_by_user = {
            "id": entry["created_by"],
            "name": entry.get("created_by_name") or "",
            "image": entry.get("created_by_image"),
        }

    vehicle = None
    if entry.get("vehicle_id"):
        vehicle = {
            "id": entry["vehicle_id"],
            "name": entry.get("vehicle_name") or "",
            "licensePlate": entry.get("vehicle_license_plate"),
        }

    payload = {
        "id": entry["id"],
        "vehicleId": entry["vehicle_id"],
        "notes": entry.get("notes"),
        "createdBy": entry.get("created_by"),
        "createdAt": to_iso_datetime(entry.get("created_at")),
        "updatedAt": to_iso_datetime(entry.get("updated_at")),
        "createdByUser": created_by_user,
        "vehicle": vehicle,
    }
    if items is not None:
        payload["items"] = [serialize_journal_item_row(item) for item in items]
    return payload

def serialize_member_row(member: dict[str, Any], roles: list[dict[str, Any]]):
    created_by_user = None
    if member.get("created_by"):
        created_by_user = {
            "id": member["created_by"],
            "name": member.get("created_by_name") or "",
            "image": member.get("created_by_image"),
        }

    return {
        "id": member["id"],
        "name": member["name"],
        "email": member["email"],
        "image": member.get("image"),
        "createdAt": member["created_at"],
        "updatedAt": member["updated_at"],
        "createdByUser": created_by_user,
        "roles": roles,
    }
