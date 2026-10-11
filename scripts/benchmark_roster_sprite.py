#!/usr/bin/env python3
"""Offline A/B encoding experiment for 34 Naut roster portraits.

Never edits source pictures, generated site files, or production HTML.
Emits 6x6 atlas candidates, a visual comparison page, metrics and the
per-character rect manifest. Original 256x256 decoded pixels are the
quality reference; WebP encoding an atlas can cause a second lossy pass.
"""
import argparse
import hashlib
import html
import json
import math
import shutil
from pathlib import Path
from io import BytesIO

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/static"
ROSTER = ROOT / "data/roster.json"
TILE = 256
COLS = 6
ROWS = 6
DISPLAY = 96


def load_portraits():
    roster = json.loads(ROSTER.read_text(encoding="utf-8"))
    if len(roster) != 34:
        raise ValueError(f"Expected 34 Naut portraits, got {len(roster)}")
    paths = set()
    pictures = []
    for index, naut in enumerate(roster):
        relative = Path(naut["image"])
        if (relative.is_absolute() or ".." in relative.parts or
                relative.parts[:2] != ("assets", "nauts") or
                not relative.name.startswith("IconCharacter") or
                relative.suffix.lower() != ".webp"):
            raise ValueError(f"Unexpected roster image path: {relative}")
        if relative in paths:
            raise ValueError(f"Duplicate roster image: {relative}")
        paths.add(relative)
        source = SOURCE / relative
        if source.is_symlink() or not source.is_file():
            raise ValueError(f"Missing portrait source: {source}")
        with Image.open(source) as image:
            image.load()
            if image.size != (TILE, TILE):
                raise ValueError(f"Portrait is not 256x256: {source}: {image.size}")
            rgba = image.convert("RGBA")
        pictures.append({
            "name": naut["name"], "src": relative.as_posix(),
            "file": source, "decoded": rgba, "slot": index,
            "col": index % COLS, "row": index // COLS
        })
    return pictures


def metric(atlas, pictures):
    sum_mse = 0.0
    sum_mae = 0.0
    max_error = 0
    changed_alpha = 0
    per_naut_psnr = []
    for item in pictures:
        x, y = item["col"] * TILE, item["row"] * TILE
        candidate = atlas.crop((x, y, x + TILE, y + TILE)).convert("RGBA")
        difference = ImageChops.difference(item["decoded"], candidate)
        rgb = ImageStat.Stat(difference.convert("RGB"))
        mse = sum(value * value for value in rgb.rms) / 3
        sum_mse += mse
        sum_mae += sum(rgb.mean) / 3
        max_error = max(max_error, *(value[1] for value in difference.getextrema()[:3]))
        changed_alpha += ImageStat.Stat(difference.getchannel("A")).sum[0]
        per_naut_psnr.append(None if mse == 0 else 10 * math.log10(255 * 255 / mse))
    mse = sum_mse / len(pictures)
    return {
        "mae_rgb": round(sum_mae / len(pictures), 4),
        "psnr_rgb_db": "exact" if mse == 0 else round(10 * math.log10(255 * 255 / mse), 2),
        "worst_naut_psnr_db": "exact" if all(value is None for value in per_naut_psnr)
                               else round(min(x for x in per_naut_psnr if x is not None), 2),
        "max_rgb_channel_error": int(max_error),
        "sum_alpha_absolute_error": int(changed_alpha)
    }


def comparison_page(pictures):
    sections = []
    for p in pictures:
        name = html.escape(p["name"])
        image_name = html.escape(p["file"].name, quote=True)
        col, row = p["col"], p["row"]
        sprite_style = f"background-position:-{col*DISPLAY}px -{row*DISPLAY}px"
        sections.append(
            f'<section class="compare"><h2>{name}</h2><div class="tiles">'
            f'<figure><img src="originals/{image_name}" alt="{name} original"><figcaption>Original</figcaption></figure>'
            f'<figure><span class="icon lossless" style="{sprite_style}" role="img" aria-label="{name} lossless atlas"></span><figcaption>Lossless</figcaption></figure>'
            f'<figure><span class="icon q90" style="{sprite_style}" role="img" aria-label="{name} Q90 atlas"></span><figcaption>Q90</figcaption></figure>'
            '</div></section>'
        )
    return ('''<!doctype html><html lang="en"><meta charset="utf-8">
<title>Naut roster sprite A/B — no website changes</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font:14px system-ui,sans-serif;color:#e9f8fc;background:#081e2b;margin:24px}
header{max-width:960px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.compare{padding:12px;border:1px solid #396473;border-radius:10px}
h2{font-size:15px;margin:0 0 12px}.tiles{display:flex;gap:8px}
figure{margin:0;text-align:center}figcaption{font-size:12px;margin-top:6px}
img,.icon{display:block;width:96px;height:96px}
.icon{background-repeat:no-repeat;background-size:576px 576px}
.icon.lossless{background-image:url(sprite-lossless.webp)}
.icon.q90{background-image:url(sprite-q90.webp)}
</style>
<header><h1>Roster sprite A/B</h1><p>34 Naut portraits, 256×256 source pixels,
6×6 grid (1536×1536). Open locally to compare the decoded originals with
a lossless WebP atlas and a second-generation quality-90 WebP atlas.
This experiment does not use the site's SVG honeycomb clipping.
File-size savings do not prove load-time savings.</p></header><main>
''' + "\n".join(sections) + '</main></html>\n')


