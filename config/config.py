"""Project configuration definitions.

This module is reserved for centralized configuration management.
No runtime configuration logic is implemented at the current stage.
"""

from datetime import datetime, timedelta

MYSQL_CONFIG = {
    "host": "localhost",
    "port": 3307,
    "user": "root",
    "password": "ylovecy",
    "database": "talent_map",
    "charset": "utf8mb4",
}

PUBLISH_CUTOFF = (datetime.now() - timedelta(days=60)).replace(
    hour=0, minute=0, second=0, microsecond=0
)
