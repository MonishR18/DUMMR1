"""Add user specialty and avatar_url

Revision ID: a1b2c3d4e5f6
Revises: f242b4118f59
Create Date: 2026-11-07 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f242b4118f59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('users', sa.Column('specialty', sa.String(), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'specialty')
