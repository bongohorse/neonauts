# Neonauts

Unofficial Awesomenauts fan archive for Neocities. The interface is English;
the visual language follows the game UI, with an open space background.

**Website preview:** https://bongohorse.github.io/neonauts/

The preview is published by GitHub Pages after the one-time activation in
Settings → Pages → Source → GitHub Actions. See [preview setup](docs/github-pages.md).
Every subsequent push to `main` rebuilds and updates the preview automatically.
Neocities remains available as the separate publication target.

The repository is the maintained source. A small Python build generates static
HTML, CSS, JavaScript and external images in `dist/`. No server or Python is
needed on Neocities. Each Naut has its own JSON file and URL; the browser does
not download every Naut dossier when opening one character.

## Start locally (Windows / PowerShell)

```powershell
git clone https://github.com/bongohorse/neonauts.git
cd neonauts
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts/build.py
.\.venv\Scripts\python.exe -m http.server 8000 --directory dist
```

Open http://localhost:8000. Keep the server running while testing. On Linux or
macOS use `python3` and `.venv/bin/python` instead. Node.js is only needed for
JavaScript syntax checks and Worker tests, not to build or serve the site.

## Layout

| Path | Purpose |
|---|---|
| `data/nauts/*.json` | Extracted data, canonical sources, hashes and diagnostics |
| `data/roster.json` | Supplied portrait order and honeycomb coordinates |
| `data/presentation.json` | Explicit image choices when a source lacks splash art |
| `src/templates/` | Shared HTML shell and Naut dossier template |
| `data/editorial/<slug>.json` | Optional curated narrative copy, rendered through the shared template; never replaces canonical abilities, items or skins |
| `src/static/` | Shared CSS, JS, fonts, cursor and image files |
| `src/static/assets/nauts/<slug>/` | External images for each imported Naut |
| `scripts/` | Offline extraction, import, build, validation and upload |
| `workers/` | Separate player-count and moderated guestbook services |
| `tests/` | Extractor, build and Worker checks |
| `site.config.json` | Public website and service addresses; no secrets |
| `dist/` | Generated upload output, ignored by Git |

## Current content

All **34 roster Nauts** now have independent datasets and dossier URLs.
31 new saved Wiki snapshots were imported from the `nauts` release; Ayla,
Chucho and the approved Swiggins content were retained. Each dossier includes
4 abilities and 24 upgrade links/icons. See [import report](docs/naut-import.md)
for skins, image counts and preserved missing-image diagnostics.
The home page opens the approved Swiggins dossier.

Existing features retained: six map dossiers, holiday screenshots, rookie
guide, searchable glossary, badges/blinkies/stamps, guestbook terminal, 404
page, Bandcamp soundtrack radio with optional local audio, hidden arcade, 32px normal/hover cursor, external game
links, reduced-motion handling and View Transition enhancement for section
navigation. Naut URLs remain independently readable. The enhanced roster fetches the selected
dossier and its own runtime JSON in place, preserving minimized radio playback.
Direct URLs and fallback navigation still open complete static pages.

## Import another Naut

```powershell
.\.venv\Scripts\python.exe scripts/import_naut.py "C:\path\Naut.html"
.\.venv\Scripts\python.exe scripts/build.py
```

Import reads the saved HTML once, writes a per-Naut JSON and extracts embedded
images. Read the printed diagnostics and review the Git diff before committing.
It never downloads remote images. Raw snapshots can stay outside the repo or
under the ignored `sources/raw/` directory. Their source names and SHA-256
hashes remain in the JSON. Each new Wiki template still needs an import review.

Item costs/effects are unknown when only item links were saved. Parenthesized
values are retained without guessing their scaling. Quotes/song lyrics are
excluded. Chucho's missing skin splash images use explicitly selected embedded
in-game art; the missing-image diagnostics are preserved.

## Checks

```powershell
$env:PYTHONPATH = "scripts"
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe scripts/build.py
.\.venv\Scripts\python.exe scripts/check.py
node tests/page-data.mjs
node tests/radio.mjs
node tests/workers.mjs
node tests/players-client.mjs
```

GitHub Actions runs these on pushes to `main` and pull requests. Checks cover
deterministic builds, protected output directories, escaped imported text,
asset associations, extraction edge cases, local links, CSS paths, unique IDs,
ARIA targets, JavaScript syntax, image decoding and guestbook moderation.
Local verification uses Python 3.12 and Node 24; CI targets Python 3.13.
Native browser visual/touch verification and live Neocities hosting remain
separate checks, not implied by these automated results.

## Publish

See [Neocities setup](docs/neocities.md). GitHub Actions supports a safe,
read-only **dry-run first** and a separately confirmed first live upload.
After live acceptance, enable the `NEOCITIES_AUTO_DEPLOY=true` repository
variable to publish each push to `main` automatically. Until this opt-in is
set, pushes do not deploy to Neocities. Uploads are incremental, respect a
10-minute site-update interval and never delete remote files. Store the API
key only in the `NEOCITIES_API_KEY` GitHub Actions secret.

