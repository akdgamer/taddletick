from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import google_sync
from app.config import settings
from app.db import get_session

router = APIRouter(prefix="/google", tags=["google"])


class GoogleStatus(BaseModel):
    configured: bool  # client file present on the server
    connected: bool  # an account has been authorised
    last_sync_at: datetime | None
    last_error: str | None
    redirect_uri: str


def back_to_app(result: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.frontend_url}/?page=settings&google={result}")


@router.get("/status", response_model=GoogleStatus)
def status(session: Session = Depends(get_session)):
    account = google_sync.get_account(session)
    session.commit()
    return GoogleStatus(
        configured=google_sync.is_configured(),
        connected=bool(account.token_json),
        last_sync_at=account.last_sync_at,
        last_error=account.last_error,
        redirect_uri=settings.google_redirect_uri,
    )


@router.get("/connect")
def connect(session: Session = Depends(get_session)):
    try:
        return RedirectResponse(google_sync.start_auth(session))
    except google_sync.NotConfigured as e:
        raise HTTPException(409, str(e))


@router.get("/callback")
def callback(state: str = "", code: str = "", error: str = "", session: Session = Depends(get_session)):
    if error or not code:
        return back_to_app("denied")
    try:
        google_sync.finish_auth(session, state, code)
    except Exception as e:
        account = google_sync.get_account(session)
        account.last_error = f"Connecting failed: {e}"[:2000]
        session.commit()
        return back_to_app("error")
    return back_to_app("connected")


@router.post("/sync")
async def sync_now(session: Session = Depends(get_session)):
    try:
        # The Google client library is blocking; keep it off the event loop
        return await run_in_threadpool(google_sync.sync_once, session)
    except Exception as e:
        raise HTTPException(502, f"Sync failed: {e}")


@router.post("/disconnect", status_code=204)
def disconnect(session: Session = Depends(get_session)):
    google_sync.disconnect(session)
