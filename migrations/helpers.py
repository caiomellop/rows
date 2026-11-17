"""Shared steps for Alembic revisions."""

import re
from types import ModuleType

import sqlalchemy as sa

_TABLE = re.compile(r"[a-z][a-z0-9_]*")


def lock_down(op: ModuleType, table: str) -> None:
    """RLS on with no policies, and no grants to Supabase's public API roles (anon, authenticated).

    The app connects as `postgres`, which bypasses RLS. The REVOKE is skipped on a plain Postgres (local or CI)
    that has no Supabase roles, where it would fail and where there is no public API to close.
    """
    # Table names come from migration files, never from input; the check keeps it that way.
    if not _TABLE.fullmatch(table):
        raise ValueError(f"Not a table name: {table!r}")
    revoke = f'REVOKE ALL ON TABLE "{table}" FROM anon, authenticated;'
    roles_exist = "EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')"  # noqa: E501
    op.execute(sa.text(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY'))
    op.execute(sa.text(f"DO $$ BEGIN IF {roles_exist} THEN {revoke} END IF; END $$"))
