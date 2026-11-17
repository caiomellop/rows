"""Configuration read from the environment (and from .env.local when running locally).

Every variable is documented in .env.example. The two host URLs are read from SITE_URL / APP_URL; the
NEXT_PUBLIC_* names the Next.js app used are still accepted, so a Vercel project configured for it keeps working.
"""

from functools import lru_cache

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

LOCAL_URL = "http://localhost:8000"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore", populate_by_name=True)

    database_url: SecretStr | None = None
    # Signs the session cookie and salts the IP hash of login requests: `openssl rand -base64 32`.
    auth_secret: SecretStr | None = None

    resend_api_key: SecretStr | None = None
    email_from: str = "Prepermint <noreply@prepermint.com>"

    site_url: str | None = Field(default=None, validation_alias=AliasChoices("SITE_URL", "NEXT_PUBLIC_SITE_URL"))
    app_url: str | None = Field(default=None, validation_alias=AliasChoices("APP_URL", "NEXT_PUBLIC_APP_URL"))

    anthropic_keys: SecretStr | None = None
    anthropic_auth_token: SecretStr | None = None

    # The voice interview prototype (CAI-36): open only where this is exactly "true".
    prototype_enabled: str | None = None
    deepgram_api_keys: SecretStr | None = None
    apify_token: SecretStr | None = None

    # "production" on deployed environments. Vercel sets VERCEL=1 on every deployment, previews included.
    app_env: str = Field(default="development", validation_alias=AliasChoices("APP_ENV"))
    vercel: str | None = None

    # Opens the /_diag routes (prepermint/diagnostics.py). Unset everywhere except the Python test deploy.
    diagnostics_token: SecretStr | None = None

    @property
    def is_production(self) -> bool:
        """Deployed (any Vercel environment, or APP_ENV=production): cookies are Secure and email must really send."""
        return self.app_env == "production" or bool(self.vercel)


@lru_cache
def get_settings() -> Settings:
    return Settings()
