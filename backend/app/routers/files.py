import mimetypes
import re
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps
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


def content_type_of(upload: UploadFile) -> str:
    """What the browser said it is; if it didn't know, a guess from the file's extension."""
    given = (upload.content_type or "").split(";")[0].strip().lower()
    if given and given != "application/octet-stream":
        return given
    return mimetypes.guess_type(upload.filename or "")[0] or "application/octet-stream"


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
        content_type=content_type_of(upload),
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


# Only these open in the browser; anything else (HTML, SVG, office files...) always downloads, so an
# uploaded file can never run script on our site. The type comes from the uploader, hence nosniff.
INLINE_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp",
    "application/pdf", "text/plain", "text/csv",
}
THUMBNAIL_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"}
THUMBNAIL_PX = 480
# Shown inside our page, but with no right to run anything (not for PDFs: the browser's viewer needs scripts)
SANDBOX = "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'"


def opens_in_browser(content_type: str) -> bool:
    return content_type in INLINE_TYPES or content_type.split("/")[0] in ("video", "audio")


def stored_path(record: ProjectFile) -> Path:
    path = project_dir(record.project_id) / record.stored_name
    if not path.exists():
        raise HTTPException(410, "The file record exists but the file is missing from storage")
    return path


@router.get("/files/{file_id}")
def download_file(
    file_id: int, download: bool = False, session: Session = Depends(get_session), user: User = Depends(current_user)
):
    record = get_file_or_404(session, file_id, user)
    path = stored_path(record)
    headers = {"X-Content-Type-Options": "nosniff"}
    if download or not opens_in_browser(record.content_type):
        return FileResponse(path, media_type="application/octet-stream", filename=record.filename,
                            content_disposition_type="attachment", headers=headers)
    media_type = record.content_type
    if media_type.startswith("text/"):
        media_type = "text/plain; charset=utf-8"  # shown as text, never interpreted
    if record.content_type != "application/pdf":
        headers["Content-Security-Policy"] = SANDBOX
    return FileResponse(path, media_type=media_type, filename=record.filename,
                        content_disposition_type="inline", headers=headers)


@router.get("/files/{file_id}/thumbnail")
def thumbnail(file_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    """A small WebP of a photo for the file grid; made on first request and kept next to the file."""
    record = get_file_or_404(session, file_id, user)
    if record.content_type not in THUMBNAIL_TYPES:
        raise HTTPException(404, "No thumbnail for this kind of file")
    source = stored_path(record)
    thumb = thumbnail_path(record)
    if not thumb.exists() or thumb.stat().st_mtime < source.stat().st_mtime:
        try:
            make_thumbnail(source, thumb)
        except (OSError, Image.DecompressionBombError):
            raise HTTPException(415, "Couldn't read this image")
    return FileResponse(thumb, media_type="image/webp",
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=604800"})


def thumbnail_path(record: ProjectFile) -> Path:
    return project_dir(record.project_id) / ".thumbs" / f"{record.stored_name}.webp"


def make_thumbnail(source: Path, target: Path) -> None:
    target.parent.mkdir(exist_ok=True)
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)  # phone photos come out the right way up
        image.thumbnail((THUMBNAIL_PX, THUMBNAIL_PX))
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info or image.mode in ("LA", "P") else "RGB")
        tmp = target.with_suffix(".tmp")
        image.save(tmp, "WEBP", quality=80)
        tmp.replace(target)


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    record = get_file_or_404(session, file_id, user)
    auth.check(auth.can_delete(user, record.project))
    (project_dir(record.project_id) / record.stored_name).unlink(missing_ok=True)
    thumbnail_path(record).unlink(missing_ok=True)
    activity.record(session, user, record.project, f"deleted file {record.filename}", kind="file")
    session.delete(record)
    session.commit()


def delete_project_files(project_id: int) -> None:
    """Called when a project is deleted, so its folder doesn't linger on the NAS."""
    shutil.rmtree(project_dir(project_id), ignore_errors=True)
