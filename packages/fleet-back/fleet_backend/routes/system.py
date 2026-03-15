from flask import jsonify

from fleet_backend.server import app

@app.get("/")
def root():
    return jsonify({"service": "fleet-backend", "stack": "Flask + SQLite"})

