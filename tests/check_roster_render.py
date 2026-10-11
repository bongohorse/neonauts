#!/usr/bin/env python3
"""Raster-level smoke: detect empty Naut hexagons despite valid SVG markup.

The previous nested-svg regression passed all structural and network checks
while most hexagons rendered only their flat dark (#05232d) background.
"""
import json
from pathlib import Path
from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tests" / "artifacts"
BACKGROUND = (5, 35, 45)


def check_roster_pixels(image_path=OUTPUT / "roster-sprite-root-desktop.png",
                        metadata_path=OUTPUT / "roster-sprite-centers.json"):
    centers = json.loads(metadata_path.read_text(encoding="utf-8"))
    if len(centers) != 34 or len({item["slug"] for item in centers}) != 34:
        raise AssertionError("Expected exactly 34 distinct Naut hexagons")
    with Image.open(image_path) as image:
        image = image.convert("RGB")
        outcomes = []
        for item in centers:
            cx, cy = item["x"], item["y"]
            half = max(4, min(item["width"], item["height"]) * 0.16)
            bounds = (round(cx-half), round(cy-half),
                      round(cx+half), round(cy+half))
            if bounds[0] < 0 or bounds[1] < 0 or bounds[2] > image.width or bounds[3] > image.height:
                raise AssertionError(f"Hexagon center outside roster screenshot: {item['slug']}")
            patch = image.crop(bounds)
            colors = ImageStat.Stat(patch)
            difference = sum(abs(actual - bg) for actual, bg in zip(colors.mean, BACKGROUND))
            detail = max(colors.stddev)
            visible = difference > 30 or detail > 12
            outcomes.append((item["slug"], visible, round(difference, 1), round(detail, 1)))
    painted = sum(visible for _, visible, _, _ in outcomes)
    empty = [slug for slug, visible, _, _ in outcomes if not visible]
    print(f"Roster raster smoke: {painted}/34 centers contain painted portrait pixels; "
          f"apparently empty centers: {empty}")
    # Allow a handful of exceptionally dark portraits, but never a blank roster.
    if painted < 28:
        raise AssertionError(
            "Hex portrait images are missing or incorrectly positioned: "
            f"only {painted}/34 have visible art (need >=28). "
            f"Metrics: {outcomes}"
        )


if __name__ == "__main__":
    check_roster_pixels()
