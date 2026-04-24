from dotenv import load_dotenv

from database import init_db
from fleet_backend.common import seed_owner
from fleet_backend.server import app

# Import route modules for side effects (route registration).
from fleet_backend.routes import accountant, analytics, auth, members, notifications, system  # noqa: F401


def create_app():
    load_dotenv()
    init_db()
    seed_owner()
    return app
