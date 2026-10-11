#!/usr/bin/env python3
"""Convert a normal root build into an immutable, content-addressed Neocities release.

No network calls. GitHub Pages keeps its existing build format. Only HTML
entrypoints and the intentionally live players.json retain mutable URLs.
Old content-addressed resources are left untouched by the deployer.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from lxml import html

from build import js_assignment

IMMUTABLE_PATTERN = re.compile(r"\.[0-9a-f]{24}\.[a-z0-9]+$")
CSS_URL = re.compile(r"url\(\s*(['\"]?)([^)'\"\s]+)\1\s*\)")


def immutable_path(name, content):
    path = Path(name)
    digest = hashlib.sha256(content).hexdigest()[:24]
    return (path.parent / f"{path.stem}.{digest}{path.suffix}").as_posix()


def rewrite_assets(code, assets):
    # All generated JS/JSON image literals are quoted exact paths.
    for old, new in assets.items():
        code = code.replace('"' + old + '"', '"' + new + '"')
        code = code.replace("'" + old + "'", "'" + new + "'")
    return code


def prepare(directory):
    output = Path(directory)
    marker = output / ".neonauts-build"
    state = json.loads(marker.read_text(encoding="utf-8"))
    if state.get("base_path") != "/" or state.get("immutable_release"):
        raise ValueError("Requires a fresh, unversioned root build (base_path=/)")
    if not (output / "index.html").is_file():
        raise ValueError("Missing root HTML entrypoint")

    original = {path.relative_to(output).as_posix(): path
                for path in output.rglob("*") if path.is_file()
                and not path.relative_to(output).parts[0].startswith(".")}
    if any(IMMUTABLE_PATTERN.search(name) for name in original):
        raise ValueError("Input already contains immutable-name resources")

    replacements = {}

    def publish(name, content):
        target = immutable_path(name, content)
        destination = output / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        replacements[name] = target
        return target

    # Pass 1: raster/vector art, fonts and miscellaneous binary resources.
    assets = {}
    for name, path in sorted(original.items()):
        if name.startswith("assets/"):
            assets[name] = publish(name, path.read_bytes())

    # Pass 2: CSS has relative url(...) assets. The stylesheet remains at the
    # root path (with a digest inserted) so its relative URLs resolve normally.
    for name, path in sorted(original.items()):
        if path.suffix != ".css":
            continue
        css = path.read_text(encoding="utf-8")
        def css_replace(match):
            ref = match.group(2)
            if ref.startswith(("data:", "https:", "http:")):
                return match.group(0)
            if ref not in assets:
                raise ValueError(f"CSS references unversioned/missing asset: {ref}")
            return f"url({match.group(1)}{assets[ref]}{match.group(1)})"
        publish(name, CSS_URL.sub(css_replace, css).encode("utf-8"))

    # Pass 3: per-Naut navigation data. Rewrite the image references first,
    # then address each resulting JSON by its actual bytes.
    runtime = {}
    for name, path in sorted(original.items()):
        if not name.endswith("/page-data.json"):
            continue
        obj = json.loads(path.read_text(encoding="utf-8"))
        def images(value):
            if isinstance(value, dict):
                return {key: images(item) for key, item in value.items()}
            if isinstance(value, list):
                return [images(item) for item in value]
            if isinstance(value, str) and value.startswith("assets/"):
                if value not in assets:
                    raise ValueError(f"Unpublished runtime image: {value}")
                return assets[value]
            return value
        obj = images(obj)
        code = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"
        publish(name, code.encode("utf-8"))
        runtime[name] = obj
        js_name = name.replace(".json", ".js")
        # Generated initial data is equivalent to in-page JSON (legacy code
        # deliberately uses a mutable binding for the active Naut).
        publish(js_name, js_assignment("nautPage", obj).replace(
            "const nautPage=", "let nautPage=", 1).encode("utf-8"))

    # Pass 4: static/runtime JS. Roster data includes all immutable navigation
    # data URLs; the browser therefore never fetches mutable page-data.json.
    for name, path in sorted(original.items()):
        if path.suffix != ".js" or name.endswith("/page-data.js"):
            continue
        code = path.read_text(encoding="utf-8")
        if name == "roster-data.js":
            if not code.startswith("const archiveData="):
                raise ValueError("Unexpected roster-data.js schema")
            data = json.loads(code[len("const archiveData="):].strip().removesuffix(";"))
            for naut in data["roster"]:
                if naut["image"] not in assets:
                    raise ValueError(f"Missing roster image: {naut['image']}")
                naut["image"] = assets[naut["image"]]
                if naut["available"]:
                    key = f"nauts/{naut['slug']}/page-data.json"
                    if key not in replacements:
                        raise ValueError(f"Missing immutable Naut dataset: {key}")
                    naut["dataUrl"] = replacements[key]
            code = js_assignment("archiveData", data)
        else:
            code = rewrite_assets(code, assets)
        if name == "script.js" and "entry?.dataUrl" not in code:
            raise ValueError("In-page navigation must fetch versioned roster data URLs")
        publish(name, code.encode("utf-8"))

    # Pass 5: root and deep-link HTML. Each page points to the immutable
    # supporting files; no old supporting file is overwritten in the next run.
    for name, path in sorted(original.items()):
        if path.suffix not in (".html", ".htm"):
            continue
        document = html.fromstring(path.read_text(encoding="utf-8"))
        for node in document.xpath('//*[@src] | //*[@href]'):
            for attr in ("src", "href"):
                raw = node.get(attr)
                if not raw:
                    continue
                base = raw.split("?", 1)[0].split("#", 1)[0]
                prefix = "/" if base.startswith("/") else ""
                key = base.lstrip("/")
                if key in replacements:
                    node.set(attr, prefix + replacements[key])
                elif key.endswith((".js", ".css", ".woff2")) and (
                    not base.startswith(("http:", "https:")) and "://" not in base):
                    raise ValueError(f"Unversioned reference in {name}: {raw}")
        path.write_text("<!doctype html>\n" +
                        html.tostring(document, encoding="unicode", method="html"),
                        encoding="utf-8")

    # Keep players.json mutable: it is an intentionally refreshed 24h service
    # snapshot, not part of the versioned executable/UI dependency graph.
    mutable = {"players.json"}
    for name, path in original.items():
        if name not in mutable and not name.endswith((".html", ".htm")):
            path.unlink()
    state["immutable_release"] = True
    state["immutable_resources"] = len(replacements)
    marker.write_text(json.dumps(state, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Prepared immutable Neocities release: {len(replacements)} content-addressed "
          f"resources; mutable entrypoints and players.json preserved.")
    return replacements


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parents[1] / "dist")
    args = parser.parse_args()
    prepare(args.directory)
