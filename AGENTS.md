# Working on Neonauts

- Read README.md and docs/status.md first. This is a static Neocities fan site.
- Edit maintained files in data/, src/, scripts/ and workers/. Never edit dist/
  as a source; rebuild it. Never reintroduce all Naut data or base64 artwork
  into one HTML file.
- Preserve the approved Awesomenauts game UI, honeycomb geometry, borders,
  simple animations, open space navigation, 32px cursor and detached radio.
  Wiki pages are information sources, not the visual template.
- Import saved HTML with scripts/import_naut.py. Read compact JSON and
  diagnostics afterward. Do not repeatedly paste/read complete snapshots.
- Keep source attribution and hashes. Do not invent item costs, current game
  status, player counts or missing pictures. Preserve partial diagnostics.
- Keep Naut content separate from shared behaviours. All ability, item, and
  skin data comes from data/nauts/<slug>.json. Optional editorial JSON can
  customize narrative copy only; preserve approved Swiggins prose.
- After meaningful edits run the README checks, report actual verification
  and its limits, and update docs/status.md when scope/status changes.
- No Neocities API keys or other credentials in tracked files. Public Worker
  endpoints belong in site.config.json. Workers run separately from Neocities.
- Prefer small cohesive commits. Do not deploy merely because CI passed;
  follow the user's current authorization and the documented deployment setup.

- Treat imported Naut image assets as archival sources: never delete or
  recompress them solely to reduce public-build size. The build-only Naut
  image publisher keeps referenced images and coalesces identical bytes;
  maintain its fail-closed checks and all output-url tests.

- Neocities publishing is staged but not atomic: dependencies precede HTML,
  with API manifest verification and idempotent retries. Never describe this
  as a full transactional rollback; don't enable production auto deploy based
  only on unit tests. Keep the first live deployment manually gated.

- Saved Wiki links are untrusted. `url_policy.py` validates source, ability
  and item URLs at import and before build. Do not broaden allowed URL schemes
  or hosts without a reviewed threat model and regression tests.

- The guestbook Worker must enforce byte-bounded streaming before JSON parse.
  Origin/CORS is a browser constraint, not authentication. KV cooldown is
  eventually consistent; maintain moderation and assess edge abuse controls
  before public Worker deployment.

- Real-browser E2E: `tests/browser-smoke.mjs`, Chromium/Playwright 1.56.0.
  Build root and GitHub Pages subpath before running. Do not treat viewport
  emulation as physical touch/audio verification; keep screenshots on failures.

- Before any Neocities deployment, build and validate normally, then run
  `prepare_neocities_release.py` and upload only with
  `--require-immutable`. Never update old hash-addressed files in place or
  delete them without a reviewed cached-HTML retention policy. Main HTML
  routes stay mutable; Neocities does not offer atomic multi-HTML cutover.

- Roster character portraits use the owner-provided 768×768 WebP
  `nauts_profile_spritesheet.webp`: exactly 34 128×128 tiles,
  6 columns and row-major `data/roster.json` order. Preserve outer
  SVG hexagonal masks, inner sprite viewport clipping, keyboard
  selection and source IconCharacter images. Build must publish only
  one roster atlas; test live browser requests and native screenshots.
