"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-03-09

"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "services",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer, nullable=False, unique=True),
        sa.Column("host", sa.String(255), nullable=False, server_default="localhost"),
        sa.Column("health_path", sa.String(255), nullable=False, server_default="/health"),
        sa.Column("check_interval_seconds", sa.Integer, nullable=False, server_default="30"),
        sa.Column("description", sa.String(1024), nullable=True),
        sa.Column("tags", sa.String(1024), nullable=True),
        sa.Column(
            "status",
            sa.Enum("unknown", "healthy", "unhealthy", "unreachable", name="healthstatus"),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_healthy_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consecutive_failures", sa.Integer, nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("services")
    op.execute("DROP TYPE IF EXISTS healthstatus")
