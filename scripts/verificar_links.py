"""Verifica se os arquivos locais referenciados pelos HTMLs estão no site/."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

SITE = Path(__file__).resolve().parents[1] / "site"


class Referencias(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        campos = dict(attrs)
        valor = campos.get("src") if tag in {"script", "img"} else (
            campos.get("href") if tag in {"a", "link"} else None
        )
        if valor:
            self.refs.append(valor)


def main():
    erros = []
    for html in sorted(SITE.glob("*.html")):
        parser = Referencias()
        parser.feed(html.read_text(encoding="utf-8"))
        for ref in parser.refs:
            url = urlsplit(ref)
            if url.scheme or url.netloc or ref.startswith(("#", "//")):
                continue
            destino = SITE / unquote(url.path).lstrip("/") if url.path.startswith("/") else html.parent / unquote(url.path)
            if not destino.exists():
                erros.append(f"{html.name}: arquivo inexistente -> {ref}")
    if erros:
        raise SystemExit("\n".join(erros))
    print("OK: referências locais dos HTMLs conferidas.")


if __name__ == "__main__":
    main()
