"""Compatibility exports; JWT validation uses the shared guard."""
from auth_guard import require_user as require_login, require_admin
