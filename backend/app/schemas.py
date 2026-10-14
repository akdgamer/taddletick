"""Shapes of the JSON going in and out of the API (the contract React codes against)."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.models import ProjectLabel, StageStatus
from app.urgency import Flag


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


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


# Projects

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


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    client_id: int | None = None
    po_number: str | None = None
    label: ProjectLabel | None = None
    is_p0: bool | None = None
    dispatch_date: date | None = None
    notes: str | None = None
    is_completed: bool | None = None


class ProjectRead(ProjectBase, ORMModel):
    id: int
    client: ClientRef | None
    is_completed: bool
    stages: list[ProjectStageRead]


# Dashboard (computed view)

class DashboardStage(ProjectStageRead):
    flag: Flag


class DashboardProject(ProjectBase):
    id: int
    client: ClientRef | None
    flag: Flag
    dispatch_flag: Flag
    days_to_dispatch: int | None
    stages: list[DashboardStage]
