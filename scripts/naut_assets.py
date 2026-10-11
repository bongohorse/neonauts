"""Copy only published Naut artwork and coalesce byte-identical imports.

Source images in src/static/assets/nauts/ remain untouched. The build-only
paths are deterministic and can be used by both HTML and runtime JSON/JS.
"""
import hashlib
import shutil
from collections import defaultdict
from pathlib import Path


def runtime_images(runtime):
    for ability in runtime["abilities"]:
        if ability["image"]:
            yield ability["image"]
    for item in runtime["items"]:
        if item["image"]:
            yield item["image"]
    for skin in runtime["skins"].values():
        if skin["image"]:
            yield skin["image"]


def publish_naut_assets(static_root, output, runtimes, roster):
    """Return original->published image URL mapping and counts.

    Only references known to the renderer and character roster are published.
    A missing source image is an error; never silently remove broken URLs.
    Non-Naut static assets are copied by the site's ordinary copytree step.
    """
    static_root = Path(static_root)
    output = Path(output)
    raw_refs = {ref for runtime in runtimes for ref in runtime_images(runtime)}
    raw_refs.update(entry["image"] for entry in roster if entry.get("image"))
    references = sorted(ref for ref in raw_refs if ref.startswith("assets/nauts/"))
    groups = defaultdict(list)
    for ref in references:
        relative = Path(ref)
        if (relative.is_absolute() or ".." in relative.parts or
                relative.parts[:2] != ("assets", "nauts")):
            raise ValueError(f"Unsafe Naut image path: {ref}")
        source = static_root / relative
        if source.is_symlink() or not source.is_file():
            raise ValueError(f"Missing Naut image source: {ref}")
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        groups[(digest, relative.suffix.lower())].append(ref)

    aliases = {}
    for (digest, extension), originals in sorted(groups.items()):
        # Common upgrades may be imported once per character. Use one
        # content-addressed output file, without rewriting source datasets.
        target = (f"assets/nauts/shared/{digest}{extension}" if len(originals) > 1
                  else originals[0])
        src = static_root / originals[0]
        dst = output / target
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        for original in originals:
            aliases[original] = target
    published = len(groups)
    source_files = [p for p in (static_root / "assets/nauts").rglob("*") if p.is_file()]
    source_bytes = sum(p.stat().st_size for p in source_files)
    published_files = [p for p in (output / "assets/nauts").rglob("*") if p.is_file()]
    published_bytes = sum(p.stat().st_size for p in published_files)
    print(f"Naut image archive: {len(source_files)} files ({source_bytes} bytes) -> "
          f"{published} public files ({published_bytes} bytes). "
          f"Sources referenced: {len(references)}; removed from public output: "
          f"{len(source_files) - published} file copies / {source_bytes - published_bytes} bytes. "
          f"Deduplicated references: {len(references) - published}.")
    return aliases
