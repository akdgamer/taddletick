"""clients, contacts and stage stakeholders

Replaces the free-text projects.client_name with a link to a clients table.
Existing client names are carried over: one client per distinct name
(ignoring case and surrounding spaces), and each project is linked to it.

Revision ID: bddb54a6c418
Revises: d2003b6c64f9
Create Date: 2026-10-14 23:48:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bddb54a6c418'
down_revision: Union[str, Sequence[str], None] = 'd2003b6c64f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'clients',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('address', sa.Text(), nullable=False, server_default=''),
        sa.Column('notes', sa.Text(), nullable=False, server_default=''),
    )
    op.create_index('uq_clients_name_lower', 'clients', [sa.text('lower(name)')], unique=True)

    op.create_table(
        'contacts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('role', sa.String(length=200), nullable=False, server_default=''),
        sa.Column('phone', sa.String(length=50), nullable=False, server_default=''),
        sa.Column('email', sa.String(length=200), nullable=False, server_default=''),
        sa.Column('notes', sa.Text(), nullable=False, server_default=''),
    )
    op.create_index('ix_contacts_client_id', 'contacts', ['client_id'])

    op.create_table(
        'project_stage_contacts',
        sa.Column('project_stage_id', sa.Integer(),
                  sa.ForeignKey('project_stages.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('contact_id', sa.Integer(),
                  sa.ForeignKey('contacts.id', ondelete='CASCADE'), primary_key=True),
    )
    op.create_index('ix_project_stage_contacts_contact_id', 'project_stage_contacts', ['contact_id'])

    op.add_column('projects', sa.Column(
        'client_id', sa.Integer(), sa.ForeignKey('clients.id', ondelete='RESTRICT'), nullable=True))
    op.create_index('ix_projects_client_id', 'projects', ['client_id'])

    # Carry existing free-text client names over to real client records
    op.execute("""
        INSERT INTO clients (name)
        SELECT DISTINCT ON (lower(trim(client_name))) trim(client_name)
        FROM projects
        WHERE trim(coalesce(client_name, '')) <> ''
        ORDER BY lower(trim(client_name)), id
    """)
    op.execute("""
        UPDATE projects p SET client_id = c.id
        FROM clients c
        WHERE lower(trim(p.client_name)) = lower(c.name)
    """)

    op.drop_column('projects', 'client_name')


def downgrade() -> None:
    op.add_column('projects', sa.Column('client_name', sa.String(length=200), nullable=True))
    op.execute("""
        UPDATE projects p SET client_name = c.name
        FROM clients c WHERE p.client_id = c.id
    """)
    op.drop_index('ix_projects_client_id', table_name='projects')
    op.drop_column('projects', 'client_id')
    op.drop_table('project_stage_contacts')
    op.drop_table('contacts')
    op.drop_table('clients')
