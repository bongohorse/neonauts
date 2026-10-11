# Status — archive improvements, 10 October 2026

## Completed

- Existing website/assets migrated into maintained templates and static files.
- Offline extractor, importer and tests included in the repository.
- Separate datasets and generated URLs for Swiggins, Ayla and Chucho.
- Shared roster navigation, available-dossier random selection and per-page
  abilities/items/skins. Only the selected Naut's page data is loaded.
- Swiggins approved editorial dossier retained. Ayla and Chucho receive
  source-driven field guides using the same components.
- Six maps, holiday archive and existing community features retained.
- Public service configuration separated from behaviour scripts.
- GitHub CI and a manually triggered Neocities upload workflow prepared.
- GitHub Pages preview workflow added, including project-prefix-safe 404 pages.
  Preview URL: https://bongohorse.github.io/neonauts/
  Initial activation uses Settings → Pages → Source → GitHub Actions.
- Sources, Windows setup, import flow and remaining tasks documented.

## Verification

20 extractor/build/player-fetch tests pass locally. Site checks pass for local HTML links,
CSS paths, IDs, ARIA references, JavaScript syntax, decoded raster images and
Naut asset references. Guestbook origin/length/honeypot checks, cooldown,
pending moderation and published feed pass in an in-memory Worker test.

GitHub Pages is active. Desktop browser checks verify the Roster, skin arrows,
map search/filter, layout viewer, zoom reset, keyboard tabs, browser Back,
Steam snapshot display and Bandcamp playback progress / Escape cleanup.
No site-origin console errors were observed during those checks.
A real mobile/touch device, changed OS reduced-motion preference and actual
Neocities hosting remain unverified. CSS honours reduced-motion and the
JavaScript checks it before starting section/skin animations.

## Next work

1. Real-device review of the small-screen layouts, touch controls and audible
   music output; verify the reduced-motion path with the device preference.
2. Supply missing embedded skin/in-game images listed in docs/naut-import.md.
3. Improve Ayla/Chucho editorial summaries and long skin descriptions.
4. Supply Chucho's six missing saved images if higher-quality art is needed;
   both skin cards currently use available in-game art.
5. Provide item-page snapshots for upgrade costs and effects.
6. Configure siteUrl and NEOCITIES_API_KEY, then publish and verify live URLs.
7. Deploy/configure guestbook Worker/KV moderation. For live Neocities counts,
   optionally configure the player Worker or periodic snapshot uploads.
8. Real-device mobile and audible soundtrack acceptance.

The repo does not assume that every Wiki snapshot uses an identical template.
The supplied portrait roster has 34 entries; all 34 dossiers are imported.

## Archive improvements

- Corrected the Naut dossier spacing regression when browsers mix cached pre-wrapper HTML with newer CSS: legacy headings use a fixed-content grid row, while current markup keeps the left side in one wrapper. In-page Naut navigation revalidates HTML and runtime JSON. Mobile retains heading, skin gallery, then details order.

- Removed retained template children that duplicated roster/count text and
  appended Swiggins to other Naut selections. Fixed the Swiggins browser title.
- Small-screen skin cards wrap with readable labels; improved narrow layouts,
  minimum touch targets, focusable roster scrolling and footer links.
- Maps: name/feature search, standard/legacy filters, adjacent-map links,
  keyboard card navigation, bounded zoom and Fit reset. Map-title updates now
  follow section transitions instead of racing with them.
- Radio: official SonicPicnic Bandcamp Ultimate Edition embed, loaded on open;
  native dialog focus containment, Escape/close cleanup and optional local audio.
  The detached launcher remains part of the header and scrolls out of view.
- Steam snapshot fetcher and Pages schedule (15 minutes), with timestamp and
  unavailable states for failures, invalid values and counts older than one hour.
  No extra hosting service or API key is needed for the GitHub Pages preview.
- Player-fetch unit tests and client tests cover zero, invalid/stale/future
  counts and service outages. Existing link/asset/Worker checks remain required.
- Simple animation and reduced-motion paths are preserved.

Local automated checks pass. A real phone/touch and audible output check remain
separate from automated checks and desktop browser review.

## Published verification

Implementation commit `d4fbda2`: Site checks run 38070851400 and Pages run
38070851416 succeeded. Live Community displayed a real Steam count with its
fetch timestamp. The Bandcamp theme playback timer advanced and Escape removed
the iframe source and restored focus to the launcher. Roster text and browser
title were corrected live; maps search, legacy filter, zoom/Fit, Escape,
keyboard tabs and history navigation were exercised. Desktop viewport: 1363px;
no horizontal page overflow on the checked Maps view.

Small-screen CSS changes were reviewed in source, not accepted as a real-phone
test. This browser has no supported viewport-resize API; an attempted inline
preview was rejected by its URL policy, so it was not used.

## Radio, themes, background and activity history

