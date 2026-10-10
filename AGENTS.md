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
- Keep Naut content separate from shared behaviours. The Swiggins dossier
  has approved editorial content; avoid overwriting it with raw Wiki text.
- After meaningful edits run the README checks, report actual verification
  and its limits, and update docs/status.md when scope/status changes.
- No Neocities API keys or other credentials in tracked files. Public Worker
  endpoints belong in site.config.json. Workers run separately from Neocities.
- Prefer small cohesive commits. Do not deploy merely because CI passed;
  follow the user's current authorization and the documented deployment setup.
