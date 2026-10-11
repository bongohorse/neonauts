# Experiment: 34 Naut portraits as one sprite atlas

Status: **offline A/B benchmark only**, no published-site changes.

## Why these portraits

The archived roster contains exactly 34 source WebPs, each **256 × 256 px**.
All 34 are present together in the game's hexagonal Naut selector. The total
source payload is 436,126 bytes. This provides a better first sprite experiment
than item icons, because the roster requests its pictures together.

A 6 × 6 atlas has 36 positions, so two slots are empty. Pixel dimensions are
1536 × 1536. In a browser, a single WebP can replace 34 individual requests,
but **HTTP/2 or HTTP/3 multiplexing and browser caching reduce that advantage**.

## Reproducible offline comparison

Run with the repository's pinned Python environment:

    python scripts/benchmark_roster_sprite.py

or use the manual GitHub Action **Naut roster sprite benchmark**. Its artifact
contains all 34 original WebPs, a losslessly encoded atlas, lossy WebP atlas
candidates Q75/Q85/Q90/Q95, a per-icon coordinates manifest, exact byte counts
and a comparison.html page for visual inspection.

Measurements: combined source bytes vs atlas bytes; PSNR, maximum RGB error
and changed alpha pixels against the decoded original images. A lossy WebP atlas
**re-encodes** the already compressed originals; apparent size savings may
come at the cost of visible double-compression artifacts. A lossless atlas
preserves the original decoded pixels (not the source's compressed bytes).

## Existing UI architecture

The roster currently draws each portrait as an **SVG image element** clipped inside
a hexagon and keeps the roster controls as native buttons with keyboard access.
CSS background-position cannot simply replace those SVG images without a
separate rendering change. A follow-up prototype must retain:

- exact 256px tile mapping within the existing 78 × 90 SVG geometry and hex
  clip path, including source xMidYMid slice crop and color fidelity;
- selected, hover and focus states, aria labels, tooltips, keyboard navigation
  and Reduced Motion;
- direct & in-page route changes, immutable Neocities asset URLs and GitHub
  Pages /neonauts/ support;
- raster edge/gutter handling so adjacent faces cannot bleed when scaled.

## Decision gates

1. Inspect side-by-side images visually at real roster size and enlarged,
   looking for faces/text/artifact damage. Compare lossless vs lossy.
2. Integrate the chosen atlas only in a **separate experimental PR**, after
   considering SVG cropping. Preserve individual original icon files in source.
3. In native Chromium, compare cold/warm cache network waterfall, transferred
   bytes, paint/LCP (where applicable), and mobile/desktop responsiveness with
   equivalent browsing actions (5+ runs per case). Beware artificial throttling
   that can favor fewer requests.
4. Do not roll out unless there is a reproducible end-user benefit **and** no
   unacceptable image-quality, accessibility or cache regressions. A larger
   atlas may take longer to download/decode and invalidate all 34 portraits
   when just one source image changes.

## Safety

This experiment does not alter scripts/build.py, current roster styling,
Neocities deploy configuration, or any source picture. The workflow is
read-only and uploads only a GitHub Actions artifact. No site deployments.


## First benchmark result (GitHub Actions)

[Reproducible run](https://github.com/bongohorse/neonauts/actions/runs/38107937664)
· [visual side-by-side artifact](https://github.com/bongohorse/neonauts/actions/runs/38107937664/artifacts/11690094860)

All 34 source images passed the 256 × 256 check, totaling **436,126 bytes**.

| Decoded-source comparison | Output bytes | Saving versus existing source | Atlas PSNR | Worst Naut PSNR | Alpha error |
|---|---:|---:|---:|---:|---:|
| Individual WebPs (current) | 436,126 | baseline | reference | reference | reference |
| Lossless WebP atlas | 2,510,716 | **−475.69%** (larger) | exact | exact | 0 |
| WebP Q75 atlas | 270,704 | **+37.93%** | 34.05 dB | 32.75 dB | 0 |
| WebP Q85 atlas | 405,948 | **+6.92%** | 40.50 dB | 38.15 dB | 0 |
| WebP Q90 atlas | 471,916 | **−8.21%** (larger) | 40.67 dB | 38.62 dB | 0 |
| WebP Q95 atlas | 540,944 | **−24.03%** (larger) | 42.23 dB | 39.99 dB | 0 |

Saved-size percentages are **positive only for byte reductions**, unlike byte
deltas. PSNR is a decoded-pixel RGB quality metric; human perception in the
existing scaled/hex-clipped UI is not established by these numbers.

**Interpretation:** Combining these *already compressed* WebPs does **not**
necessarily reduce transferred bytes at acceptable quality. Lossless has no
decoded-pixel damage but costs ~5.76× as many bytes. Q90 is larger; Q85 saves
just ~30 KB and introduces second-pass image loss. Q75 saves ~165 KB but may
visibly degrade artwork. No visual approval or HTTP/2/3 network benchmark has
been performed yet. Do **not** change the public roster based only on the
HTTP request count dropping 34→1. Proceed to a separately reviewed SVG/
network A/B only if the user wants to test that tradeoff.
