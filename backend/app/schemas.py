"""Shapes of the JSON going in and out of the API (the contract React codes against)."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import ProjectLabel, Recurrence, StageStatus
from app.urgency import Flag


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# Users and roles

class RoleFields(BaseModel):
    is_admin: bool = False
    can_edit: bool = False
    can_delete: bool = False
    can_view_payments: bool = False
    can_edit_payments: bool = False


class RoleCreate(RoleFields):
    name: str = Field(min_length=1, max_length=100)


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_admin: bool | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_view_payments: bool | None = None
    can_edit_payments: bool | None = None


class RoleRead(RoleFields, ORMModel):
    id: int
    name: str


class UserRef(ORMModel):
    id: int
    display_name: str


class UserRead(ORMModel):
    id: int
    username: str
    display_name: str
    role: RoleRead
    is_active: bool


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=100, pattern=r"^[A-Za-z0-9_.-]+$")
    display_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    role_id: int


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    role_id: int | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=200)  # admin reset


class SetupBody(BaseModel):
    username: str = Field(min_length=2, max_length=100, pattern=r"^[A-Za-z0-9_.-]+$")
    display_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=200)


class LoginBody(BaseModel):
    username: str
    password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=200)


# Clients and contacts

class ClientRef(ORMModel):
    id: int
    name: str


class ClientBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = ""
    notes: str = ""


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = None
    notes: str | None = None


class ContactBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    client_id: int | None = None
    role: str = ""
    phone: str = ""
    email: str = ""
    notes: str = ""


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    client_id: int | None = None
    role: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None


class ContactRead(ContactBase, ORMModel):
    id: int
    client: ClientRef | None


class ClientRead(ClientBase, ORMModel):
    id: int
    contacts: list[ContactRead]


# Stage types (catalog)

class StageTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class StageTypeRead(ORMModel):
    id: int
    name: str
    sort_order: int


# Project stages

class ProjectStageCreate(BaseModel):
    stage_type_id: int
    status: StageStatus = StageStatus.not_started
    due_date: date | None = None
    notes: str = ""


class ProjectStageUpdate(BaseModel):
    status: StageStatus | None = None
    due_date: date | None = None
    notes: str | None = None
    position: int | None = None


class ProjectStageRead(ORMModel):
    id: int
    stage_type_id: int
    name: str
    status: StageStatus
    due_date: date | None
    notes: str
    position: int
    contacts: list[ContactRead]


# Payments

class PaymentCreate(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    expected_amount: float = Field(gt=0)
    due_date: date | None = None
    received_amount: float = Field(default=0, ge=0)
    received_date: date | None = None
    notes: str = ""


class PaymentUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    expected_amount: float | None = Field(default=None, gt=0)
    due_date: date | None = None
    received_amount: float | None = Field(default=None, ge=0)
    received_date: date | None = None
    notes: str | None = None


class PaymentRead(PaymentCreate, ORMModel):
    id: int
    project_id: int
    is_paid: bool


# Files

class FileRead(ORMModel):
    id: int
    filename: str
    content_type: str
    size: int
    uploaded_at: datetime


# Project notes log

class NoteBody(BaseModel):
    body: str = Field(min_length=1, max_length=5000)

    @field_validator("body")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Write something first")
        return v.strip()


class NoteRead(ORMModel):
    id: int
    project_id: int
    body: str
    author: UserRef | None
    created_at: datetime
    edited_at: datetime | None


# Projects

class ProjectRef(ORMModel):
    id: int
    name: str
    is_completed: bool


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    client_id: int | None = None
    po_number: str | None = None
    label: ProjectLabel = ProjectLabel.company
    is_p0: bool = False
    dispatch_date: date | None = None
    notes: str = ""


class ProjectCreate(ProjectBase):
    # Stages picked from the catalog, in the order given
    stage_type_ids: list[int] = []
    # Restrict a company project to these roles (admins only); empty = everyone
    allowed_role_ids: list[int] = []


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    client_id: int | None = None
    po_number: str | None = None
    label: ProjectLabel | None = None
    is_p0: bool | None = None
    dispatch_date: date | None = None
    notes: str | None = None
    is_completed: bool | None = None
    allowed_role_ids: list[int] | None = None


class ProjectAccess(BaseModel):
    """What the current user may do on this project (drives which buttons show)."""

    can_edit: bool
    can_delete: bool
    can_view_payments: bool
    can_edit_payments: bool


class ProjectFields(ProjectBase, ORMModel):
    """The parts of a project that read straight from the database row."""

    id: int
    client: ClientRef | None
    owner: UserRef | None
    allowed_role_ids: list[int]
    is_completed: bool
    stages: list[ProjectStageRead]
    files: list[FileRead]


class ProjectRead(ProjectFields):
    payments: list[PaymentRead]  # empty when the user may not see payments
    access: ProjectAccess


# Dashboard (computed view)

class DashboardStage(ProjectStageRead):
    flag: Flag


class DashboardPayment(PaymentRead):
    flag: Flag


class DashboardProject(ProjectBase):
    id: int
    client: ClientRef | None
    owner: UserRef | None
    allowed_role_ids: list[int]
    access: ProjectAccess
    flag: Flag
    dispatch_flag: Flag
    days_to_dispatch: int | None
    stages: list[DashboardStage]
    payments: list[DashboardPayment]
    files: list[FileRead]
    log: list[NoteRead]


class OutstandingPayment(DashboardPayment):
    """An unpaid payment with who to chase, for the payments panel."""

    project: ProjectRef
    client: ClientRef | None
    contacts: list[ContactRead]


# Tasks

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    notes: str = ""
    project_id: int | None = None
    recurrence: Recurrence = Recurrence.daily
    start_date: date | None = None  # defaults to today


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    notes: str | None = None
    project_id: int | None = None
    recurrence: Recurrence | None = None
    start_date: date | None = None
    is_archived: bool | None = None


class TaskRead(ORMModel):
    id: int
    title: str
    notes: str
    project_id: int | None
    project: ProjectRef | None
    recurrence: Recurrence
    start_date: date
    is_archived: bool


class TodayTask(TaskRead):
    done: bool
    # One-off tasks carried over from an earlier start date
    days_overdue: int


# Desk display

class DisplayTask(BaseModel):
    id: int
    title: str
    done: bool
    days_overdue: int
    project: str | None


class DisplayAlert(BaseModel):
    project_id: int
    project: str
    flag: Flag
    reason: str


class DisplayDispatch(BaseModel):
    project: str
    date: date
    days: int


class DisplayHealth(BaseModel):
    backup_at: datetime | None
    google: Literal["off", "ok", "error"]
    google_at: datetime | None
    temp_c: float | None
    disk_free_pct: int


class DisplayData(BaseModel):
    name: str
    today: date
    tasks: list[DisplayTask]
    alerts: list[DisplayAlert]
    next_dispatch: DisplayDispatch | None
    active_projects: int
    health: DisplayHealth


class PairBody(BaseModel):
    code: str = Field(min_length=4, max_length=20)
