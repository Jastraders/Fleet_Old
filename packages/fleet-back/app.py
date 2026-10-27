from urllib.parse import urlparse
import os

from flask import request
from fleet_backend import create_app
from flask_cors import CORS

app = create_app()

# Default production and staging origins
DEFAULT_ALLOWED_ORIGINS = [
    "https://staging.jasfleet.cloud",
    "https://staging-api.jasfleet.cloud",
    "https://fleet-staging.web.app",
    "https://staging-dot-fleet-494408.uc.r.appspot.com",
    "https://api.jasfleet.cloud",
    "https://jasfleet.cloud",
    "https://fleet-494408.web.app",
    "https://fleet-494408.firebaseapp.com",
    "https://fleetold-production.up.railway.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
]

env_origins = os.getenv("ALLOWED_ORIGINS")
if env_origins:
    ALLOWED_ORIGINS = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
    for origin in DEFAULT_ALLOWED_ORIGINS:
        if origin not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(origin)
else:
    ALLOWED_ORIGINS = DEFAULT_ALLOWED_ORIGINS


def is_origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    if origin in ALLOWED_ORIGINS:
        return True
    try:
        parsed = urlparse(origin)
        host = parsed.hostname or ""
        if host in ("localhost", "127.0.0.1"):
            return True
        if host == "jasfleet.cloud" or host.endswith(".jasfleet.cloud"):
            return True
        if host.endswith(".web.app") or host.endswith(".firebaseapp.com") or host.endswith(".appspot.com"):
            return True
    except Exception:
        pass
    return False


CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=True)


@app.after_request
def handle_options(response):
    origin = request.headers.get("Origin")
    if is_origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    else:
        response.headers["Access-Control-Allow-Origin"] = ""

    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3001")), debug=True)

