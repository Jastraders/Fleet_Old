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

## Default seed user

- Email: `owner@fleet.dev`
- Password: `password`

## REST endpoints

- `POST /api/auth/sign-in`
- `POST /api/auth/sign-out`
- `GET /api/auth/me`
- `GET|POST /api/vehicles`
- `GET|POST /api/expense-categories`
- `GET|POST /api/journal-entries`
- `GET|POST /api/admin/members`
- `GET /api/analytics/summary`
