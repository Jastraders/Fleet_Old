import logging
import os
from typing import Any, Iterable, List, Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import psycopg2
import psycopg2.extras

log = logging.getLogger(__name__)


# Accept several environment variable names for flexibility
DB_ENV_NAMES = ("SUPABASE_DATABASE_URL", "DATABASE_URL", "SUPABASE_DB_URL")
DATABASE_URL = None
for name in DB_ENV_NAMES:
    val = os.getenv(name)
    if val:
        DATABASE_URL = val
        log.info("Found database URL in env %s (masked len=%d)", name, len(val))
        break

if not DATABASE_URL:
    log.error("No database URL found in environment (tried %s)", ",".join(DB_ENV_NAMES))
    raise RuntimeError("DATABASE_URL (Supabase Postgres connection string) is not set")

# Ensure SSL mode is required for Supabase if not explicitly set in the URL query
try:
    parsed = urlparse(DATABASE_URL)
    qs = parse_qs(parsed.query)
    if "sslmode" not in qs:
        qs["sslmode"] = ["require"]
        new_query = urlencode({k: v[0] for k, v in qs.items()})
        DATABASE_URL = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))
        log.debug("Added sslmode=require to DATABASE_URL")
except Exception:
    log.exception("Failed to parse/modify DATABASE_URL; will try to connect as-is")


class CursorWrapper:
    def __init__(self, cur: psycopg2.extensions.cursor):
        self._cur = cur

    def fetchone(self) -> Optional[dict]:
        row = self._cur.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self) -> List[dict]:
        rows = self._cur.fetchall()
        return [dict(r) for r in rows]


class PGConnection:
    """Light wrapper to provide a sqlite3-like `connect()` object used by the app.

    It supports `with connect() as conn:` and `conn.execute(sql, params)` returning
    an object with `.fetchone()` / `.fetchall()` that yield dicts, and `conn.commit()`.
    """

    def __init__(self, conn: psycopg2.extensions.connection):
        self._conn = conn
        self._cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type:
                self._conn.rollback()
            else:
                self._conn.commit()
        finally:
            try:
                self._cur.close()
            except Exception:
                pass
            try:
                self._conn.close()
            except Exception:
                pass

    def execute(self, sql: str, params: Optional[Iterable[Any]] = None) -> CursorWrapper:
        # translate sqlite '?' placeholders to psycopg2 '%s'
        if params is None:
            params = ()
        sql2 = sql.replace("?", "%s")
        self._cur.execute(sql2, tuple(params))
        return CursorWrapper(self._cur)

    def commit(self):
        self._conn.commit()


def connect() -> PGConnection:
    conn = psycopg2.connect(DATABASE_URL)
    return PGConnection(conn)


def init_db() -> None:
    # Create tables if they don't exist. Keep types similar to sqlite (TEXT, INTEGER, REAL)
    sql = """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        image TEXT,
        created_by TEXT,
        last_login_at TEXT,
        created_at TEXT DEFAULT now()::text,
        updated_at TEXT DEFAULT now()::text
    );

    CREATE TABLE IF NOT EXISTS user_roles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner','analyst','accountant','admin')),
        created_at TEXT DEFAULT now()::text
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        secret_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        created_at TEXT DEFAULT now()::text
    );

    CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        license_plate TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT '',
        year INTEGER,
        renewal TEXT,
        renewal_date TEXT,
        load_capacity REAL,
        investment_mode TEXT NOT NULL DEFAULT 'full_amount' CHECK(investment_mode IN ('full_amount','full_loan','flexible')),
        total_price REAL,
        monthly_emi REAL,
        emi_start_date TEXT,
        emi_duration_months INTEGER,
        down_payment REAL,
        total_revenue REAL NOT NULL DEFAULT 0,
        color TEXT NOT NULL UNIQUE,
        total_expense REAL NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at TEXT DEFAULT now()::text,
        updated_at TEXT DEFAULT now()::text
    );

    CREATE TABLE IF NOT EXISTS expense_category (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL UNIQUE,
        impact TEXT NOT NULL DEFAULT 'company',
        created_by TEXT,
        created_at TEXT DEFAULT now()::text,
        updated_at TEXT DEFAULT now()::text
    );

    CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        color TEXT NOT NULL UNIQUE,
        total_expense REAL NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at TEXT DEFAULT now()::text,
        updated_at TEXT DEFAULT now()::text
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        driver_id TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT now()::text,
        updated_at TEXT DEFAULT now()::text
    );

    CREATE TABLE IF NOT EXISTS journal_entry_items (
        id TEXT PRIMARY KEY,
        journal_entry_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        transaction_date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('credit','debit')),
        amount REAL NOT NULL,
        voucher_id INTEGER UNIQUE,
        handler TEXT,
        next_renewal_date TEXT,
        expense_category_id TEXT,
        created_at TEXT DEFAULT now()::text
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        recipient_user_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        metadata TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT now()::text
    );

    CREATE TABLE IF NOT EXISTS access_requests (
        id TEXT PRIMARY KEY,
        requester_user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','allowed','denied')),
        page_name TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        primary_label TEXT NOT NULL,
        requested_actions TEXT NOT NULL,
        notification_id TEXT,
        reviewed_by TEXT,
        created_at TEXT DEFAULT now()::text,
        updated_at TEXT DEFAULT now()::text
    );

    CREATE TABLE IF NOT EXISTS access_grants (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        page_name TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('edit','delete')),
        granted_by TEXT,
        created_at TEXT DEFAULT now()::text
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entry_items_voucher_id ON journal_entry_items(voucher_id) WHERE voucher_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_access_grants_unique ON access_grants(user_id, page_name, resource_type, resource_id, action);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_category_name_ci ON expense_category(LOWER(name));
    """

    with connect() as conn:
        conn.execute(sql)


def rows_to_dicts(rows: Iterable[dict]) -> List[dict[str, Any]]:
    return [dict(r) for r in rows]
