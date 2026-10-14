import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class ProjectLabel(str, enum.Enum):
    company = "company"
    personal = "personal"


class StageStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    blocked = "blocked"
    done = "done"


# Stakeholders: which contacts are involved in which project stage (many-to-many)
project_stage_contacts = Table(
    "project_stage_contacts",
    Base.metadata,
    Column("project_stage_id", ForeignKey("project_stages.id", ondelete="CASCADE"), primary_key=True),
    Column("contact_id", ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True, index=True),
)


class Client(Base):
    """A customer company. Has many contacts and many projects."""

    __tablename__ = "clients"
    # Names are unique ignoring case, so "Acme" and "acme" can't both exist
    __table_args__ = (Index("uq_clients_name_lower", text("lower(name)"), unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")

    contacts: Mapped[list["Contact"]] = relationship(back_populates="client", order_by="Contact.name")


class Contact(Base):
    """A person. Belongs to a client company, or to none (e.g. a supplier)."""

    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"), index=True
    )
    role: Mapped[str] = mapped_column(String(200), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    notes: Mapped[str] = mapped_column(Text, default="")

    client: Mapped[Client | None] = relationship(back_populates="contacts", lazy="joined")


class StageType(Base):
    """Catalog entry: a reusable kind of stage, e.g. "Electrical design"."""

    __tablename__ = "stage_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    # Default order when stages are picked for a new project
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"), index=True
    )
    po_number: Mapped[str | None] = mapped_column(String(100))
    label: Mapped[ProjectLabel] = mapped_column(
        Enum(ProjectLabel, name="project_label"), default=ProjectLabel.company
    )
    is_p0: Mapped[bool] = mapped_column(Boolean, default=False)
    dispatch_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    client: Mapped[Client | None] = relationship(lazy="joined")
    stages: Mapped[list["ProjectStage"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectStage.position",
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="(Payment.due_date.is_(None), Payment.due_date, Payment.id)",
    )
    files: Mapped[list["ProjectFile"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProjectFile.uploaded_at.desc()",
    )


class ProjectStage(Base):
    """One stage of one project: holds this project's status, dates and notes."""

    __tablename__ = "project_stages"
    __table_args__ = (UniqueConstraint("project_id", "stage_type_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    stage_type_id: Mapped[int] = mapped_column(
        ForeignKey("stage_types.id", ondelete="RESTRICT")
    )
    status: Mapped[StageStatus] = mapped_column(
        Enum(StageStatus, name="stage_status"), default=StageStatus.not_started
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped[Project] = relationship(back_populates="stages")
    stage_type: Mapped[StageType] = relationship(lazy="joined")
    contacts: Mapped[list[Contact]] = relationship(
        secondary=project_stage_contacts, lazy="selectin", order_by=Contact.name
    )

    @property
    def name(self) -> str:
        return self.stage_type.name


class Payment(Base):
    """One expected payment milestone of a project, and what has arrived against it."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(200))  # e.g. "Advance 30%", "Balance on dispatch"
    expected_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    due_date: Mapped[date | None] = mapped_column(Date)
    received_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    received_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, default="")

    project: Mapped[Project] = relationship(back_populates="payments")

    @property
    def is_paid(self) -> bool:
        return self.received_amount >= self.expected_amount


class ProjectFile(Base):
    """A file attached to a project; the bytes live under FILES_DIR (the NAS on the Pi)."""

    __tablename__ = "project_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))  # name as uploaded
    stored_name: Mapped[str] = mapped_column(String(300), unique=True)  # name on disk
    content_type: Mapped[str] = mapped_column(String(200), default="application/octet-stream")
    size: Mapped[int] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="files")


class Recurrence(str, enum.Enum):
    none = "none"  # one-off: shows from its start date until done
    daily = "daily"
    weekdays = "weekdays"  # Monday to Friday
    weekly = "weekly"  # same weekday as the start date


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    notes: Mapped[str] = mapped_column(Text, default="")
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    recurrence: Mapped[Recurrence] = mapped_column(Enum(Recurrence, name="recurrence"), default=Recurrence.daily)
    start_date: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    project: Mapped[Project | None] = relationship(lazy="joined")
    completions: Mapped[list["TaskCompletion"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class TaskCompletion(Base):
    """Task done on a given day (for one-off tasks: done for good)."""

    __tablename__ = "task_completions"

    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)


class GoogleAccount(Base):
    """Single row (id=1): the connected Google account and the calendar/task list we own."""

    __tablename__ = "google_account"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_json: Mapped[str | None] = mapped_column(Text)
    oauth_state: Mapped[str | None] = mapped_column(String(200))
    oauth_code_verifier: Mapped[str | None] = mapped_column(String(200))
    calendar_id: Mapped[str | None] = mapped_column(String(300))
    tasklist_id: Mapped[str | None] = mapped_column(String(300))
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)


class SyncedItem(Base):
    """Remembers which Google event/task mirrors which local item, so sync can update or delete it."""

    __tablename__ = "synced_items"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)  # e.g. "calendar:stage:12"
    google_id: Mapped[str] = mapped_column(String(300))
    fingerprint: Mapped[str] = mapped_column(String(64))  # hash of what we last sent
