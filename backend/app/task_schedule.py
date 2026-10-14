"""When tasks are due. Pure functions, shared by the API and the Google Tasks sync."""

from datetime import date

from app.models import Recurrence, Task


def occurs_on(task: Task, day: date) -> bool:
    """Whether a task should be on the list for `day`."""
    if task.is_archived or day < task.start_date:
        return False
    match task.recurrence:
        case Recurrence.daily:
            return True
        case Recurrence.weekdays:
            return day.weekday() < 5
        case Recurrence.weekly:
            return day.weekday() == task.start_date.weekday()
        case Recurrence.none:
            # One-off: stays on the list from its start date until done
            return not task.completions or any(c.date == day for c in task.completions)
    return False


def is_done(task: Task, day: date) -> bool:
    if task.recurrence == Recurrence.none:
        return bool(task.completions)
    return any(c.date == day for c in task.completions)


def days_overdue(task: Task, day: date) -> int:
    if task.recurrence != Recurrence.none or is_done(task, day):
        return 0
    return max(0, (day - task.start_date).days)
