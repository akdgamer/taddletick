"""Background worker: pushes changes to Google every SYNC_INTERVAL_SECONDS.

Run with `python -m app.worker` (its own container in production).
"""

import logging
import time

from app import google_sync
from app.config import settings
from app.db import SessionLocal

log = logging.getLogger("worker")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log.info("Google sync worker started; every %ss", settings.sync_interval_seconds)
    while True:
        with SessionLocal() as session:
            for user in google_sync.connected_users(session):
                # One person's broken Google connection mustn't stop the others syncing
                try:
                    log.info("sync %s: %s", user.username, google_sync.sync_once(session, user))
                except Exception:
                    log.exception("sync for %s failed; will retry next interval", user.username)
        time.sleep(settings.sync_interval_seconds)


if __name__ == "__main__":
    main()
