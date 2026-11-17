"""The tables, with the same names and quoted camelCase columns the Drizzle schema created (docs/adr/0003).

Every table has Row Level Security enabled with NO policies. The app talks to Postgres directly (DATABASE_URL,
`postgres` role, which bypasses RLS), so nothing changes for the server, but Supabase's public REST API
(anon / authenticated roles) cannot read or write these tables. SQLAlchemy has no RLS flag: every Alembic
revision that creates a table enables RLS on it and runs `REVOKE ALL ON TABLE ... FROM anon, authenticated`.

Timestamps are `timestamp without time zone` holding UTC, as Drizzle wrote them: use `utcnow()`.
"""

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from sqlalchemy import Boolean, ForeignKey, Index, Integer, MetaData, Text, text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

WorkMode = Literal["remote", "hybrid", "onsite", "flexible"]
WORK_MODES: tuple[WorkMode, ...] = ("remote", "hybrid", "onsite", "flexible")
ExperienceKind = Literal["work", "education"]
ExperienceSource = Literal["resume", "linkedin", "assistant", "manual"]

# Names Drizzle gave constraints, so Alembic autogenerate sees no difference.
NAMING = {
    "pk": "%(table_name)s_pkey",
    "fk": "%(table_name)s_%(column_0_name)s_%(referred_table_name)s_%(referred_column_0_name)s_fk",
    "uq": "%(table_name)s_%(column_0_name)s_unique",
}


def utcnow() -> datetime:
    """Now, as the naive UTC datetime these columns store."""
    return datetime.now(UTC).replace(tzinfo=None)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


TS = TIMESTAMP(timezone=False)
NOW = text("now()")
EMPTY_LIST = text("'[]'::jsonb")
EMPTY_OBJECT = text("'{}'::jsonb")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    name: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text, unique=True)
    email_verified: Mapped[datetime | None] = mapped_column("emailVerified", TS)
    image: Mapped[str | None] = mapped_column(Text)


class LoginToken(Base):
    """Email login links (MVP-23). Only the SHA-256 of the token is stored; a row is spent by setting `used_at`.
    Rows also serve as the request log for rate limiting (per email and per salted IP hash)."""

    __tablename__ = "login_tokens"
    __table_args__ = (Index("login_tokens_created", "createdAt"),)

    token_hash: Mapped[str] = mapped_column("tokenHash", Text, primary_key=True)
    email: Mapped[str] = mapped_column(Text)
    ip_hash: Mapped[str] = mapped_column("ipHash", Text)
    expires_at: Mapped[datetime] = mapped_column("expiresAt", TS)
    used_at: Mapped[datetime | None] = mapped_column("usedAt", TS)
    created_at: Mapped[datetime] = mapped_column("createdAt", TS, server_default=NOW, default=utcnow)


class Profile(Base):
    """What the AI knows about the user's header and goals. 1:1 with users."""

    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column("userId", Text, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    display_name: Mapped[str | None] = mapped_column("displayName", Text)
    # One line: "Backend engineer · Go & Postgres · 4 yrs".
    headline: Mapped[str | None] = mapped_column(Text)
    # The 3-sentence summary.
    summary: Mapped[str | None] = mapped_column(Text)
    # "ai" or "user".
    summary_source: Mapped[str | None] = mapped_column("summarySource", Text)
    location: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str | None] = mapped_column(Text)
    # e.g. ["Full-time", "Contract"].
    role_types: Mapped[list[str]] = mapped_column("roleTypes", JSONB, server_default=EMPTY_LIST, default=list)
    work_mode: Mapped[str | None] = mapped_column("workMode", Text)
    work_authorization: Mapped[str | None] = mapped_column("workAuthorization", Text)
    # Career goals collected by the AI assistant: targetRole, targetLevel, targetMarket.
    goals: Mapped[dict[str, str]] = mapped_column(JSONB, server_default=EMPTY_OBJECT, default=dict)
    created_at: Mapped[datetime] = mapped_column("createdAt", TS, server_default=NOW, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", TS, server_default=NOW, default=utcnow)


class Experience(Base):
    __tablename__ = "experiences"
    __table_args__ = (Index("experiences_user", "userId"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column("userId", Text, ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(Text, server_default=text("'work'"), default="work")
    title: Mapped[str] = mapped_column(Text)
    organization: Mapped[str] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    # "YYYY-MM" or "YYYY".
    start_date: Mapped[str | None] = mapped_column("startDate", Text)
    # Null while current.
    end_date: Mapped[str | None] = mapped_column("endDate", Text)
    current: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), default=False)
    bullets: Mapped[list[str]] = mapped_column(JSONB, server_default=EMPTY_LIST, default=list)
    skills: Mapped[list[str]] = mapped_column(JSONB, server_default=EMPTY_LIST, default=list)
    # Where it came from. Everything here is self-reported.
    source: Mapped[str] = mapped_column(Text, server_default=text("'manual'"), default="manual")
    position: Mapped[int] = mapped_column(Integer, server_default=text("0"), default=0)
    created_at: Mapped[datetime] = mapped_column("createdAt", TS, server_default=NOW, default=utcnow)


class AssistantThread(Base):
    """Conversations with the AI assistant. A user has many; the app sidebar lists them by `updated_at`.
    `messages` is a list of {"role": "user" | "assistant", "content": str}."""

    __tablename__ = "assistant_threads"
    __table_args__ = (Index("assistant_threads_user_updated", "userId", "updatedAt"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column("userId", Text, ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text, server_default=text("'New chat'"), default="New chat")
    pinned: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), default=False)
    messages: Mapped[list[dict[str, str]]] = mapped_column(JSONB, server_default=EMPTY_LIST, default=list)
    created_at: Mapped[datetime] = mapped_column("createdAt", TS, server_default=NOW, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", TS, server_default=NOW, default=utcnow)
