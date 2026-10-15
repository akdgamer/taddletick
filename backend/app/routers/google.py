from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import google_sync
from app.auth import current_user
from app.config import settings
from app.db import get_session
from app.models import User

router = APIRouter(prefix="/google", tags=["google"])
# Google redirects the browser here; the random state (not the login cookie)
# says whose sign-in it is, so it works even if the cookie isn't sent
callback_router = APIRouter(prefix="/google", tags=["google"])


class GoogleStatus(BaseModel):
    configured: bool  # client file present on the server
    connected: bool  # this user has authorised an account
    last_sync_at: datetime | None
    last_error: str | None
    redirect_uri: str


def back_to_app(result: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.frontend_url}/?page=settings&google={result}")


@router.get("/status", response_model=GoogleStatus)
def status(session: Session = Depends(get_session), user: User = Depends(current_user)):
    account = google_sync.get_account(session, user)
    session.commit()
    return GoogleStatus(
        configured=google_sync.is_configured(),
        connected=bool(account.token_json),
        last_sync_at=account.last_sync_at,
        last_error=account.last_error,
        redirect_uri=settings.google_redirect_uri,
    )


@router.get("/connect")
def connect(session: Session = Depends(get_session), user: User = Depends(current_user)):
    try:
        return RedirectResponse(google_sync.start_auth(session, user))
    except google_sync.NotConfigured as e:
        raise HTTPException(409, str(e))


@callback_router.get("/callback")
def callback(state: str = "", code: str = "", error: str = "", session: Session = Depends(get_session)):
    if error or not code:
        return back_to_app("denied")
    try:
        google_sync.finish_auth(session, state, code)
    except Exception as e:
        session.rollback()
        account = google_sync.account_for_state(session, state)
        if account:
            account.last_error = f"Connecting failed: {e}"[:2000]
            session.commit()
        return back_to_app("error")
    return back_to_app("connected")


@router.post("/sync")
async def sync_now(session: Session = Depends(get_session), user: User = Depends(current_user)):
    try:
        # The Google client library is blocking; keep it off the event loop
        return await run_in_threadpool(google_sync.sync_once, session, user)
    except Exception as e:
        raise HTTPException(502, f"Sync failed: {e}")


@router.post("/disconnect", status_code=204)
def disconnect(session: Session = Depends(get_session), user: User = Depends(current_user)):
    google_sync.disconnect(session, user)
