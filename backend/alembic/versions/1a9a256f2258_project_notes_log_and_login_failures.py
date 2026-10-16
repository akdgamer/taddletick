"""project notes log and login failures

Revision ID: 1a9a256f2258
Revises: 75e9249d36c5
Create Date: 2026-10-16 10:46:05.568218

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a9a256f2258'
down_revision: Union[str, Sequence[str], None] = '75e9249d36c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="project_notes_project_id_fkey", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], name="project_notes_author_id_fkey", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="project_notes_pkey"),
    )
    op.create_index("ix_project_notes_project_id", "project_notes", ["project_id"])

    op.create_table(
        "login_failures",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="login_failures_pkey"),
    )
    op.create_index("ix_login_failures_username", "login_failures", ["username"])
    op.create_index("ix_login_failures_at", "login_failures", ["at"])


def downgrade() -> None:
    op.drop_table("login_failures")
    op.drop_table("project_notes")
