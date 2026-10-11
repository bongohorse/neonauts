# Full repository code review — 11 October 2026

Reviewed source revision: `77ddbe91ea4dc9200e3ab918e488b242b89c0835` (main after PRs #38–#45).

The original review found one P1 and five P2 defects despite passing automated
checks. Findings and captured probe results below describe the reviewed revision;
they are retained as before-fix evidence.

## Resolution in PR #46

All six functional findings are repaired, with regression coverage:

- R1: canonical XPath values become plain strings at extraction. A real saved
  HTML import succeeds; malicious canonical URLs still fail before dataset replacement.
- R2: every history intent cancels outstanding dossier work, including a return
  to the already rendered path. Selecting the current roster tile also cancels
  pending work. If history currently points elsewhere, that tile navigates to
  its own URL. Native tests independently hold HTML and JSON, exercise rapid
  Back/Forward and reselection, and check cancellation, busy state, URL and content.
- R3: copied HTML retains the documented self-hosting placeholder and original
  download filename. Actual download links still use immutable filenames when
  appropriate. All nine download bytes and embed paths are checked; native
  tests exercise the clipboard flow in all three builds.
- R4: bounded, validated histories are deduplicated and sorted before choosing
  the latest 120 samples. Two full origins, reversed order and duplicate origins
  retain the same newest points. Timestamps are normalized to UTC for ordering.
- R5: upload preflight compares every supporting file's SHA-256 prefix with its
  filename before any API call. Modified staging bytes fail closed.
- R6: Arcade and map dialogs reference their visible titles. Native tests query
  their accessible dialog names while preserving existing opening/closing behavior.

The P3 status/atlas-comment corrections are included. Raster checks now explicitly
require the five last-row portraits; a synthetic missing-row regression test
proves they cannot hide inside the overall allowance for dark artwork. Broad CSS
cascade cleanup remains a maintenance observation, with no demonstrated defect
or performance benefit that would justify changing rendering in this repair.

Local verification: 62 Python tests, four Node suites, two metric tests, all three
build variants and checkers, native Chromium smoke for root/Pages/immutable, and
34/34 painted portraits pass. GitHub CI and publication outcomes are recorded on
[PR #46](https://github.com/bongohorse/neonauts/pull/46). The original observation
scripts/results below remain historical; the maintained tests assert fixed behavior.

## Post-fix import discovery

After R1 allowed real HTML through URL validation, a second importer defect could
be reproduced with valid canonical/ability URLs and a Stats table, but no embedded
portrait. The importer accepted and replaced the old dataset; `page_data` then
failed with `KeyError(None)` because the default portrait is required by the build.

A follow-up repair rejects missing/unextracted portraits before changing data or
assets. The actual HTML regression test covers both an absent portrait node and a
remote-only image, and checks that the previous dataset/artwork remain untouched.
Missing optional ability/skin artwork remains supported. Local Python coverage
now totals 63 passing tests. This is an additional confirmed defect, separate from
the six original findings and their frozen before-fix captures.

## Findings, in recommended repair order

### R1 — P1: Real HTML imports reject a valid canonical Wiki URL

**Location:** `scripts/extract_naut.py:187–188`, `scripts/url_policy.py:11–13`,
`scripts/import_naut.py:16–17`.

XPath returns the canonical URL as lxml's `_ElementUnicodeResult`, a `str`
subclass. `require_wiki_url()` requires `type(value) is str`. Therefore the
normal extractor-to-importer path rejects a valid canonical HTTPS Wiki URL
before saving it. Existing datasets read through JSON work because their URLs
are plain strings. This blocks imports with a canonical link, regardless of
whether its host/path are allowed; a missing canonical link is also rejected.

**Reproduced:** a local Wiki fixture with canonical
`https://awesomenauts.fandom.com/wiki/Ayla`, a Stats table and an ability fails
with `ValueError: ayla: canonical source: missing or oversized external Wiki URL`.
The original maintained dataset is preserved. The failure occurs at the URL
boundary, before checks of the fixture's incomplete artwork/content.

**Repair:** normalize extracted URL values to plain strings at the extraction
boundary, keeping the strict host/scheme/credential/control-character policy.
Add an end-to-end import test using actual HTML and real extraction, not a
mocked dictionary or only extractor-to-JSON tests. Preserve malicious-URL
rejection before any maintained write. After this blocker is repaired, also
exercise missing required portrait references before allowing a reimport to
replace an accepted dataset; that is a follow-up validation question, not a
seventh confirmed end-to-end finding in this review.

### R2 — P2: An outstanding history load can render the wrong Naut for the URL

**Location:** `src/static/script.js:80`, `:116–158`, especially `:158`.

The popstate handler compares the URL with the last *rendered* path. When Back
starts a slow Ayla fetch from Clunk and Forward returns to Clunk before that
fetch completes, the handler does nothing because Clunk still equals
`currentNautPath`. The Ayla request remains active and replaces the dossier
without pushing history. The result is Clunk's URL with Ayla's title, hero,
content and selected roster button. The aborted-request check does not help
because this path never aborts the request.

**Reproduced in native Chromium:** root → Ayla → Clunk; hold the Back-triggered
Ayla HTML fetch; Forward to Clunk; release the response. Result:
`pathname=/nauts/clunk/`, `nautPage.slug=ayla`, title `Ayla — Awesomenauts`.
Related case: click Ayla while on Swiggins, then click the still-rendered
Swiggins button before Ayla finishes. The second click only selects Overview;
Ayla still wins despite the later selection.

**Repair:** invalidate/abort pending navigation on every relevant new history
or roster intent, even when the requested path is already rendered. Keep a
navigation generation or requested target separate from the rendered path;
commit only the current request. For popstate commits, also verify that the
current URL still matches the request. Test controlled delayed HTML and JSON,
Back/Forward, selecting the current Naut, cancellation and focus/busy cleanup
under root, Pages and immutable builds.

### R3 — P2: Copied Goodies HTML points at files absent from immutable releases

**Location:** `scripts/build.py:187–191`, `scripts/prepare_neocities_release.py:139–162`,
`src/templates/shell.html:29`, `src/static/features.js:14–23`.

Staging rewrites real `src`/`href` attributes, but the HTML inside `.embed-code`
textareas is text and is never rewritten. The original SVGs are then removed
from the staged release. Previews/downloads correctly use hashed assets, while
COPY HTML still emits unversioned `/assets/goodies/*.svg` URLs.

**Reproduced:** all nine copied image URLs return HTTP 404 when their production
origin is mapped to a fresh local immutable build. This is not a claim that all
nine currently return 404 on production: retained legacy remote files could
mask the problem, but those copies are not part of the current release and
could remain stale after a graphic changes.

The visible instructions describe downloading the graphic, uploading it to
one's own website and replacing `YOUR-SITE`. However, `build.py` already
replaces that placeholder with this archive's production origin. A repair
must choose and consistently implement the intended user flow.

**Repair:** for the documented self-hosting flow, retain the `YOUR-SITE`
placeholder and the original filename supplied by the download attribute;
test that the copied template matches the downloaded filename. If direct
hotlinking is intentionally offered instead, emit the published hashed URL
and explain that flow; test it against an immutable build with no legacy
files. Do not blindly hash the copied filename while the download still saves
the original name. Test preview, download and clipboard/selection fallback.

### R4 — P2: History merging drops newer observations before chronological sorting

**Location:** `scripts/fetch_players.py:18–28`, `:36–43`.

Each previous source yields up to 120 points. Combining two sources can produce
240 points; `clean_history()` truncates the concatenation to its last 200
entries *before* chronological sorting and deduplication. Which endpoint comes
second can therefore remove newer observations from the first endpoint while
retaining older observations from the second. The final output has the expected
length but wrong membership, changing recorded graph/summary information.

**Reproduced offline:** first endpoint has 120 samples aged 0–119 minutes;
second endpoint has 120 aged 120–239 minutes. The merged 120-point history
contains only 80 of the newer source's points and 40 older points. Its oldest
sample is 159 minutes old; the correct latest-120 set is the first endpoint.

**Repair:** retain a per-input resource bound, then merge all bounded candidates,
normalize timestamps, deduplicate and sort before taking the latest 120.
Regression cases must fill both inputs, reverse endpoint order, overlap
timestamps and cover outage/stale/invalid samples. No fabricated samples.

### R5 — P2: The immutable-upload guard validates filename shape, not its local hash

**Location:** `scripts/deploy_neocities.py:209–218`, `:238–246`.

`--require-immutable` checks the staging marker and a 24-hex filename suffix,
but never verifies that the digest matches the current local bytes. A support
file changed after preparation passes the guard. If its named path is absent
remotely, the remote-collision check also cannot detect it: upload and manifest
verification compare against the altered local bytes. This can publish bytes
under an incorrect content-addressed name and make a later correct release
collide with that path. Ordinary untouched staging currently produces correct
hashes; this is a gap in the promised fail-closed upload validation.

**Reproduced without credentials or networking:** filename derived from
`b'original'` has digest `0682c5f2076f099c34cfdd15`; replacing its bytes with
`b'changed after staging'` yields digest `61bfcd106f079afb53e23c7c`.
`require_immutable_release()` still accepts it.

**Repair:** recompute each support resource's SHA-256 prefix and compare it with
the suffix before any API access. Include unchanged, changed, forged and nested
paths; preserve the intentional HTML/players.json exceptions and remote
immutable-collision checks. Do not silently rename a corrupted staged release.

### R6 — P2: Arcade and map-viewer dialogs have no accessible names

**Location:** `src/templates/shell.html:36–37`.

The radio dialog uses `aria-labelledby`, but the Arcade and map viewer use
neither `aria-label` nor `aria-labelledby`. Visible header spans do not supply
a dialog's accessible name automatically. Assistive navigation cannot identify
the dialog from its container name, particularly when changing map images.

**Reproduced:** Chromium's accessibility tree returns `{role: 'dialog', name: ''}`
for each opened dialog. This is a browser accessibility-tree observation, not
a claimed full screen-reader acceptance run.

**Repair:** give the Arcade title a stable ID and label its dialog; label the
map viewer with the existing `map-viewer-title`. Assert a nonempty and correct
accessible name after open/image change; preserve Escape and trigger focus
restoration.

## Smaller observations (P3; separate from the six functional findings)

- **Stale current-status documentation:** `docs/status.md:22` still reports 20
  tests; the current run has 58. Its final performance section says head CI is
  pending and earlier sections still describe Draft-only delivery even though
  all eight PRs are merged. Preserve historical notes but add a clear current
  summary. `scripts/build.py:168–169` still incorrectly describes the atlas's
  two unused cells as being at the end; cells 29 and 35 are the spacers.
- **CSS maintenance:** `src/static/styles.css` retains old `.hex`/`.hex-row`,
  `.skin-carousel`, heading/widget rules and repeated navigation/radio/media
  overrides after later redesigns. These increase cascade/review complexity.
  They are not evidence of a performance bottleneck; do not broadly delete or
  reorder them without structural checks and screenshot parity. Across 136
  dossier/width checks, no page overflow was observed. One Leon skin label at
  768px has a 3px scroll-width excess; inspection shows a readable label, so
  it is not promoted to a functional defect.
- **Raster regression sensitivity:** `tests/check_roster_render.py:41–45`
  accepts 28/34 painted portraits. It can miss a future regression affecting
  only the five portraits in the last row, despite their importance in the
  earlier atlas correction. Current output is 34/34. Prefer calibrated per-tile
  comparisons/thresholds or at least explicit last-row checks, rather than a
  blanket threshold that falsely fails intentionally dark artwork.

## Review coverage and actual verification

Read/reviewed the maintained HTML templates and generated route structure,
entire CSS cascade, all eight frontend JS files (including map data), both
Workers, all nine Python scripts, all test/harness files, all three Actions
workflows and Dependabot configuration. Checked public service configuration,
roster/OST/presentation aliases, JSON schema/runtime consistency and SVG asset
behavior. The bulk archival images are validated as image/data assets, not
claimed to have received an individual editorial or artistic review.

Completed locally on this source revision:

- Python: **58/58** tests; deterministic root/Pages/immutable build coverage.
- Node: all four existing VM/data suites and **2/2** performance-metric tests.
- Fresh root, `/neonauts/` and immutable builds, each passing the site checker.
- Existing native Chromium smoke on all three build variants, including 34
  dossier selections, ordinary history, Arcade, Maps, skins and reduced motion.
- Raster roster check: **34/34** painted portraits.
- Additional geometry checks: **34 dossiers × 4 widths = 136 cases**, at
  320, 390, 768 and 1365px; no document-width overflow.
- Deterministic delayed-request reproductions, nine embed-URL requests,
  accessibility-tree checks and three offline Python probes above.

Runtime: Node **24.19.0**, Playwright **1.56.0**, native Chromium
**141.0.7390.37**; Python runtime recorded in `python-results.json`.

Existing protections worth preserving: escaped imported text; restricted Wiki
URLs; bounded guestbook body parsing and pending moderation; exception-safe
local storage; root/Pages path support; staged dependency-before-HTML upload;
remote immutable-collision refusal and no remote deletion; reduced-motion
handling; retained canonical artwork and single portrait atlas.

These checks do not establish physical-device touch/audio behavior, full
screen-reader/Firefox/Safari acceptance, public Worker abuse resistance,
production CDN propagation or a Neocities rollback drill. Existing CORS/KV
limitations and non-atomic multi-HTML cutover are documented architecture
limits, not rediscovered vulnerabilities or newly introduced regressions.
No new performance improvement claim is made and no deployment was performed.

## Reproduce the extra probes

From repository root, install the README dependencies and pinned Playwright
browser, then:

```sh
python scripts/build.py --out dist-browser-root
python scripts/build.py --out dist-browser-pages --base-path /neonauts/
python scripts/build.py --out dist-browser-immutable
python scripts/prepare_neocities_release.py --directory dist-browser-immutable
mkdir -p tests/artifacts
node docs/code-review-2026-10-11/browser-probes.mjs
python docs/code-review-2026-10-11/python-probes.py
```

The probe scripts **collect current behavior**, including defects; they are
review tools, not CI regression tests asserting desired behavior. Browser
probes serve generated output on ephemeral loopback ports. Python probes use
temporary files, in-memory responses and a temporary importer ROOT; maintained
datasets and source files are not replaced. They make no production requests
or authenticated API calls. Compact captured results are committed beside this
report; fresh runs write under ignored `tests/artifacts/`.
