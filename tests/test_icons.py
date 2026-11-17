import pytest

from prepermint.icons import ICON_NAMES, icon

# Every icon in src/components/icons, static and animated.
EXPECTED = {
    "alert-circle", "arrow-right", "brain", "check", "chevrons-up-down", "circle-help", "compass", "file-text",
    "folder-code", "home", "layout-panel-top", "menu", "message-circle", "mic", "moon", "settings", "sparkles",
    "spinner", "square-pen", "sun", "user", "x",
}  # fmt: skip


def test_all_icons_from_the_next_app_exist() -> None:
    assert ICON_NAMES == EXPECTED


@pytest.mark.parametrize("name", sorted(EXPECTED))
def test_renders_a_decorative_svg(name: str) -> None:
    svg = str(icon(name, size=20))
    assert svg.startswith("<svg ")
    assert svg.endswith("</svg>")
    assert f'class="icon i-{name}' in svg
    assert 'aria-hidden="true"' in svg
    assert 'width="20" height="20"' in svg


def test_label_makes_it_an_accessible_image() -> None:
    svg = str(icon("x", label='Close "dialog"'))
    assert 'role="img"' in svg
    assert 'aria-label="Close &#34;dialog&#34;"' in svg
    assert "aria-hidden" not in svg


def test_extra_classes_and_spinner() -> None:
    assert 'class="icon i-check size-4"' in str(icon("check", class_="size-4"))
    assert "animate-spin" in str(icon("spinner"))


def test_unknown_icon() -> None:
    with pytest.raises(KeyError, match="nope"):
        icon("nope")