GitHub Pages refreshes `players.json` from Steam during deployment and on a
15-minute Actions schedule. Scheduled runs may be delayed; the visible timestamp
is the actual fetch time. Counts older than one hour display as unavailable.
Run `python scripts/fetch_players.py` after a local build to refresh its snapshot.
For continually refreshed counts on Neocities, configure the optional player
Worker URL (or arrange periodic uploads); a one-time upload is only a snapshot.
The public guestbook still requires its own Worker/KV and keeps drafts local
until configured. Radio loads SonicPicnic’s official Bandcamp Ultimate Edition
player when opened. Minimize keeps playback running while sections and Nauts
change; Restore opens the same player. Close/Stop ends playback. Each imported
Naut has a theme button using verified Bandcamp track IDs. Theme buttons sit beside the Naut identity with a Play icon. The compact
nonmodal radio retains Bandcamp’s native Play/Pause controls; Previous/Next
select verified Naut themes (start the selected theme in the native player).
A scrolling title pauses on hover/focus and respects reduced motion. Local
audio has custom mini Play/Pause/Previous/Next controls. Album playback remains
inside Bandcamp, whose own display shows the playing album track; the outer
ticker identifies the selected theme or album, not an inferred live track.

Steam history carries forward the prior published snapshot, retains up to 120
valid observations from the last 24 hours, and shows recorded peak/low/sample
average/change with a graph and accessible table. The graph begins collecting
with this feature; gaps over 45 minutes are not connected. The compact homepage
widget links to the full Community statistics. Counts are Steam-wide concurrent
players, not players on any particular game server.

## Sources and rights

See [sources and attribution](docs/sources.md). Wiki text is attributed under
CC BY-SA 3.0 unless a source says otherwise. Game artwork, logos, fonts and
music are not relicensed by this repository. This is an unofficial fan site.

See [status and next steps](docs/status.md) for the remaining work. Historical
notes in `docs/previous-site-notes.md` describe earlier standalone versions;
this README and current code take precedence.

All Nauts, including Swiggins, use the same dossier renderer and canonical
`data/nauts/<slug>.json` source for four abilities, 24 items and the skin gallery.
The optional `data/editorial/admiral-swiggins.json` holds approved narrative
wording and curated skin descriptions only; it does not override item/ability
metadata, skin selection/order, or artwork.
There is no character-specific template or build branch. Steam charts remain
in Community.

## Build output optimisation

The canonical source archive in `src/static/assets/nauts/<slug>/` remains
complete. `scripts/build.py` publishes **only** the Naut images referenced by
the 34 generated dossiers and the roster. Identical imported images, often
shared upgrade icons, are emitted once under deterministic
`dist/assets/nauts/shared/<sha256>.webp` paths. Generated Naut HTML and both
runtime data representations reference the same published files. Importer
snapshots, source hashes and missing-image diagnostics are unchanged.

The two per-Naut runtime files are deliberately both retained:
`page-data.js` provides the initial static dossier without a fetch, whereas
`page-data.json` is used by in-page Naut navigation. Replacing either would
require a separate browser/data-loading redesign, not a redundant-image fix.

The source assets for Commander Rocket and Gnaw are larger than most Nauts;
re-encoding them without checking readability/transparency would risk
quality loss, so this change keeps their original WebP bytes. The generator
reports the number of referenced images and avoided duplicate copies.

Neocities releases also merge valid player-history samples from the previous
Neocities publication and the independently scheduled GitHub Pages snapshot,
so rebuilding the website need not reset the recorded 24-hour history. This
does not automatically schedule more frequent Neocities releases.

## Real-browser smoke checks

In addition to the Python build/data tests and Node VM tests, CI now has a
separate **native Chromium Playwright** job. It builds both `/` and the
GitHub Pages `/neonauts/` subpath and exercises direct Naut URLs, selected
roster navigation, Back/Forward, skin selection, map search/viewer, reduced
motion, mobile-width overflow and local network errors. Failure screenshots
are uploaded as GitHub Actions artifacts; successful jobs do not upload images.

For local Windows/PowerShell testing, install Python requirements and Node 24,
then run:

```powershell
npm install --no-save --no-package-lock playwright@1.56.0
npx playwright install chromium
python scripts/build.py --out dist-browser-root
python scripts/build.py --out dist-browser-pages --base-path /neonauts/
node tests/browser-smoke.mjs
```

This uses the same published project sources via a local HTTP server and does
**not** call live Neocities, Cloudflare, Steam or Bandcamp APIs. A desktop/mobile
browser viewport is **not** equivalent to physical-device touch/audio testing.

Neocities publication uses an immutable release staging step after the
standard build/tests: hashed support asset and Naut-data URLs, old versions
retained, HTML entrypoints uploaded last. See `docs/neocities.md` for the
dry-run, staging, recovery and acceptance gates. GitHub Pages uses the ordinary
static build without this Neocities-specific transformation.

The Naut selector uses the owner-supplied 768×768 WebP atlas
`src/static/assets/nauts/nauts_profile_spritesheet.webp`. Its 34
128×128 tiles follow `data/roster.json` in row-major order
(index 0→33, six columns). Keep the source `IconCharacter*.webp` files
as archives; public builds publish one roster atlas while retaining
individual item, ability, character artwork and skin images.
