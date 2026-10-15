from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import auth, task_schedule
from app.auth import current_user
from app.db import get_session
from app.models import Project, Recurrence, Task, TaskCompletion, User
from app.routers.dashboard import get_today
from app.schemas import TaskCreate, TaskRead, TaskUpdate, TodayTask

router = APIRouter(prefix="/tasks", tags=["tasks"])


# Everyone has their own tasks; other people's are invisible (404)


def get_task_or_404(session: Session, task_id: int, user: User) -> Task:
    task = session.get(Task, task_id)
    if task is None or task.user_id != user.id:
        raise HTTPException(404, "Task not found")
    return task


def check_project(session: Session, project_id: int | None, user: User) -> None:
    if project_id is None:
        return
    project = session.get(Project, project_id)
    if project is None or not auth.can_see(user, project):
        raise HTTPException(422, f"Unknown project id: {project_id}")


@router.get("", response_model=list[TaskRead])
def list_tasks(archived: bool = False, session: Session = Depends(get_session), user: User = Depends(current_user)):
    return session.scalars(
        select(Task)
        .where(Task.user_id == user.id, Task.is_archived.is_(archived))
        .order_by(Task.recurrence, Task.title)
    ).unique().all()


@router.get("/today", response_model=list[TodayTask])
def today_tasks(
    session: Session = Depends(get_session), today: date = Depends(get_today), user: User = Depends(current_user)
):
    """What's on today's list: open items first (oldest one-offs first), then done ones."""
    mine = session.scalars(select(Task).where(Task.user_id == user.id)).unique().all()
    tasks = [t for t in mine if task_schedule.occurs_on(t, today)]
    items = [
        TodayTask(
            **TaskRead.model_validate(t).model_dump(),
            done=task_schedule.is_done(t, today),
            days_overdue=task_schedule.days_overdue(t, today),
        )
        for t in tasks
    ]
    return sorted(items, key=lambda t: (t.done, -t.days_overdue, t.title.lower()))


@router.post("", response_model=TaskRead, status_code=201)
def create_task(
    body: TaskCreate,
    session: Session = Depends(get_session),
    today: date = Depends(get_today),
    user: User = Depends(current_user),
):
    check_project(session, body.project_id, user)
    task = Task(**body.model_dump(exclude={"start_date"}), start_date=body.start_date or today, user_id=user.id)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: int, body: TaskUpdate, session: Session = Depends(get_session), user: User = Depends(current_user)
):
    task = get_task_or_404(session, task_id, user)
    changes = body.model_dump(exclude_unset=True)
    if "project_id" in changes:
        check_project(session, changes["project_id"], user)
    if changes.get("start_date", "unset") is None:
        raise HTTPException(422, "start_date can't be empty")
    for field, value in changes.items():
        setattr(task, field, value)
    session.commit()
    session.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    session.delete(get_task_or_404(session, task_id, user))
    session.commit()


@router.post("/{task_id}/done", status_code=204)
def mark_done(
    task_id: int,
    session: Session = Depends(get_session),
    today: date = Depends(get_today),
    user: User = Depends(current_user),
):
    get_task_or_404(session, task_id, user)
    if session.get(TaskCompletion, (task_id, today)) is None:
        session.add(TaskCompletion(task_id=task_id, date=today))
        session.commit()


@router.delete("/{task_id}/done", status_code=204)
def mark_not_done(
    task_id: int,
    session: Session = Depends(get_session),
    today: date = Depends(get_today),
    user: User = Depends(current_user),
):
    task = get_task_or_404(session, task_id, user)
    # For a one-off, undo the completion whenever it happened; for recurring, just today's
    if task.recurrence == Recurrence.none:
        undo = list(task.completions)
    else:
        undo = [c for c in task.completions if c.date == today]
    for completion in undo:
        session.delete(completion)
    session.commit()
