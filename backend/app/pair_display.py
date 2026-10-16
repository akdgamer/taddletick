"""Make a one-time code that pairs a browser as USERNAME's desk display.

    docker compose -f docker-compose.prod.yml exec app python -m app.pair_display USERNAME

The code works once, within 10 minutes; enter it on the display (or open /?display=1&pair=CODE).
"""

import secrets
import sys
from datetime import datetime, timedelta, timezone

from app.db import SessionLocal
from app.models import DisplayPairing
from app.routers.auth import find_user
from app.routers.display import code_hash

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I to misread


def main(username: str) -> None:
    with SessionLocal() as session:
        user = find_user(session, username)
        if user is None or not user.is_active:
            sys.exit(f"No active user called {username!r}")
        code = "".join(secrets.choice(ALPHABET) for _ in range(8))
        session.add(DisplayPairing(code_hash=code_hash(code), user_id=user.id,
                                   expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)))
        session.commit()
    print(f"{code[:4]}-{code[4:]}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
