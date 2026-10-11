# Optional script loading gate — #35

Decision: **NO-GO now**. Keep #34's guarded synchronous initialization and the
existing deferred scripts. The temporary async Maps loader was measured and
fully reverted. This is a comparison, not an unvalidated production loader.

| Design | Initial behavior | First Maps visit | Release/UX complexity |
|---|---|---|---|
| Existing defer + #34 guard | Two Maps scripts delivered; no hidden Maps DOM | Synchronous setup; only art loads | Existing ordered globals; no loader |
| Measured lazy prototype | Two Maps scripts excluded until intent | Sequential dependency download, then init | Pending/error states, retry, direct-hash race, hash-version resolution |

Prototype replaces the Maps script tags with a non-executable custom MIME type
while preserving their versioned src attributes; a section-event loader creates
real script tags in dependency order. No bundler is needed. But this prototype
has no accepted error/loading UX and was never proposed as production-ready.

Five cold runs per desktop/mobile design: splitting-35-measurements.md and
splitting-35-samples.json (explicitly prototype observations, not final sources).
Responses 27 → 25; encoded bytes 566520 → 545276 (−21244 bytes).
Desktop median LCP 2592 → 2456 ms (−5.2%); mobile 1612 → 1600 ms (−0.7%).
Desktop JS median 29.429 → 33.584 ms; mobile 33.490 → 33.172 ms. No consistent
JS CPU win after guarded initialization. Desktop cold LCP gain is real in this
sample set but is weighed against first-use delay rather than ignored.

Read-only local first-use probe: tests/section-readiness.mjs. Five fresh contexts,
same CPU ×4 / Fast-4G-like network / DPR1.25 as #30, two seconds after Load,
then navigate to Maps and measure six controls ready / hero decoded. Prototype
control samples: 595.2, 607.5, 614.9, 611.3, 598.3 ms; median 607.5 ms.
Artwork readiness median 1145.1 ms. Guarded control samples: 250.1, 186.4, 196.9, 207.8, 249.7 ms; median
207.8 ms. Guarded artwork median 742.9 ms. Thus the loader adds roughly
400 ms to first-use DOM readiness and artwork. The probe measures DOM/decode
readiness, not field INP or the final View Transition presentation. Both designs
retain the approved transition. Data: splitting-35-readiness.json. Cached script delivery is not mistaken for a cold
first click. Prototype URLs come from existing tags, but immutable/rollback/CSP
and failure UX would require more review before a GO.

Other optional scripts are small: features.js 5609 source bytes, players.js +
steam-stats.js 4801 source bytes. Deferring guestbook restoration or player
refresh needs lifecycle/error handling; their current profile cost is small.
Roster/routing/skins/radio remain essential; do not trade away first-click readiness
or preserved playback. The external ~31 KiB compressed JS figure is not our
uncompressed source-byte budget and is not combined with it.

No production module loader is retained. Native direct #maps/#guestbook/
#community/#goodies tests are added on root/Pages/immutable outputs, including
reopening without duplicate DOM. Site source bytes are exactly those of #34.
The benchmark now records a tracked source-diff digest to distinguish temporary
experimental builds from their base revision; this does not hash untracked files.

Final source parity: scripts/templates restored byte-for-byte to #34. The extra
probe initially tried decoding a lazy image before section presentation; it now
waits for the current image to load and then verifies decode. No site bug inferred.

Native direct-section, all-34-Naut/rapid-nav and existing root/Pages/immutable
smoke pass; raster portraits 34/34 pass; metric tests pass. #34's 58 Python
and four Node checks are retained because final site sources did not change.
A direct-load test initially used same-path hash navigation, which correctly
retains initialized Maps; it now changes the query to force a fresh document.
Physical touch/audio and production CDN behavior remain separate.
