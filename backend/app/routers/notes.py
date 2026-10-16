"""A project's log: dated notes, newest first. Anyone who may edit the project can add one;
only the author can reword it; the author or a role with delete rights can remove it."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth
from app.auth import current_user
from app.db import get_session
from app.models import ProjectNote, User
from app.routers.projects import get_visible_project
from app.schemas import NoteBody, NoteRead

router = APIRouter(tags=["notes"])


def get_note(session: Session, note_id: int, user: User) -> ProjectNote:
    note = session.get(ProjectNote, note_id)
    # A note on a project you can't see doesn't exist as far as you're concerned
    if note is None or not auth.can_see(user, note.project):
        raise HTTPException(404, "Note not found")
    return note


@router.post("/projects/{project_id}/notes", response_model=NoteRead, status_code=201)
def add_note(
    project_id: int, body: NoteBody, session: Session = Depends(get_session), user: User = Depends(current_user)
):
    auth.check(auth.can_edit(user, get_visible_project(session, project_id, user)))
    note = ProjectNote(project_id=project_id, author_id=user.id, body=body.body)
    session.add(note)
    session.commit()
    session.refresh(note)
    return note


@router.patch("/notes/{note_id}", response_model=NoteRead)
def edit_note(note_id: int, body: NoteBody, session: Session = Depends(get_session), user: User = Depends(current_user)):
    note = get_note(session, note_id, user)
    auth.check(note.author_id == user.id)
    note.body = body.body
    note.edited_at = datetime.now(timezone.utc)
    session.commit()
    return note


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    note = get_note(session, note_id, user)
    auth.check(note.author_id == user.id or auth.can_delete(user, note.project))
    session.delete(note)
    session.commit()
