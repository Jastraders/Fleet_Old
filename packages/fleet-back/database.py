import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).parent / "fleet.db"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                image TEXT,
                created_by TEXT,
                last_login_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS user_roles (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('owner','analyst','accountant','admin')),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                secret_hash TEXT NOT NULL UNIQUE,
                user_id TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS expense_category (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL UNIQUE,
                impact TEXT NOT NULL DEFAULT 'company',
                created_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS drivers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone_number TEXT NOT NULL,
                color TEXT NOT NULL UNIQUE,
                total_expense REAL NOT NULL DEFAULT 0,
                created_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS journal_entries (
                id TEXT PRIMARY KEY,
                vehicle_id TEXT NOT NULL,
                driver_id TEXT,
                notes TEXT,
                created_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
                FOREIGN KEY(driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
                FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
                FOREIGN KEY(expense_category_id) REFERENCES expense_category(id) ON DELETE SET NULL
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(requester_user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(notification_id) REFERENCES notifications(id) ON DELETE SET NULL,
                FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS access_grants (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                page_name TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                action TEXT NOT NULL CHECK(action IN ('edit','delete')),
                granted_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(granted_by) REFERENCES users(id) ON DELETE SET NULL
            );
            """
        )

        # Lightweight forward-only migrations for existing DBs.
        category_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(expense_category)").fetchall()
        }
        user_columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
        if "last_login_at" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN last_login_at TEXT")
        if "impact" not in category_columns:
            conn.execute(
                "ALTER TABLE expense_category ADD COLUMN impact TEXT NOT NULL DEFAULT 'company'"
            )
        expense_category_table_sql = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'expense_category'"
        ).fetchone()
        expense_category_sql = (expense_category_table_sql["sql"] or "") if expense_category_table_sql else ""
        if "CHECK(impact IN ('company','driver'))" in expense_category_sql:
            conn.executescript(
                """
                ALTER TABLE expense_category RENAME TO expense_category_old;
                CREATE TABLE expense_category (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    color TEXT NOT NULL UNIQUE,
                    impact TEXT NOT NULL DEFAULT 'company',
                    created_by TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
                );
                INSERT INTO expense_category (id, name, color, impact, created_by, created_at, updated_at)
                SELECT id, name, color, impact, created_by, created_at, updated_at
                FROM expense_category_old;
                DROP TABLE expense_category_old;
                """
            )
        journal_item_fk_tables = {
            row["table"]
            for row in conn.execute("PRAGMA foreign_key_list(journal_entry_items)").fetchall()
        }
        if "expense_category_old" in journal_item_fk_tables:
            conn.executescript(
                """
                ALTER TABLE journal_entry_items RENAME TO journal_entry_items_old;
                CREATE TABLE journal_entry_items (
                    id TEXT PRIMARY KEY,
                    journal_entry_id TEXT NOT NULL,
                    vehicle_id TEXT NOT NULL,
                    transaction_date TEXT NOT NULL,
                    type TEXT NOT NULL CHECK(type IN ('credit','debit')),
                    amount REAL NOT NULL,
                    expense_category_id TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
                    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
                    FOREIGN KEY(expense_category_id) REFERENCES expense_category(id) ON DELETE SET NULL
                );
                INSERT INTO journal_entry_items (
                    id,
                    journal_entry_id,
                    vehicle_id,
                    transaction_date,
                    type,
                    amount,
                    expense_category_id,
                    created_at
                )
                SELECT
                    id,
                    journal_entry_id,
                    vehicle_id,
                    transaction_date,
                    type,
                    amount,
                    expense_category_id,
                    created_at
                FROM journal_entry_items_old;
                DROP TABLE journal_entry_items_old;
                """
            )

        journal_entry_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(journal_entries)").fetchall()
        }
        if "driver_id" not in journal_entry_columns:
            conn.execute("ALTER TABLE journal_entries ADD COLUMN driver_id TEXT")

        journal_item_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(journal_entry_items)").fetchall()
        }
        if "voucher_id" not in journal_item_columns:
            conn.execute("ALTER TABLE journal_entry_items ADD COLUMN voucher_id INTEGER")
        if "handler" not in journal_item_columns:
            conn.execute("ALTER TABLE journal_entry_items ADD COLUMN handler TEXT")
        if "next_renewal_date" not in journal_item_columns:
            conn.execute("ALTER TABLE journal_entry_items ADD COLUMN next_renewal_date TEXT")

        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entry_items_voucher_id ON journal_entry_items(voucher_id) WHERE voucher_id IS NOT NULL"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_access_grants_unique ON access_grants(user_id,page_name,resource_type,resource_id,action)"
        )

        driver_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(drivers)").fetchall()
        }
        if "total_expense" not in driver_columns:
            conn.execute("ALTER TABLE drivers ADD COLUMN total_expense REAL NOT NULL DEFAULT 0")
        vehicle_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(vehicles)").fetchall()
        }
        if "total_expense" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN total_expense REAL NOT NULL DEFAULT 0")
        if "model" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN model TEXT NOT NULL DEFAULT ''")
        if "year" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN year INTEGER")
        if "renewal" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN renewal TEXT")
        if "renewal_date" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN renewal_date TEXT")
        if "load_capacity" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN load_capacity REAL")
        if "investment_mode" not in vehicle_columns:
            conn.execute(
                "ALTER TABLE vehicles ADD COLUMN investment_mode TEXT NOT NULL DEFAULT 'full_amount'"
            )
        if "total_price" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN total_price REAL")
        if "monthly_emi" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN monthly_emi REAL")
        if "emi_start_date" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN emi_start_date TEXT")
        if "emi_duration_months" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN emi_duration_months INTEGER")
        if "down_payment" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN down_payment REAL")
        if "total_revenue" not in vehicle_columns:
            conn.execute("ALTER TABLE vehicles ADD COLUMN total_revenue REAL NOT NULL DEFAULT 0")
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_category_name_ci ON expense_category(LOWER(name))"
        )

        conn.commit()


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]
