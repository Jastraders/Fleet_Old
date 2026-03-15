# Fleet Backend (Flask + SQLite)

This backend was migrated from Bun + oRPC + TimescaleDB to Python Flask with a SQLite database.

## Run locally

```bash
cd packages/fleet-back
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Server runs on `http://localhost:3001`.

## Run with the React frontend (separate terminal)

From repository root:

```bash
bun install
bun --cwd packages/fleet-front dev
```

Frontend runs on `http://localhost:3000`.

## Default seed user

- Email: `owner@fleet.dev`
- Password: `password`

## REST endpoints

- `POST /api/auth/sign-in`
- `POST /api/auth/sign-out`
- `GET /api/auth/me`
- `GET|POST /api/vehicles`
- `GET|PUT|DELETE /api/vehicles/:id`
- `GET|POST /api/expense-categories`
- `GET|PUT|DELETE /api/expense-categories/:id`
- `GET|POST /api/journal-entries`
- `GET|PUT|DELETE /api/journal-entries/:id`
- `GET|POST /api/admin/members`
- `GET|PUT|DELETE /api/admin/members/:id`
- `GET /api/analytics/summary`

## Backend structure

```
packages/fleet-back/
├── app.py                      # Entrypoint (WSGI app bootstrap)
├── database.py                 # SQLite connection + schema setup
└── fleet_backend/
    ├── __init__.py             # Application factory
    ├── server.py               # Flask app instance
    ├── common.py               # Shared auth/rpc/serialization/analytics helpers
    └── routes/
        ├── auth.py             # Authentication endpoints
        ├── accountant.py       # Vehicles, categories, journal entry endpoints
        ├── members.py          # Admin member management endpoints
        ├── analytics.py        # Fleet + vehicle analytics endpoints
        └── system.py           # Health/root endpoint
```
