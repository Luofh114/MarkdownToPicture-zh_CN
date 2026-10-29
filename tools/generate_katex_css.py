"""Generate vendor/katex/katex.embedded.js.

Reads katex.min.css, inlines every KaTeX woff2 font as a base64 data URI,
drops the woff/ttf fallbacks, and wraps the result in a JS global so the page
and the PNG exporter share exactly the same stylesheet without any network or
file fetch (works even from file://).
"""

import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSS = ROOT / "vendor" / "katex" / "katex.min.css"
FONTS = ROOT / "vendor" / "katex" / "fonts"
OUT = ROOT / "vendor" / "katex" / "katex.embedded.js"

SRC_RE = re.compile(
    r'url\(fonts/(?P<woff2>[A-Za-z0-9_\-]+)\.woff2\)\s*format\("woff2"\)'
    r',url\(fonts/[^)]+\.woff\)\s*format\("woff"\)'
    r',url\(fonts/[^)]+\.ttf\)\s*format\("truetype"\)'
)


def main() -> None:
    css = CSS.read_text(encoding="utf-8")
    missing = []

    def repl(match: re.Match) -> str:
        name = match.group("woff2")
        path = FONTS / f"{name}.woff2"
        if not path.exists():
            missing.append(name)
            return match.group(0)
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        return f'url(data:font/woff2;base64,{b64}) format("woff2")'

    embedded, count = SRC_RE.subn(repl, css)
    if missing:
        raise SystemExit(f"missing font files: {missing}")
    if count == 0:
        raise SystemExit("no @font-face src blocks matched; KaTeX CSS layout changed?")

    payload = "window.KATEX_EMBEDDED_CSS=" + _js_string(embedded) + ";\n"
    OUT.write_text(payload, encoding="utf-8")
    print(f"ok: {count} font faces inlined -> {OUT} ({len(payload)/1024:.0f} KiB)")


def _js_string(s: str) -> str:
    # JSON is a valid JS string literal and keeps the CSS on one line.
    import json

    return json.dumps(s)


if __name__ == "__main__":
    main()
