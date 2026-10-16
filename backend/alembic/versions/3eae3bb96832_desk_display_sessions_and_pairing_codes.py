"""desk display sessions and pairing codes

Revision ID: 3eae3bb96832
Revises: 1a9a256f2258
Create Date: 2026-10-16 14:10:10.240087

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3eae3bb96832'
down_revision: Union[str, Sequence[str], None] = '1a9a256f2258'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_sessions", sa.Column("scope", sa.String(length=20), server_default="full", nullable=False))
    op.create_table(
        "display_pairings",
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="display_pairings_user_id_fkey", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("code_hash", name="display_pairings_pkey"),
    )


def downgrade() -> None:
    op.drop_table("display_pairings")
    op.drop_column("user_sessions", "scope")
