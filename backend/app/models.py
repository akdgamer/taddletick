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


# Restricted company projects: only these roles (plus admins) may see them.
# No rows for a project = every role can see it.
project_roles = Table(
    "project_roles",
    Base.metadata,
    Column("project_id", ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True, index=True),
)


class Role(Base):
    """A set of permissions. Admin roles can do everything, including managing users."""

    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False)  # company projects, clients, contacts
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False)
    can_view_payments: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit_payments: Mapped[bool] = mapped_column(Boolean, default=False)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (Index("uq_users_username_lower", text("lower(username)"), unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(300))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    role: Mapped[Role] = relationship(lazy="joined")

    def allowed(self, permission: str) -> bool:
        """permission is a Role flag, e.g. "can_edit"; admins have them all."""
        return self.role.is_admin or getattr(self.role, permission)


class LoginFailure(Base):
    """A wrong password for a username, kept for a while to slow down guessing."""

    __tablename__ = "login_failures"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), index=True)  # lowercased; may not exist
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class UserSession(Base):
    """A logged-in browser. The cookie holds a random token; only its hash is stored."""

    __tablename__ = "user_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # "full" for a person's browser; "display" for the desk screen, which may only use /display
    scope: Mapped[str] = mapped_column(String(20), default="full", server_default="full")

    user: Mapped[User] = relationship(lazy="joined")


class DisplayPairing(Base):
    """A one-time code that turns a browser into a user's desk display (made on the Pi's command line)."""

    __tablename__ = "display_pairings"

    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(lazy="joined")


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
    # Who created it; personal projects are visible to this user only
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    client: Mapped[Client | None] = relationship(lazy="joined")
    owner: Mapped[User | None] = relationship(lazy="joined")
    allowed_roles: Mapped[list[Role]] = relationship(secondary=project_roles, lazy="selectin", order_by=Role.name)
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
    log: Mapped[list["ProjectNote"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="(ProjectNote.created_at.desc(), ProjectNote.id.desc())",
    )

    @property
    def allowed_role_ids(self) -> list[int]:
        return [r.id for r in self.allowed_roles]


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


class ProjectNote(Base):
    """A dated entry in a project's log: what happened, what was agreed."""

    __tablename__ = "project_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped[Project] = relationship(back_populates="log")
    author: Mapped[User | None] = relationship(lazy="joined")


class Activity(Base):
    """One line of history: who changed what on which project, written as a sentence."""

    __tablename__ = "activity"

    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    # NULL once the project is deleted; the name is kept so the "deleted" line still reads well
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    project_name: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20))  # project, stage, payment, file, note
    summary: Mapped[str] = mapped_column(Text)
    # Payment lines: only for roles that may see payments
    sensitive: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    user: Mapped[User | None] = relationship(lazy="joined")
    project: Mapped["Project | None"] = relationship(lazy="joined")


class Recurrence(str, enum.Enum):
    none = "none"  # one-off: shows from its start date until done
    daily = "daily"
    weekdays = "weekdays"  # Monday to Friday
    weekly = "weekly"  # same weekday as the start date


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Each person has their own task list (nullable only until the first admin claims old data)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
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
    """One per user: their connected Google account and the calendar/task list we own there."""

    __tablename__ = "google_account"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
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
    __table_args__ = (UniqueConstraint("user_id", "key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(100))  # e.g. "calendar:stage:12"
    google_id: Mapped[str] = mapped_column(String(300))
    fingerprint: Mapped[str] = mapped_column(String(64))  # hash of what we last sent
