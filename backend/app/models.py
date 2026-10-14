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
