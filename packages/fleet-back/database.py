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
                color TEXT NOT NULL UNIQUE,
                created_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS expense_category (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL UNIQUE,
                impact TEXT NOT NULL DEFAULT 'company' CHECK(impact IN ('company','driver')),
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
                expense_category_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
                FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
                FOREIGN KEY(expense_category_id) REFERENCES expense_category(id) ON DELETE SET NULL
            );
            """
        )

        # Lightweight forward-only migrations for existing DBs.
        category_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(expense_category)").fetchall()
        }
        if "impact" not in category_columns:
            conn.execute(
                "ALTER TABLE expense_category ADD COLUMN impact TEXT NOT NULL DEFAULT 'company' CHECK(impact IN ('company','driver'))"
            )

        journal_entry_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(journal_entries)").fetchall()
        }
        if "driver_id" not in journal_entry_columns:
            conn.execute("ALTER TABLE journal_entries ADD COLUMN driver_id TEXT")

        driver_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(drivers)").fetchall()
        }
        if "total_expense" not in driver_columns:
            conn.execute("ALTER TABLE drivers ADD COLUMN total_expense REAL NOT NULL DEFAULT 0")

        conn.commit()


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]
