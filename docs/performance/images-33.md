# Hidden image request audit — #33

Retained: native lazy loading on nine Goodies preview SVGs (existing explicit
width/height retained) and the hidden map dossier splash (300×169 retained).
Hero, logo, atlas and skin thumbnails remain eager. Existing lazy map cards,
layout/holiday images and item icons are unchanged. No custom loader/prefetch.

The initial inventory showed all nine hidden Goodies requested before desktop
LCP, and the hidden Ribbit splash before Load. Ability icons are shared by the
visible strip and hidden cards; changing the cards adds no unique request win.
Skin thumbnails are within Chromium's lazy proximity threshold: the candidate
still requested both alternate images. That candidate and lazy ability flags
were removed. The desktop LCP variation persists without those flags; it cannot
be attributed causally to skin thumbnails alone.

Five-run before/after: images-33-measurements.md / images-33-samples.json.
All five runs: responses 37 → 27, encoded bytes 588366 → 566253 (−22113 bytes).
Completed Resource Timing entries before desktop LCP: 34 → 25; before Load:
36 → 26 on both viewports. These exclude document navigation (reported separately
by CDP) and are response-completion counts, not in-flight request-start counts.
Mobile pre-LCP resource completions: 15 → 14/15 because the logo is LCP.

Trade-off: desktop LCP median 2476 → 2612 ms (+5.5%); mobile 1568 → 1592 ms
(+1.5%). This is a request/byte reduction, **not a demonstrated LCP speedup**.
CLS stays 0 desktop / 0.000379 mobile; no eager critical image became lazy.
The Draft PR deliberately exposes this modest synthetic timing penalty for
review rather than claiming success on every metric. Retaining the two small
attribute changes eliminates confirmed invisible requests without loader complexity;
#36 separately investigates hero priority. Do not treat future gains as already proven.

Native assertions verify no hidden Goodies/map-splash request at startup and
all nine previews decode after Goodies activation, map splash after Maps,
and selected skin artwork after navigation. Existing skins, maps, history,
Arcade and immutable mixed-release behavior remain covered. Build assertion
checks all 34 hero src values remain parser-discoverable and not lazy.

Physical touch/audio/CDN behavior is separate. No merge/deployment.

Validation passed: 58 Python tests, all four Node suites, all three build
checkers, native root/Pages/immutable smoke and 34/34 portrait raster checks.
Goodies has a hash link rather than a data-section navigation button; the
browser test activates that hash route and validates real decoded images.
