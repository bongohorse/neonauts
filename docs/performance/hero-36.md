# Current hero request priority — #36

The generator adds fetchpriority="high" to the already parser-discoverable,
eager current Naut hero. No preload, resizing/re-encoding, animation removal,
new asset or cache is introduced. Every direct dossier prioritizes its own art;
only one hero URL is requested even when its thumbnail shares that URL.

Five cold matching runs: hero-36-measurements.md / hero-36-samples.json.
Desktop LCP median 2592 → 2076 ms (−19.9%); range after 2064–2128 ms.
Desktop FCP 1572 → 1692 ms (+7.6%); mobile logo LCP 1612 → 1684 ms (+4.5%).
Priority reallocates bandwidth, not free speed: these trade-offs are explicit,
within the issue's 10% guard, and do not justify preloading every image.
Responses stay 27; CLS 0 desktop / 0.000379 mobile. Before/after first-run
viewport PNGs are exactly pixel-identical for desktop and mobile.

Resource Timing / LCP phases for all ten before/after samples: hero-36-phases.json.
Default desktop first after sample: hero discovery ~201 ms, response ends
2042.3 ms, LCP 2076 ms (~33.7 ms after resource end). Resource duration includes
queueing/download; Performance API alone does not resolve HTTP scheduling or
image decode self time. This local default does not reproduce the external
483 ms render interval, so it cannot establish animation causality there.

Native attribution also covers direct Clunk and Gnaw on both viewports and
reduced-motion root: hero-36-attribution.json. Desktop LCP is character-art;
mobile LCP is the logo. All hero images decode, fit the stage and have exactly
one request. Normal arrival animation remains; reduced motion reports none.
Other dossiers can have longer resource-end-to-LCP intervals; the audit does
not mislabel all of that time as animation. Native interactive traces preserve
roster hover, skin animation and section transitions under existing effects.
No GPU/compositor duration claim follows from absent CompositeLayers events.

Reproduce: build root, then `node tests/render-audit.mjs`; ignored native PNGs
and interactive traces go under tests/artifacts/render-audit/. The root/default
five-run benchmark remains the quantitative before/after gate. Physical
touch/audio, production CDN and field CWV are separate. Draft; no deployment.

Validation: 58 Python tests (all 34 generated heroes checked for priority/eager
src), four Node suites, all three build checkers/native smoke and 34/34 raster
portraits pass. All 34 enhanced dossier selections and rapid abort/history/
section/direct-hash/Arcade paths remain in the native suite.
