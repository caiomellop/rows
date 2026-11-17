"""Baseline: the schema as Drizzle migration 0005 left it.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-11-17

On a database the Next.js app already migrated (production, previews), do not run this: mark it applied with
`uv run alembic stamp 0001_baseline`. On an empty database (local, CI), `uv run alembic upgrade head` builds the
same tables, indexes, constraints, RLS and REVOKEs that drizzle/0000-0005 produce.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from migrations.helpers import lock_down

revision: str = "0001_baseline"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ["users", "login_tokens", "profiles", "experiences", "assistant_threads"]


def _ts(name: str, *, nullable: bool = True, now: bool = False) -> sa.Column[object]:
    return sa.Column(
        name,
        postgresql.TIMESTAMP(timezone=False),
        nullable=nullable,
        server_default=sa.text("now()") if now else None,
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text()),
        sa.Column("email", sa.Text()),
        _ts("emailVerified"),
        sa.Column("image", sa.Text()),
        sa.PrimaryKeyConstraint("id", name="users_pkey"),
        sa.UniqueConstraint("email", name="users_email_unique"),
    )
    op.create_table(
        "login_tokens",
        sa.Column("tokenHash", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("ipHash", sa.Text(), nullable=False),
        _ts("expiresAt", nullable=False),
        _ts("usedAt"),
        _ts("createdAt", nullable=False, now=True),
        sa.PrimaryKeyConstraint("tokenHash", name="login_tokens_pkey"),
    )
    op.create_index("login_tokens_created", "login_tokens", ["createdAt"])
    op.create_table(
        "profiles",
        sa.Column("userId", sa.Text(), nullable=False),
        sa.Column("displayName", sa.Text()),
        sa.Column("headline", sa.Text()),
        sa.Column("summary", sa.Text()),
        sa.Column("summarySource", sa.Text()),
        sa.Column("location", sa.Text()),
        sa.Column("timezone", sa.Text()),
        sa.Column("roleTypes", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("workMode", sa.Text()),
        sa.Column("workAuthorization", sa.Text()),
        sa.Column("goals", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        _ts("createdAt", nullable=False, now=True),
        _ts("updatedAt", nullable=False, now=True),
        sa.ForeignKeyConstraint(["userId"], ["users.id"], name="profiles_userId_users_id_fk", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("userId", name="profiles_pkey"),
    )
    op.create_table(
        "experiences",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("userId", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), server_default=sa.text("'work'"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("organization", sa.Text(), nullable=False),
        sa.Column("location", sa.Text()),
        sa.Column("startDate", sa.Text()),
        sa.Column("endDate", sa.Text()),
        sa.Column("current", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("bullets", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("skills", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("source", sa.Text(), server_default=sa.text("'manual'"), nullable=False),
        sa.Column("position", sa.Integer(), server_default=sa.text("0"), nullable=False),
        _ts("createdAt", nullable=False, now=True),
        sa.ForeignKeyConstraint(["userId"], ["users.id"], name="experiences_userId_users_id_fk", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="experiences_pkey"),
    )
    op.create_index("experiences_user", "experiences", ["userId"])
    op.create_table(
        "assistant_threads",
        sa.Column("userId", sa.Text(), nullable=False),
        sa.Column("messages", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        _ts("updatedAt", nullable=False, now=True),
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), server_default=sa.text("'New chat'"), nullable=False),
        sa.Column("pinned", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        _ts("createdAt", nullable=False, now=True),
        sa.ForeignKeyConstraint(
            ["userId"], ["users.id"], name="assistant_threads_userId_users_id_fk", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="assistant_threads_pkey"),
    )
    op.create_index("assistant_threads_user_updated", "assistant_threads", ["userId", "updatedAt"])

    for table in TABLES:
        lock_down(op, table)


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_table(table)