- Native radio dialog can be minimized without unloading the Bandcamp iframe.
  A compact Restore/Stop bar remains available while browsing.
- Enhanced roster navigation preserves the radio iframe and its playback
  across Naut dossiers. The build emits an independent page-data.json per Naut;
  failed navigation falls back to the complete static URL. Back restores the
  requested dossier. Swiggins approved runtime data moved to maintained JSON.
- Theme buttons added to all imported dossiers. Verified Bandcamp track IDs
  cover all 34 roster entries, including explicit name aliases.
- Background layer uses stable 100lvh sizing instead of a height derived from
  changing browser chrome. Portrait/landscape changes can still resize it.
- Compact Steam current/recorded-peak widget added to the Naut home section.
- Community now shows a sampled 24h graph, peak, low, sample average and last
  change, with an accessible count table. History is carried over from the
  previous published JSON, validated and bounded; no artificial samples.
- Local tests cover history bounds/deduplication/outages, zero-value graphs,
  gap rendering, statistics, per-Naut JSON parity and theme associations.

Real-device browser-bar movement still requires user-device acceptance.

Published desktop verification (1363px): Bandcamp playback continued across
minimize and Swiggins-to-Ayla navigation; restoring showed 35 seconds elapsed
and an active audio element. Ayla's individual theme rendered and its play
control switched to pause. Stop hid the mini bar and removed the iframe source.
The compact Steam widget and Community graph displayed the first real sample.
Single-theme embeds use a compact 120px frame and a track-specific title/link;
Full Soundtrack restores the full album player.
Content hashes on generated CSS/JavaScript links prevent a cached old script
from being combined with newly deployed markup.

## Compact theme radio — 11 October 2026

- Theme action moved from skin artwork to the Naut heading, with a left Play icon.
- Radio behaviour extracted into radio.js; radio-data.js contains verified
  theme metadata only, not all dossiers.
- Minimize uses a nonmodal dialog with the existing iframe still visible.
  Bandcamp's native Play/Pause remains usable without restoring the full panel.
- Mini Previous/Next selects from 34 verified Naut themes with wrapping; a new
  Bandcamp selection must be started in its own player. No guessed remote API.
- Local audio has mini Play/Pause and Previous/Next, preserving paused state.
- Compact ticker identifies selected theme/local file (or album); actual album
  track remains in Bandcamp's native display. Motion stops on hover/focus and
  reduced-motion devices get a static title. Restore/Stop remain available.
- Radio lifecycle and source switching are covered by a dedicated VM test.
- Live browser acceptance follows publication; phone playback is not implied.

## Navigation spacing and roster telemetry — 11 October 2026

- Main navigation uses a single nowrap row with horizontal touch scrolling
  when it cannot fit. Gaps clamp to 6–22px; button padding/type scale within
  limits and retain 44px minimum touch height. All links remain accessible.
- Compact Steam indicator now belongs to the roster heading, using the same
  angled cyan border, inset shading, italic type and gold values as game UI.
- Narrow headers stack metadata cleanly; the indicator no longer occupies a
  separate row between the heading and the portraits. Counts remain unchanged.
- User-supplied portrait/landscape screenshots informed the change. A supported
  mobile viewport emulation is unavailable in this browser; actual phone review
  remains separate from automated checks and desktop acceptance.

## Complete roster import — 11 October 2026

- Imported 31 new dossiers from the published nauts release; retained Ayla, Chucho
  and approved Swiggins. All 34 roster entries now link to their own dossier.
- Fixed character-specific upgrade icon extraction and UTF-8 parsing for Skølldir.
- Explicit source-name aliases preserve roster selection and all OST themes.
- Full-roster runtime tests cover URLs, JSON parity, 4 abilities, 24 items and assets;
  missing artwork remains documented. See docs/naut-import.md.

## Shared dossier cleanup — 11 October 2026

- Removed roster heading/count and homepage Steam widget; Community statistics remain.
- Removed dossier eyebrows and the redundant character-stage name.
- Role is now the first trait tag; all names share the same single-colour treatment.
- Theme action reads PLAY THEME. Generic field-guide subtitles removed; optional
  edited taglines such as Swiggins remain.
- Replaced the Swiggins-specific template/build path with one data-free Naut template.
  Optional per-Naut editorial JSON preserves curated narrative copy only.

## Swiggins data normalization — 11 October 2026

- Removed the Swiggins-only ability/item/skin runtime replacement. All 34 Nauts
  now derive ability icons and values, their 24 upgrades, skill groups and skin
  galleries from `data/nauts/<slug>.json` and the shared `page_data()` builder.
- Kept Swiggins' approved tagline, briefing, tactics, backstory and readable
  skin descriptions as optional narrative-only editorial copy. Skin artwork and
  selection use canonical source data. The story tab retains the common BACKSTORY
  heading; the Titan tagline remains a subheading.
