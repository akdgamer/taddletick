import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
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
    # Plain text until clients become their own entity
    client_name: Mapped[str | None] = mapped_column(String(200))
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

    @property
    def name(self) -> str:
        return self.stage_type.name