def benchmark(output):
    pictures = load_portraits()
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    originals = output / "originals"
    originals.mkdir(exist_ok=True)
    source_bytes = 0
    atlas = Image.new("RGBA", (COLS * TILE, ROWS * TILE), (0, 0, 0, 0))
    manifest = []
    for item in pictures:
        x, y = item["col"] * TILE, item["row"] * TILE
        atlas.paste(item["decoded"], (x, y))
        shutil.copyfile(item["file"], originals / item["file"].name)
        n = item["file"].stat().st_size
        source_bytes += n
        manifest.append({
            "name": item["name"], "source": item["src"],
            "rect": {"x": x, "y": y, "width": TILE, "height": TILE},
            "source_bytes": n,
        })
    variants = [("lossless", {"lossless": True, "method": 6})]
    variants.extend((f"q{q}", {"quality": q, "method": 6}) for q in (75, 85, 90, 95))
    report = {
        "source_count": len(pictures), "source_bytes": source_bytes,
        "source_sha256": hashlib.sha256("".join(
            hashlib.sha256(item["file"].read_bytes()).hexdigest() for item in pictures
        ).encode()).hexdigest(),
        "atlas_dimensions": list(atlas.size),
        "request_count_baseline": len(pictures),
        "request_count_single_atlas": 1,
        "note": "Bytes/decoded fidelity only: no synthetic latency claims. Image+SVG integration not performed.",
        "variants": []
    }
    for name, settings in variants:
        outfile = output / f"sprite-{name}.webp"
        atlas.save(outfile, format="WEBP", **settings)
        with Image.open(outfile) as reloaded:
            reloaded.load()
            fidelity = metric(reloaded, pictures)
        # A fair control: recompress the *same* decoded source pixels with
        # exactly the same WebP encoder settings, but as 34 separate files.
        # This isolates what the atlas changes beyond simply lowering q.
        same_quality_separate_bytes = 0
        individual_mosaic = Image.new("RGBA", atlas.size, (0, 0, 0, 0))
        for item in pictures:
            buffer = BytesIO()
            item["decoded"].save(buffer, format="WEBP", **settings)
            encoded = buffer.getvalue()
            same_quality_separate_bytes += len(encoded)
            with Image.open(BytesIO(encoded)) as image:
                image.load()
                individual_mosaic.paste(
                    image.convert("RGBA"), (item["col"]*TILE, item["row"]*TILE))
        payload = {
            "name": name, "bytes": outfile.stat().st_size,
            "change_bytes": outfile.stat().st_size - source_bytes,
            "saving_percent": round(100 * (1 - outfile.stat().st_size / source_bytes), 2),
            "separate_same_encoder_bytes": same_quality_separate_bytes,
            "atlas_vs_separate_same_encoder_saving_percent": round(
                100 * (1 - outfile.stat().st_size / same_quality_separate_bytes), 2),
            "decoded_quality": fidelity,
            "separate_same_encoder_decoded_quality": metric(individual_mosaic, pictures),
        }
        report["variants"].append(payload)
    (output / "sprite-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "comparison.html").write_text(comparison_page(pictures), encoding="utf-8")
    print("ROSTER SPRITE BENCHMARK: 34 individual 256x256 WebPs "
          f"= {source_bytes} bytes; one atlas = 1536x1536 pixels.")
    for variant in report["variants"]:
        fidelity = variant["decoded_quality"]
        print(f"  {variant['name']:8s}  {variant['bytes']:9d} bytes   "
              f"{variant['saving_percent']:+7.2f}% saved   "
              f"RGB PSNR: {fidelity['psnr_rgb_db']} dB   "
              f"worst Naut: {fidelity['worst_naut_psnr_db']} dB   "
              f"alpha error sum: {fidelity['sum_alpha_absolute_error']}\n"
              f"               34 separate images at same q: "
              f"{variant['separate_same_encoder_bytes']} bytes; "
              f"atlas-vs-equal-q saving: "
              f"{variant['atlas_vs_separate_same_encoder_saving_percent']:+.2f}%")
    print(f"Offline visual comparison and original images in: {output}")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path,
                        default=ROOT / "tests/artifacts/roster-sprite-benchmark")
    args = parser.parse_args()
    benchmark(args.out)
