# Guarded Maps initialization — #34

The Maps script is still delivered with defer in its original dependency order.
Only DOM construction/rendering/listener binding is guarded until Maps is visible.
Initialization is synchronous and idempotent, triggered by the existing section
change event and an initial visibility check. That catches direct #maps hashes
which were routed before the deferred Maps script loaded. No new loading race,
framework or navigation/roster/radio cache was introduced.

Before-profile self samples identify map `render`, card creation and gallery
callbacks as real startup work. Representative EvaluateScript timing includes
parsing/native work and must not be equated with JS self time. The optional
profiler now also captures a CPU call-tree sample file; compact self-sample
counts are in startup-34-profile.json. Sampling is diagnostic, not an exact CPU
stopwatch; raw time deltas were not used as additive timing claims.

Five matching cold samples: startup-34-measurements.md / startup-34-samples.json.
Initial Maps card count is now zero rather than six, with no hidden dossier or
holiday gallery creation. Desktop JS CPU median falls to 29.429 ms; mobile to
33.490 ms. Desktop LCP 2612 → 2592 ms; mobile 1592 → 1612 ms (+1.3%).
Request count remains 27; this is initialization reduction, not code splitting.
Layout varies; no claim of solving the dominant initial document pass.

Before/after first-run native viewport PNGs are pixel-identical on desktop and
mobile (Pillow ImageChops has no difference bounds). All 34 Naut selections,
rapid aborted Ayla/Clunk selection, history/skins, reduced-motion, maps first
open/direct hash/reopen and immutable release fallback pass native smoke.
Map card count stays six after repeated opens. 58 Python tests, all four Node
suites, three build checkers and 34/34 portrait raster checks pass.
Physical touch/audio/background-tab acceptance is separate. No merge/deployment.
