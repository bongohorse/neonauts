# Status — repository foundation, 10 October 2026

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
- Sources, Windows setup, import flow and remaining tasks documented.

## Verification

12 extractor/build tests pass locally. Site checks pass for local HTML links,
CSS paths, IDs, ARIA references, JavaScript syntax, decoded raster images and
Naut asset references. Guestbook origin/length/honeypot checks, cooldown,
pending moderation and published feed pass in an in-memory Worker test.

Native browser rendering, responsive interaction and actual Neocities hosting
have not been verified in this workspace. GitHub CI status must be assessed
on its actual run, not inferred from local checks.

## Next work

1. Browser review of all three Nauts: desktop/mobile, roster, tabs, skin
   arrows, hash navigation, Back/Forward, radio, glossary and map zoom.
2. Import remaining supplied Nauts, inspect each summary and missing assets.
3. Improve Ayla/Chucho editorial summaries and long skin descriptions.
4. Supply Chucho's six missing saved images if higher-quality art is needed;
   both skin cards currently use available in-game art.
5. Provide item-page snapshots for upgrade costs and effects.
6. Configure siteUrl and NEOCITIES_API_KEY, then publish and verify live URLs.
7. Deploy/configure player-count Worker and guestbook Worker/KV moderation.
8. Connect a permitted soundtrack source if hosted radio is desired.

The repo does not assume that every Wiki snapshot uses an identical template.
The supplied portrait roster has 34 entries; imported content is currently 3.
