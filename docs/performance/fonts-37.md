# Conservative font/render audit — #37

Retained change: one crossorigin font preload for the existing Rubik WOFF2.
CSS @font-face, font-display:swap, weights/fallbacks, shadows/filters, palette,
SVG masks, cursor, responsive cascade and every animation remain unchanged.
The preload is the same relative URL already used by CSS; immutable preparation
rewrites it together with the stylesheet reference. No extra font download.

Before, the ~17.7 KB font request starts around 1.44–1.52 s in representative
native traces and completes near 2.0–2.1 s. With preload it starts ~172 ms and
ends ~730–761 ms in representative cold samples, ahead of initial rendering.
The retained change targets demonstrated late font discovery rather than
inventing a font cause for every historical 103/146 ms layout peak.

Five-run evidence: fonts-37-measurements.md / fonts-37-samples.json.
Desktop layout CPU median 150.192 → 84.635 ms (range 58.664–116.286 ms);
mobile 149.060 → 81.309 ms. Desktop FCP 1692 → 1664 ms; LCP 2076 → 2120 ms
(+2.1% priority contention). Mobile FCP/LCP 1684 → 1612 ms. Mobile CLS
0.000379 → 0; desktop remains 0. All 27 responses retained, no duplicate font.
Desktop script CPU rises 30.441 → 39.622 ms, mobile stays similar; total CDP
TaskDuration median falls 515.443 → 465.002 ms desktop, 510.689 → 467.679 ms
mobile. CPU categories are not summed. Spread is substantial; these are lab
observations, not a promised percentage on other devices.

Representative post-preload trace: document-root dominant Layout 62.340 ms
desktop / 64.806 ms mobile; total layout 71.997 / 76.801 ms. This is an
independent trace, not one of the five benchmark samples; trace overhead and
API totals differ. Compact root evidence is in fonts-37-trace.json.
Initial native before/after desktop/mobile PNGs are exactly pixel-identical.

The native effect audit measures initial attribution and interactive roster
hover, skin animation and section transition with all approved effects present.
Pre-change interactive Paint max is 3.886 ms desktop / 6.073 ms mobile; Layout
max 37.168 / 42.321 ms includes section initialization. These are event durations,
not self-time attribution of a shadow or selector. CompositeLayers is absent in
this trace configuration, so no GPU/compositor improvement is inferred.
There is no evidence supporting filter removal, blanket will-change,
content-visibility, system-font replacement or broad legacy CSS cleanup.
Repeated responsive overrides must be assessed as a cascade, not assumed dead.
No effect/CSS rewrite is retained without rule-level evidence and pixel parity.

Font/hero single-request, stage fit, reduced-motion and interactive evidence:
fonts-37-render-audit.json. Full native PNGs/traces remain ignored artifacts.
`node tests/render-audit.mjs` reproduces the audit after building root output.
The native smoke also retains focus/keyboard/history/all-34-Naut/direct-section/
Arcade/immutable release tests. Browser tests explicitly collect console errors;
benchmark network failures are now classified by requested origin so a blocked
same-origin resource cannot be silently excluded as third-party noise.

Draft review only. Physical touch/audio/background-tab acceptance, production
CDN tests and field CWV remain separate; no merge or deployment.

Final local validation passes: 58 Python tests, four Node suites, two measurement
correctness tests, root/Pages/immutable build checkers, expanded console-checking
native smoke, all 34 Nauts/rapid aborts/direct sections and 34/34 portrait raster
checks. Eight native render cases pass font single-request, decoded/stage-contained
hero and reduced-motion assertions; interactive traces are recorded on both
viewports. CI performs the final committed five-run collection independently.
