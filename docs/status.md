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

19 extractor/build/player-fetch tests pass locally. Site checks pass for local HTML links,
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
2. Import remaining supplied Nauts, inspect each summary and missing assets.
3. Improve Ayla/Chucho editorial summaries and long skin descriptions.
4. Supply Chucho's six missing saved images if higher-quality art is needed;
   both skin cards currently use available in-game art.
5. Provide item-page snapshots for upgrade costs and effects.
6. Configure siteUrl and NEOCITIES_API_KEY, then publish and verify live URLs.
7. Deploy/configure guestbook Worker/KV moderation. For live Neocities counts,
   optionally configure the player Worker or periodic snapshot uploads.
8. Real-device mobile and audible soundtrack acceptance.

The repo does not assume that every Wiki snapshot uses an identical template.
The supplied portrait roster has 34 entries; imported content is currently 3.

## Archive improvements

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
