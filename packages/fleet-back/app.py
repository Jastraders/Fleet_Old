import os

from flask import request
from fleet_backend import create_app
from flask_cors import CORS

app = create_app()

# Allowed origins: add your Firebase Hosting domains and keep existing origins if needed
ALLOWED_ORIGINS = [
    "https://fleetold-production.up.railway.app",
    "https://fleet-494408.web.app",
    "https://fleet-494408.firebaseapp.com",
    "https://api.jasfleet.cloud",
    "https://jasfleet.cloud"
]

CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=True)


@app.after_request
def handle_options(response):
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
    else:
        # fall back to no specific origin to avoid exposing to unknown origins
        response.headers["Access-Control-Allow-Origin"] = ""

    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3001")), debug=True)