- Removed 31 unused `editorial-*.webp` duplicates; source artwork remains in the
  Swiggins asset directory. No source snapshot hashes or diagnostics changed.
- The build test now compares generated runtime sections for every Naut against
  canonical `page_data()`, preventing future character-specific runtime drift.

## Neocities deployment readiness — 11 October 2026

- Verified the static asset extensions (WebP/PNG/SVG/WOFF2/JS/CSS/JSON) are
  Neocities-allowed. Checked 1,481 maintained static files totaling ~21.4 MB;
  generated HTML/data add modest overhead. The free hosting tier allows 1 GB.
- Identified the single multipart upload containing ~1,500+ files as unsafe
  for automated operation. Replaced with checked-site, hash-diff incremental
  uploads and serial batches of <=100 files/90 MiB each, 10-minute update guard,
  read-only manual dry-run, and no automatic remote pruning.
- Push-triggered Neocities deployment is deliberately gated by repository
  variable `NEOCITIES_AUTO_DEPLOY=true`. Keep it unset until the first manual
  dry-run, intentional live upload and browser acceptance have passed.
- The GitHub connector cannot inspect the secret's value, and no authenticated
  live Neocities API access, dry-run or production upload was performed here.
  Live account storage, file-count quota and target-key validation remain the
  first controlled runtime gates. GitHub Pages continues independently.

## Public image-build optimisation — 11 October 2026

- All original embedded Naut artwork remains in `src/static/assets/nauts/`.
- Verified CI build: 1,420 source Naut WebPs (20,504,026 bytes) become 903
  published images (16,737,820 bytes); 332 unreferenced originals and 185
  duplicate referenced copies are excluded. The public build saves 517 files
  and 3,766,206 bytes (~18.4% of Naut image bytes). The initial Neocities
  upload estimate decreases from 1,589 to 1,072 files, assuming no other
  build changes. Existing remote files will not be auto-pruned.
  The public build publishes only images referenced by canonical runtime
  abilities/items/skins plus roster portraits; unused saved-source artwork
  is not uploaded. Shared identical images receive content-addressed URLs,
  never re-encoded or altered.
- Source and published files are byte-compared in tests; broken image refs,
  inconsistent generated HTML/runtime JSON, prefix URLs and missing assets
  remain test failures. GitHub Pages and Neocities use the same optimised
  build; deployment to Neocities is **not** triggered by this PR unless
  separately enabled using the existing gated workflow.
- Commander Rocket and Gnaw hold considerably more WebP bytes in source than
  average. No lossy recompression was performed without visual acceptance.
- `page-data.js` (initial no-fetch rendering) and `page-data.json` (in-page
  navigation) remain intentionally separate. Removing either requires a
  separate navigation architecture change and native browser verification.

## Deployment P1 remediation — issue #11

- Implemented phase-isolated Neocities uploads: non-HTML dependencies before
  HTML entrypoints, with remote API SHA-1/size verification before HTML and
  after publication; retry compares the new remote state and sends only
  remaining files. Tests inject a mid-batch failure and missing server files.
- Neocities API has no atomic multi-file cutover. This reduces the chance of
  publicly missing new resources but does not eliminate shared-script/data
  version races or mixed HTML after a partial final batch. These limitations
  remain an explicit follow-up gate before declaring deployments transaction-safe.
- Nothing was published to production by the repository edit or PR.

## Neocities player-history preservation — issue #12

- The Neocities deployment now merges validated history snapshots from the
  existing Neocities `players.json` and the GitHub Pages preview history.
  If either endpoint is unavailable, the other can preserve bounded
  (24-hour, ≤120-point), timestamp-validated observations.
- The Steam API snapshot still fails closed to `players:null` on outage, and
  history points are never invented or converted to a false current count.
- GitHub Pages' separate 15-minute scheduled workflow still does **not**
  update Neocities. On Neocities, observations refresh only when its own
  deployment workflow is intentionally triggered or explicitly scheduled.
- No new live Neocities upload is performed by this fix.

## Imported external URL validation — issue #13

- Recorded Wiki links are validated at the `import_naut.py` boundary and
  again when `page_data()` is generated. Only absolute HTTPS
  `awesomenauts.fandom.com/wiki/...` links without credentials, unsafe
  schemes or control characters pass; imported source history is not modified.
- Existing 34 Naut datasets use acceptable Wiki links. Tests cover malicious
  schemes, lookalike hosts, URL credentials, relative/protocol-relative links,
  malformed ports, and refusal before writing a forged import.

## Guestbook body safety — issue #14

- Incoming JSON bodies are read with a strict 4096-byte upper limit rather
  than unbounded `request.text()`; missing/forged Content-Length and malformed
  UTF-8/JSON are tested, as are valid moderated entries and KV failures.
- Remaining operational risks: Origin can be spoofed outside browsers, and
  KV rate limits are eventually consistent. The Worker is not deployed by
  this PR and requires separate abuse-controls/operational acceptance.
