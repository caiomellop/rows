"""Lucide icons as inline SVG, for templates: `{{ icon("sun", size=17) }}`.

The animated ones were React components built on lucide-animated and `motion`
(src/components/icons). Here the same SVGs carry class hooks, and the hover
animations live in CSS (prepermint/styles/app.css, "Icon animations"). An icon
animates while the mouse is over it or over any ancestor with class `icon-host`
(a sidebar item, a button), never on touch and never with "reduce motion".
"""

from markupsafe import Markup, escape

# Inner markup of each icon, viewBox 0 0 24 24. `pathLength="1"` marks strokes that the CSS draws in.
_ICONS: dict[str, str] = {
    # Static icons (src/components/icons/index.tsx).
    "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "alert-circle": '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    "spinner": '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    # Animated icons.
    "brain": (
        '<path class="a-stem" pathLength="1" d="M12 18V5"/>'
        '<path class="a-side" pathLength="1" d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/>'
        '<path class="a-top" pathLength="1" d="M12 5A3 3 0 1 1 17.598 6.5"/>'
        '<path class="a-top" pathLength="1" d="M12 5A3 3 0 1 0 6.402 6.5"/>'
        '<path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/>'
        '<path class="a-low" pathLength="1" d="M18 18a4 4 0 0 0 2-7.464"/>'
        '<path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/>'
        '<path class="a-low" pathLength="1" d="M6 18a4 4 0 0 1-2-7.464"/>'
        '<path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/>'
    ),
    "chevrons-up-down": '<path class="a-down" d="m7 15 5 5 5-5"/><path class="a-up" d="m7 9 5-5 5 5"/>',
    "circle-help": (
        '<circle cx="12" cy="12" r="10"/>'
        '<g class="a-mark"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></g>'
    ),
    "compass": (
        '<circle cx="12" cy="12" r="10"/>'
        '<polygon class="a-needle" points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'
    ),
    "file-text": (
        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>'
        '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>'
        '<path class="a-line" style="--i:0" pathLength="1" d="M10 9H8"/>'
        '<path class="a-line" style="--i:1" pathLength="1" d="M16 13H8"/>'
        '<path class="a-line" style="--i:2" pathLength="1" d="M16 17H8"/>'
    ),
    "folder-code": (
        '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9'
        'A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>'
        '<path class="a-left" d="M10 10.5 8 13l2 2.5"/>'
        '<path class="a-right" d="m14 10.5 2 2.5-2 2.5"/>'
    ),
    "home": (
        '<path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9'
        'a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
        '<path class="a-door" pathLength="1" d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>'
    ),
    "layout-panel-top": (
        '<rect class="a-top" width="18" height="7" x="3" y="3" rx="1"/>'
        '<rect class="a-left" width="7" height="7" x="3" y="14" rx="1"/>'
        '<rect class="a-right" width="7" height="7" x="14" y="14" rx="1"/>'
    ),
    "menu": (
        '<line class="a-l1" x1="4" x2="20" y1="6" y2="6"/>'
        '<line class="a-l2" x1="4" x2="20" y1="12" y2="12"/>'
        '<line class="a-l3" x1="4" x2="20" y1="18" y2="18"/>'
    ),
    "message-circle": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    "mic": (
        '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>'
        '<rect class="a-capsule" x="9" y="2" width="6" height="13" rx="3"/>'
    ),
    "moon": '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    "settings": (
        '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73'
        "l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38"
        "a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18"
        "a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08"
        "a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08"
        'a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>'
        '<circle cx="12" cy="12" r="3"/>'
    ),
    "sparkles": (
        '<path class="a-spark" d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936'
        "A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581"
        'a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>'
        '<path class="a-star" d="M20 3v4"/><path class="a-star" d="M22 5h-4"/>'
        '<path class="a-star" d="M4 17v2"/><path class="a-star" d="M5 18H3"/>'
    ),
    "square-pen": (
        '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>'
        '<path class="a-pen" d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84'
        'a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>'
    ),
    "sun": (
        '<circle cx="12" cy="12" r="4"/>'
        + "".join(
            f'<path class="a-ray" style="--i:{i}" d="{d}"/>'
            for i, d in enumerate(
                [
                    "M12 2v2",
                    "m19.07 4.93-1.41 1.41",
                    "M20 12h2",
                    "m17.66 17.66 1.41 1.41",
                    "M12 20v2",
                    "m6.34 17.66-1.41 1.41",
                    "M2 12h2",
                    "m4.93 4.93 1.41 1.41",
                ],
                start=1,
            )
        )
    ),
    "user": (
        '<circle class="a-head" pathLength="1" cx="12" cy="8" r="5"/>'
        '<path class="a-body" pathLength="1" d="M20 21a8 8 0 0 0-16 0"/>'
    ),
    "x": '<path class="a-x" pathLength="1" d="M18 6 6 18"/><path class="a-x a-x2" pathLength="1" d="m6 6 12 12"/>',
}

ICON_NAMES = frozenset(_ICONS)


def icon(name: str, size: int = 16, class_: str = "", label: str | None = None) -> Markup:
    """An inline SVG. Decorative (aria-hidden) unless `label` is given."""
    if name not in _ICONS:
        raise KeyError(f"Unknown icon: {name}")
    classes = f"icon i-{name} {class_}".strip()
    if name == "spinner":
        classes += " animate-spin"
    a11y = f'role="img" aria-label="{escape(label)}"' if label else 'aria-hidden="true"'
    return Markup(  # noqa: S704 - the markup is fixed above; only escaped values are inserted
        f'<svg class="{escape(classes)}" {a11y} width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
        f'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        f"{_ICONS[name]}</svg>"
    )
