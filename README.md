# Fleet (React + Flask)

This repository runs **without Docker**.

## Prerequisites

- [Bun](https://bun.sh/) (for the frontend workspace and monorepo scripts)
- Python 3.10+

## 1) Run the Flask backend

```bash
cd packages/fleet-back
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Backend runs on `http://localhost:3001`.

## 2) Run the React frontend

Open a second terminal:

```bash
cd /path/to/Fleet_Old
bun install
bun --cwd packages/fleet-front dev
```

Frontend runs on `http://localhost:3000`.

## 3) Sign in

- Email: `owner@fleet.dev`
- Password: `password`

## Notes

- Start backend first, then frontend.
- If your environment blocks package downloads, install dependencies in a network-enabled environment before running.
