"""Configuration read from the environment (and from .env.local when running locally)."""

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    database_url: SecretStr | None = None
    # Opens the /_diag routes (prepermint/diagnostics.py). Unset everywhere except the Python test deploy.
    diagnostics_token: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
