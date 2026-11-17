import re

import pytest
from fastapi.testclient import TestClient

from prepermint.icons import ICON_NAMES
from prepermint.web import THEME_KEY, static_url


def test_sample_page_uses_the_base_layout(client: TestClient) -> None:
    response = client.get("/_ui")
    assert response.status_code == 200
    html = response.text
    assert re.search(r'href="/static/css/app\.css\?v=[0-9a-f]{10}"', html)
    assert re.search(r'src="/static/js/htmx-[\d.]+\.min\.js\?v=[0-9a-f]{10}"', html)
    assert re.search(r'src="/static/js/theme\.js\?v=[0-9a-f]{10}"', html)
    # The theme is applied before the first paint, with the same storage key as the Next.js app.
    assert f'localStorage.getItem("{THEME_KEY}")' in html
    assert THEME_KEY == "rows-theme"
    assert 'class="app-shell' in html
    assert "data-theme-toggle" in html
    assert 'aria-label="Switch between light and dark theme"' in html
    for name in ICON_NAMES:
        assert f"i-{name}" in html
    assert '<meta name="robots" content="noindex">' in html


@pytest.mark.parametrize(
    ("path", "content_type"),
    [
        ("css/app.css", "text/css"),
        ("js/theme.js", "javascript"),
        ("fonts/Figtree-VariableFont_wght.woff2", "font/woff2"),
        ("fonts/EBGaramond-VariableFont_wght.woff2", "font/woff2"),
        ("fonts/EBGaramond-Italic-VariableFont_wght.woff2", "font/woff2"),
        ("fonts/Geist-VariableFont_wght.woff2", "font/woff2"),
        ("favicon.ico", "image/"),
    ],
)
def test_static_files_are_served(client: TestClient, path: str, content_type: str) -> None:
    response = client.get(static_url(path))
    assert response.status_code == 200
    assert content_type in response.headers["content-type"]


def test_built_css_has_the_design_tokens(client: TestClient) -> None:
    css = client.get("/static/css/app.css").text
    for token in ("--page:252 252 250", "--ink:17 17 17", "data-theme=dark", "font-family:EB Garamond"):
        assert token.replace(" ", "") in css.replace(" ", "")
    for utility in (".bg-page", ".text-fg-2", ".border-line", ".btn-primary", ".surface", ".i-settings"):
        assert utility in css


def test_static_url_hashes_content() -> None:
    first = static_url("css/app.css")
    assert first == static_url("css/app.css")
    assert first.startswith("/static/css/app.css?v=")


@pytest.mark.parametrize("path", ["../main.py", "css/missing.css", "css"])
def test_static_url_refuses_files_outside_static(path: str) -> None:
    with pytest.raises(FileNotFoundError):
        static_url(path)
