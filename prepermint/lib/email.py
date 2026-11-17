"""Transactional email through Resend's HTTP API. This file is the only place that knows the provider: swapping
it means rewriting `_send` and nothing else.

Env: RESEND_API_KEY, and EMAIL_FROM (a sender on a domain verified in Resend, with SPF, DKIM and DMARC set up).
"""

import html
import logging
from dataclasses import dataclass

import httpx

from prepermint.lib.login_token import LOGIN_LINK_TTL_MINUTES
from prepermint.settings import get_settings

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"


class EmailError(Exception):
    pass


@dataclass(frozen=True)
class Message:
    subject: str
    text: str
    html: str


async def _send(to: str, message: Message) -> None:
    settings = get_settings()
    if settings.resend_api_key is None:
        if settings.is_production:
            raise EmailError("RESEND_API_KEY is not set: cannot send email")
        # Local development without a provider: print the message instead.
        logger.info("[email] to %s: %s\n%s", to, message.subject, message.text)
        return

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key.get_secret_value()}"},
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": message.subject,
                "text": message.text,
                "html": message.html,
            },
        )
    if res.is_error:
        raise EmailError(f"Email provider answered {res.status_code}: {res.text[:300]}")


def login_email(link: str) -> Message:
    validity = f"This link is valid for {LOGIN_LINK_TTL_MINUTES} minutes and works once."
    ignore = "If you didn't ask for it, you can ignore this email."
    return Message(
        subject="Your link to log in to Prepermint",
        text=f"Log in to Prepermint:\n\n{link}\n\n{validity}\n{ignore}\n",
        html=(
            f'<p>Log in to Prepermint:</p><p><a href="{html.escape(link)}">Log in to Prepermint</a></p>'
            f"<p>{validity}<br>{ignore}</p>"
        ),
    )


async def send_login_email(to: str, link: str) -> None:
    await _send(to, login_email(link))
