# Nauts Archive — Swiggins test edition

A buildless, unofficial Awesomenauts information site for Neocities.
English interface; no accounts, backend, package manager or build required.

## Open locally

Open `index.html` in a browser. All supplied art and fonts are local. JavaScript
handles navigation, dossier tabs, skin selection, local audio and the arcade.

## Upload to Neocities

Upload `index.html`, `styles.css`, `script.js` and the complete `assets` directory
to the root of your Neocities site. Preserve filenames and relative paths.
`README.md` and `data.json` are documentation/source metadata and need not be
uploaded. No deployment or changes to your existing site have been performed.

## Included

- Character roster using all 34 supplied original icons in the reference game order, in a regular honeycomb lattice, with a shared tilt per wing and a beveled random button. Selected and hovered tiles enlarge above the unchanged lattice. The original hover transition and inner frame are retained; the top shine is removed. The random button contour follows the six neighboring frame edges with a nominal 6-unit clearance and glows gold on hover or keyboard focus. Only Admiral
  Swiggins has imported content; the other portraits are explicitly marked
  as unavailable. The random selector chooses among imported dossiers.
- Swiggins overview, sourced stat values, four abilities, condensed tactics,
  backstory, 24 labeled upgrade cards and three selectable skin images with expanded descriptions.
  Ability cards include practical notes and readable stat rows. The mobile
  dossier shows the character heading before the artwork, with sticky detail tabs.
- Maps landing section with a Wiki link, clearly awaiting content import.
- Steam, Twitch, Reddit, SteamDB and fanart links; disabled Discord placeholder.
- Space Radio: a real browser-local audio player with playlist, previous/next,
  volume and repeat. Load audio files from your device. Files stay local.
  No soundtrack audio was contained in the supplied snapshot; hosted OST
  tracks or an authorized embed are not connected yet.
- Hidden arcade: click the small Solar cube at the right edge. Move with
  Up/Down or W/S, or use the touch buttons. One point per passed hazard,
  three lives, progressively faster hazards and a browser-local high score.
  Closing, hiding the page or moving focus away pauses play. Resume is explicit.
- Responsive layout, keyboard tab navigation, focus styles, reduced-motion
  handling and a small 88×31-style badge.

## Pending

More Naut dossiers, map images/details, live data integration, custom cursor
file, hosted OST tracks, guestbook/contact and full browser verification.
No dummy live-player count is displayed.

## Sources and attribution

Character information and embedded Wiki assets: supplied SingleFile export of
https://awesomenauts.fandom.com/wiki/Admiral_Swiggins
saved 10 October 2026, 11:49 CEST.

Text descriptions are adapted, not represented as fresh current-game data.
Parenthesized damage values are preserved as listed; their scaling context and
the source's game version remain unconfirmed. Health is labeled at team levels
1 and 20 without upgrades, cross-referenced with:
https://awesomenauts.fandom.com/wiki/Health Upgrade costs/effects were not
present in this saved page, so icons link to their individual Wiki entries.

Adapted Wiki text is shared under CC BY-SA 3.0 unless otherwise noted:
https://creativecommons.org/licenses/by-sa/3.0/
That license does not imply a license for game artwork or music.
Game artwork, logo and supplied screenshot imagery belong to their respective
rights holders. This site is not affiliated with Ronimo Games, Atari or Valve.

## Verification

Passed JavaScript syntax check, DOM-harness interaction checks for navigation,
roster, keyboard tabs, skins, radio and arcade pause/resume/hidden/close behavior;
local file references, unique IDs, ARIA targets and image decoding also checked.
Real browser rendering, touch feel, media decoding and Neocities hosting have
not been verified in this environment.

## Visual update

Supplied replacement logo and quiet space background. Layout and controls follow
Awesomenauts menus; Wiki pages are information sources, not a visual template.
Skin arrows cycle through all three previews and wrap in either direction.
Artwork uses a brief slide/fade, with reduced-motion preferences respected.
Navigation remains in one HTML document without a page reload, enhanced with
native View Transitions where supported. CSS controls the transition animation;
a small JavaScript callback updates the active section. Unsupported browsers
switch immediately, and hash URLs/back/forward remain available.


## Current Steam player count
The display only shows the current count, without a chart.
Steam's endpoint does not send CORS headers, so Neocities needs a tiny public proxy.
1. Create a Cloudflare Worker and paste the contents of players-worker.js.
2. Deploy it and copy its public HTTPS URL.
3. Set PLAYER_COUNT_URL at the top of players.js to that URL.
4. Upload the site files to Neocities. The count refreshes every five minutes while the page is visible.
For the standalone HTML preview, set PLAYER_COUNT_URL in its embedded script too.
Until the endpoint is configured the display says "Live connection pending".
Steam may cache counts for up to 15 minutes. A failed request shows a dash, never a false zero.
The worker is hosted separately; uploading players-worker.js to Neocities does not execute it.


## Rookie guide, glossary and community features
- Navigation adds ROOKIE GUIDE and GLOSSARY. Community links to the guestbook and graphics collection.
- Nine original SVG downloads: three 88x31 badges, three animated 150x20 blinkies and three 99x56 stamps. SVG animations respect reduced motion. Replace YOUR-SITE in copied HTML.
- not_found.html is the Neocities custom error page. Keep 404.html as a portable copy. These pages use root-relative paths for nested missing URLs. An unknown in-page hash also shows the lost-pod view.

## Public guestbook setup
The guestbook does not invent posts or pretend that local drafts are public.
Until connected it saves a draft in the visitor’s own browser only.
1. Create a Cloudflare KV namespace. Deploy guestbook-worker.js as a separate Worker.
2. Bind the namespace as GUESTBOOK. Add SITE_ORIGIN with your exact website origin, for example https://example.neocities.org (no trailing slash).
3. Put the Worker HTTPS URL into GUESTBOOK_URL in features.js; upload the updated file to Neocities. For standalone preview, change its embedded script too, and allow its origin separately if needed.
4. New messages are stored with pending: keys and expire after 30 days. They are not public.
5. Review pending entries in the Cloudflare KV dashboard. To approve one, copy its JSON value to a new key with the same suffix but published: instead of pending:, then delete the pending key. Delete an unwanted pending entry to reject it. Published messages are returned newest first, at most 50. They remain until deleted.
The Worker accepts plain text only, checks lengths and origin, rejects a honeypot field, and has a best-effort per-IP cooldown. KV is eventually consistent; the cooldown is not a strong anti-spam guarantee. All entries require manual approval. Nothing is posted publicly by saving a local draft.


## Maps archive
Six maps imported from the supplied Wiki snapshots: Ribbit IV, Starstorm Station, AI Station 205, Sorona, Aiguillon and AI Station 404. Map availability is labelled as described in those snapshots, not as independently confirmed current matchmaking status.
Map cards open Overview / Layout / Tips. Layout images and minimaps can be enlarged in a modal with 100–300% zoom. Links such as #maps/sorona retain the selected map.
Holiday Themes contains six historical events and eighteen archived screenshots. It does not claim any event is active. All extracted images remain at their saved resolution; small screenshots and minimaps are not high-resolution originals.
Wiki descriptions and tactical notes are adapted and credited under CC BY-SA 3.0. Game images belong to the respective rights holders. Source Holiday Themes includes screenshots credited to Hmmt and IRCannonFodder.
