import os

from fleet_backend import create_app
from flask_cors import CORS


CORS(
    app,
    origins=["https://fleetold-production.up.railway.app"],
    supports_credentials=True
)

@app.after_request
def handle_options(response):
    response.headers["Access-Control-Allow-Origin"] = "https://fleetold-production.up.railway.app"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3001")), debug=True)
