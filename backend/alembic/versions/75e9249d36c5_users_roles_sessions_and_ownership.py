"""users, roles, sessions; project owners, restricted projects; per-user tasks and Google sync

Existing rows get no owner (NULL). The first admin, created on the app's setup
screen, claims them: see app/routers/auth.py.

Revision ID: 75e9249d36c5
Revises: f25c2856517a
Create Date: 2026-10-15 20:30:02.752506

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75e9249d36c5'
down_revision: Union[str, Sequence[str], None] = 'f25c2856517a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# name, is_admin, can_edit, can_delete, can_view_payments, can_edit_payments
STARTER_ROLES = [
    ("Admin", True, True, True, True, True),
    ("Manager", False, True, False, True, True),
    ("Member", False, True, False, False, False),
    ("Viewer", False, False, False, False, False),
]


def upgrade() -> None:
    roles = op.create_table('roles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('is_admin', sa.Boolean(), nullable=False),
    sa.Column('can_edit', sa.Boolean(), nullable=False),
    sa.Column('can_delete', sa.Boolean(), nullable=False),
    sa.Column('can_view_payments', sa.Boolean(), nullable=False),
    sa.Column('can_edit_payments', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.bulk_insert(roles, [
        dict(zip(["name", "is_admin", "can_edit", "can_delete", "can_view_payments", "can_edit_payments"], r))
        for r in STARTER_ROLES
    ])
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('username', sa.String(length=100), nullable=False),
    sa.Column('display_name', sa.String(length=200), nullable=False),
    sa.Column('password_hash', sa.String(length=300), nullable=False),
    sa.Column('role_id', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_role_id'), 'users', ['role_id'], unique=False)
    op.create_index('uq_users_username_lower', 'users', [sa.literal_column('lower(username)')], unique=True)
    op.create_table('user_sessions',
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('token_hash')
    )
    op.create_index(op.f('ix_user_sessions_user_id'), 'user_sessions', ['user_id'], unique=False)
    op.create_table('project_roles',
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('role_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('project_id', 'role_id')
    )
    op.create_index(op.f('ix_project_roles_role_id'), 'project_roles', ['role_id'], unique=False)

    op.add_column('projects', sa.Column('owner_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_projects_owner_id'), 'projects', ['owner_id'], unique=False)
    op.create_foreign_key('projects_owner_id_fkey', 'projects', 'users', ['owner_id'], ['id'], ondelete='SET NULL')

    op.add_column('tasks', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_tasks_user_id'), 'tasks', ['user_id'], unique=False)
    op.create_foreign_key('tasks_user_id_fkey', 'tasks', 'users', ['user_id'], ['id'], ondelete='CASCADE')

    op.add_column('google_account', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_unique_constraint('google_account_user_id_key', 'google_account', ['user_id'])
    op.create_foreign_key('google_account_user_id_fkey', 'google_account', 'users', ['user_id'], ['id'], ondelete='CASCADE')

    # synced_items: key alone is no longer unique (each user has their own items)
    op.drop_constraint('synced_items_pkey', 'synced_items', type_='primary')
    op.execute("ALTER TABLE synced_items ADD COLUMN id SERIAL PRIMARY KEY")
    op.add_column('synced_items', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_synced_items_user_id'), 'synced_items', ['user_id'], unique=False)
    op.create_unique_constraint('synced_items_user_id_key_key', 'synced_items', ['user_id', 'key'])
    op.create_foreign_key('synced_items_user_id_fkey', 'synced_items', 'users', ['user_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    # Per-user data can't be squeezed back into the single-user shape; keep the
    # first admin's (lowest user id) Google account and sync records only.
    op.execute("""
        DELETE FROM synced_items WHERE user_id IS DISTINCT FROM (SELECT min(id) FROM users);
        DELETE FROM google_account WHERE user_id IS DISTINCT FROM (SELECT min(id) FROM users)
    """)
    op.drop_constraint('synced_items_user_id_fkey', 'synced_items', type_='foreignkey')
    op.drop_constraint('synced_items_user_id_key_key', 'synced_items', type_='unique')
    op.drop_index(op.f('ix_synced_items_user_id'), table_name='synced_items')
    op.drop_column('synced_items', 'user_id')
    op.drop_column('synced_items', 'id')
    op.create_primary_key('synced_items_pkey', 'synced_items', ['key'])

    op.drop_constraint('google_account_user_id_fkey', 'google_account', type_='foreignkey')
    op.drop_constraint('google_account_user_id_key', 'google_account', type_='unique')
    op.drop_column('google_account', 'user_id')

    op.drop_constraint('tasks_user_id_fkey', 'tasks', type_='foreignkey')
    op.drop_index(op.f('ix_tasks_user_id'), table_name='tasks')
    op.drop_column('tasks', 'user_id')

    op.drop_constraint('projects_owner_id_fkey', 'projects', type_='foreignkey')
    op.drop_index(op.f('ix_projects_owner_id'), table_name='projects')
    op.drop_column('projects', 'owner_id')

    op.drop_index(op.f('ix_project_roles_role_id'), table_name='project_roles')
    op.drop_table('project_roles')
    op.drop_index(op.f('ix_user_sessions_user_id'), table_name='user_sessions')
    op.drop_table('user_sessions')
    op.drop_index('uq_users_username_lower', table_name='users')
    op.drop_index(op.f('ix_users_role_id'), table_name='users')
    op.drop_table('users')
    op.drop_table('roles')
