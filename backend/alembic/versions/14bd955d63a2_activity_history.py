"""activity history

Revision ID: 14bd955d63a2
Revises: 3eae3bb96832
Create Date: 2026-10-16 17:00:12.768160

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14bd955d63a2'
down_revision: Union[str, Sequence[str], None] = '3eae3bb96832'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("project_name", sa.String(length=200), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("sensitive", sa.Boolean(), server_default="false", nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="activity_user_id_fkey", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="activity_project_id_fkey", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="activity_pkey"),
    )
    op.create_index("ix_activity_project_id", "activity", ["project_id"])


def downgrade() -> None:
    op.drop_table("activity")
