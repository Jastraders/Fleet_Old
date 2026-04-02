import os

from fleet_backend import create_app
from flask_cors import CORS

app = create_app()
CORS(
    app,
    origins=["https://fleetold-production.up.railway.app"],
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3001")), debug=True)
