import pytest

from prepermint.db import asyncpg_url, engine_for


def test_rewrites_the_supabase_url_for_asyncpg() -> None:
    url = asyncpg_url("postgresql://postgres.ref:p%40ss@aws-1-us-west-2.pooler.supabase.com:6543/postgres")
    assert url.drivername == "postgresql+asyncpg"
    assert url.username == "postgres.ref"
    assert url.password == "p@ss"
    assert url.host == "aws-1-us-west-2.pooler.supabase.com"
    assert url.port == 6543
    assert url.database == "postgres"
    assert url.query["prepared_statement_cache_size"] == "0"


def test_accepts_the_short_scheme() -> None:
    assert asyncpg_url("postgres://u:p@localhost/db").drivername == "postgresql+asyncpg"


def test_rejects_other_databases() -> None:
    with pytest.raises(ValueError, match="postgres"):
        asyncpg_url("mysql://u:p@localhost/db")


def test_one_engine_per_url() -> None:
    assert engine_for("postgresql://u:p@localhost/a") is engine_for("postgresql://u:p@localhost/a")
    assert engine_for("postgresql://u:p@localhost/a") is not engine_for("postgresql://u:p@localhost/b")
