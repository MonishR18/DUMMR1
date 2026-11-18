"""Add reports and blocks models

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-11-15 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create reports table
    op.create_table(
        'reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reporter_id', sa.Integer(), nullable=False),
        sa.Column('target_type', sa.String(), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('status', sa.String(), server_default='PENDING', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_reports_id'), 'reports', ['id'], unique=False)
    op.create_index(op.f('ix_reports_reporter_id'), 'reports', ['reporter_id'], unique=False)
    op.create_index(op.f('ix_reports_target_type'), 'reports', ['target_type'], unique=False)
    op.create_index(op.f('ix_reports_target_id'), 'reports', ['target_id'], unique=False)
    op.create_index(op.f('ix_reports_status'), 'reports', ['status'], unique=False)

    # Create blocks table
    op.create_table(
        'blocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('blocker_id', sa.Integer(), nullable=False),
        sa.Column('blocked_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['blocker_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['blocked_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('blocker_id', 'blocked_id', name='uq_blocker_blocked')
    )
    op.create_index(op.f('ix_blocks_id'), 'blocks', ['id'], unique=False)
    op.create_index(op.f('ix_blocks_blocker_id'), 'blocks', ['blocker_id'], unique=False)
    op.create_index(op.f('ix_blocks_blocked_id'), 'blocks', ['blocked_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_blocks_blocked_id'), table_name='blocks')
    op.drop_index(op.f('ix_blocks_blocker_id'), table_name='blocks')
    op.drop_index(op.f('ix_blocks_id'), table_name='blocks')
    op.drop_table('blocks')

    op.drop_index(op.f('ix_reports_status'), table_name='reports')
    op.drop_index(op.f('ix_reports_target_id'), table_name='reports')
    op.drop_index(op.f('ix_reports_target_type'), table_name='reports')
    op.drop_index(op.f('ix_reports_reporter_id'), table_name='reports')
    op.drop_index(op.f('ix_reports_id'), table_name='reports')
    op.drop_table('reports')

