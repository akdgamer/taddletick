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
        try:
            with SessionLocal() as session:
                result = google_sync.sync_once(session)
            log.info("sync: %s", result)
        except Exception:
            log.exception("sync failed; will retry next interval")
        time.sleep(settings.sync_interval_seconds)


if __name__ == "__main__":
    main()
