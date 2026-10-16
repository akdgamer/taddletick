import re
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import activity, auth
from app.auth import current_user
from app.config import settings
from app.db import get_session
from app.models import ProjectFile, User
from app.routers.projects import get_visible_project
from app.schemas import FileRead

router = APIRouter(tags=["files"])

MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB per file


def project_dir(project_id: int) -> Path:
    return settings.files_dir / f"project-{project_id}"


def size_text(size: int) -> str:
    return f"{size / 1024 / 1024:.1f} MB" if size >= 1024 * 1024 else f"{max(1, round(size / 1024))} KB"


def safe_name(filename: str) -> str:
    """Keep names readable on the NAS but free of path tricks and odd characters."""
    name = Path(filename).name.strip() or "file"
    return re.sub(r"[^\w.\- ()]+", "_", name)[:150]


@router.post("/projects/{project_id}/files", response_model=FileRead, status_code=201)
def upload_file(
    project_id: int, upload: UploadFile, session: Session = Depends(get_session), user: User = Depends(current_user)
):
    auth.check(auth.can_edit(user, get_visible_project(session, project_id, user)))
    folder = project_dir(project_id)
    folder.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex[:8]}-{safe_name(upload.filename or 'file')}"
    path = folder / stored_name
    size = 0
    try:
        with path.open("wb") as out:
            while chunk := upload.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "File is larger than 200 MB")
                out.write(chunk)
    except BaseException:
        path.unlink(missing_ok=True)
        raise

    record = ProjectFile(
        project_id=project_id,
        filename=Path(upload.filename or "file").name,
        stored_name=stored_name,
        content_type=upload.content_type or "application/octet-stream",
        size=size,
    )
    session.add(record)
    activity.record(session, user, get_visible_project(session, project_id, user),
                    f"uploaded {record.filename} ({size_text(size)})", kind="file")
    session.commit()
    session.refresh(record)
    return record


def get_file_or_404(session: Session, file_id: int, user: User) -> ProjectFile:
    record = session.get(ProjectFile, file_id)
    if record is None or not auth.can_see(user, record.project):
        raise HTTPException(404, "File not found")
    return record


@router.get("/files/{file_id}")
def download_file(file_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    record = get_file_or_404(session, file_id, user)
    path = project_dir(record.project_id) / record.stored_name
    if not path.exists():
        raise HTTPException(410, "The file record exists but the file is missing from storage")
    # inline: PDFs and images open in the browser; other types download
    return FileResponse(path, media_type=record.content_type, filename=record.filename, content_disposition_type="inline")


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    record = get_file_or_404(session, file_id, user)
    auth.check(auth.can_delete(user, record.project))
    (project_dir(record.project_id) / record.stored_name).unlink(missing_ok=True)
    activity.record(session, user, record.project, f"deleted file {record.filename}", kind="file")
    session.delete(record)
    session.commit()


def delete_project_files(project_id: int) -> None:
    """Called when a project is deleted, so its folder doesn't linger on the NAS."""
    shutil.rmtree(project_dir(project_id), ignore_errors=True)
