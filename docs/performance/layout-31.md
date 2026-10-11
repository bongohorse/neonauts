# Initial layout audit — #31

Decision: **NO-GO for roster batching / broad CSS changes**. The experimental
change was reverted; approved site sources are identical to #30.

Native Chromium trace, fixed #30 conditions, main-frame layout roots:
- Desktop: document root, 215 dirty/total objects, 128.391 ms at +1398.155 ms.
  This precedes `script.js` (+1545 ms); it cannot be caused by roster construction.
- Desktop later document layout: 16.130 ms at +2014 ms, 499 dirty / 569 total.
- Mobile: document root, 110.625 ms; next document pass 23.200 ms.
- These Layout events have no enclosing EvaluateScript/FunctionCall on the same
  thread. They are ordinary scheduled document layout, not proven JS-forced layout.
- Startup mutations are real: `drawGame` invalidates document layout on mobile;
  `features.js` populates the hidden guestbook selector. Their invalidations do
  not establish that either is responsible for the entire subsequent layout pass.
  Arcade is handled in #32; section initialization is assessed in #34/#35.

Controlled candidate: build both roster wings detached, then append once after
all 34 portraits. Browser already batches pending synchronous writes; there are
no geometry reads between portrait insertions in source. Five independent
samples per scenario, compared with the five #30 baseline samples:

| Scenario | Metric (ms) | Baseline median (min–max) | Candidate median (min–max) |
|---|---|---:|---:|
| root-desktop | fcp | 1564.000 (1532.000–1688.000) | 1604.000 (1560.000–1672.000) |
| root-desktop | lcp | 2472.000 (2468.000–2480.000) | 2472.000 (2472.000–2476.000) |
| root-desktop | layout | 124.674 (110.311–145.522) | 124.878 (122.575–142.555) |
| root-desktop | script | 51.284 (47.708–57.230) | 50.622 (43.990–56.236) |
| pages-mobile | fcp | 1580.000 (1556.000–1692.000) | 1636.000 (1552.000–1664.000) |
| pages-mobile | lcp | 1580.000 (1556.000–1692.000) | 1636.000 (1552.000–1664.000) |
| pages-mobile | layout | 134.899 (128.446–160.526) | 125.491 (117.950–142.450) |
| pages-mobile | script | 52.263 (44.781–54.182) | 50.857 (43.735–63.439) |

The desktop layout median does not improve, and ranges overlap on both
viewports. Mobile-only changes do not establish a repeatable causal win.
Keeping speculative batching would add churn without solving the dominant
initial document pass. No global containment, SVG simplification, font change
or blanket content-visibility was retained. FCP/LCP have no >10% median regression.
CLS remains 0 desktop / 0.000379 mobile. No guaranteed production speedup.

Reproduce diagnostic after `python scripts/build.py --out dist-browser-root`:
`node tests/profile-startup.mjs`. Full traces remain ignored under
`tests/artifacts/startup-profile/`; compact root/event evidence is committed in
layout-31-trace.json. Candidate raw samples are in layout-31-candidate.json.
The profiler requires running at the repo root and does not hit production.

Limit: these are newly recorded local traces, not the external user's original
103/146 ms peaks. Root attribution is #document; the trace does not resolve a
specific CSS selector as their cause. A sub-tree attribution/selector claim
would require additional instrumentation. This audit closes the speculative
batching proposal, not every possible future rendering optimization.

Validation: #30 native root/Pages/immutable smoke, all 34 raster portrait checks,
57 Python tests, four Node suites and both root/Pages site checkers passed.
Final site source is unchanged; profiler syntax passes. Physical touch/audio
and CDN performance remain unverified. Draft only; no merge or deployment.
