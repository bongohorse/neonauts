# Neocities publication and services

Neocities serves only the generated static frontend from `dist/`. The
source repository remains the single source of truth. Python, GitHub Actions
and Cloudflare Workers do not run inside Neocities.

**Production:** https://awesomenauts.neocities.org/
**Preview:** https://bongohorse.github.io/neonauts/

## Safe first publication (required once)

1. In `site.config.json`, set `siteUrl` to
   `https://awesomenauts.neocities.org` (HTTPS origin, without a path).
2. In GitHub **Settings → Secrets and variables → Actions → Secrets**, add
   `NEOCITIES_API_KEY` from your Neocities settings. Never publish the
   token or put it in Git. This secret cannot be read back through the repo API.
3. After the deployment PR's checks are green and it is merged, open
   **Actions → Deploy to Neocities → Run workflow** on `main`. Keep
   **dry_run checked** (default). This authenticates, verifies the token belongs
   to the configured Neocities site, lists current remote files and compares
   SHA-1 without uploading or deleting anything.
4. Review the log: target must be `awesomenauts`, changed/new count
   should match the expected first publication, and any remote-only files
   will be **preserved**. Confirm adequate free disk space.
5. Run the same workflow a second time, explicitly **uncheck dry_run**.
   This publishes only changed/new files. It may wait up to ten minutes
   to respect Neocities' recommended update frequency.
6. Open the live homepage, representative Naut URLs, image paths,
   stylesheet, theme/skin controls and `not_found.html` to accept
   the real publication. Do not activate auto-deploy until this passes.

## Enable automatic publishing after acceptance

In GitHub **Settings → Secrets and variables → Actions → Variables**, create
the repository variable:

- **Name:** `NEOCITIES_AUTO_DEPLOY`
- **Value:** `true`

The deployment workflow then runs on every push to `main` (typically a
merged PR), or on manual dispatch. GitHub's concurrency group serializes
deployments. On a push, the workflow publishes after the test/build gates.
To stop automatic publishing without touching credentials, set that variable
to `false` or delete it. Manual runs still work.

**Do not enable automatic publishing before the first manual dry-run and
successful live acceptance.** Merging the workflow itself is safe while
the variable is absent/false: the push-triggered deployment job is skipped.

## API rules and safety

- Uses official bearer-key endpoints `GET /info`, `GET /list`
  and `POST /upload`. Account identity is validated before any write.
- Compares local SHA-1 to remote listing; identical files are not sent.
- Uploads in **phase-separated serial batches of at most 100 files and 90 MiB**,
  conservatively below Neocities' 100 MB/request limit and common Ruby
  multipart-file limits. New image assets and supporting JS/CSS/JSON go first;
  HTML entrypoints go last. Before the HTML stage, the uploader re-lists the
  remote supporting-file manifest and checks SHA-1 and size. After all batches,
  it verifies the full published manifest. A mismatch or failed package fails
  the job. Rerunning is idempotent via changed-only remote hash comparisons.
- **Dependency isolation (Issue #11):** After the standard build and data
  checks, `prepare_neocities_release.py` rewrites all shipped images,
  scripts, stylesheets, fonts, Naut page-data JSON/JS and roster URLs to
  per-file SHA-256-addressed paths. These filenames are immutable: an
  existing path with different remote bytes aborts even before dry-run
  publishing. Only `index.html`, 34 direct Naut pages, error HTML and the
  intentionally live `players.json` keep stable paths. Old hashed files
  stay present, so cached old HTML can fetch its previous dependencies.
  In-page Naut navigation uses the roster's hashed JSON URL; if an HTML
  response belongs to a different JS/CSS release, the browser does a full
  page navigation rather than mixing incompatible DOM and scripts.
- **This is still not an atomic site-wide HTML switch.** Neocities has no
  multi-file transaction. A failed late HTML batch can leave some public
  pages on an earlier release and others on a later one, but both reference
  retained immutable support resources. CDN edge propagation can also
  differ from Neocities' API inventory. Prior *legacy* HTML published
  before adopting immutable releases cannot be retroactively protected
  from all structural changes. Do not call this a full automatic rollback.
- Respects a minimum 10-minute window between site updates using the
  Neocities `last_updated` timestamp. Upload errors stop the workflow;
  a retry compares hashes and skips already successful chunks.
- Enforces allowed static extensions, checks per-file size and free-tier
  projected storage before uploading. There is no automatic deletion/prune.
  Files placed on Neocities by hand remain unless explicitly removed.
- `--dry-run` performs remote read-only checks and makes zero upload
  calls; the workflow also passes `--require-immutable`, refusing an ordinary
  build and aborting if a previously uploaded content-addressed path has
  mismatched bytes. Neocities file quota and the secret's validity can only be verified
  in a real authenticated dry run, not through CI pull-request tests.
- Only generated `dist/` contents are uploaded, never the folder itself,
  hidden build marker, source snapshots, tests or API keys.

Official documentation:
- https://neocities.org/api
- https://neocities.org/site_files/allowed_types
- https://neocities.org/supporter

## Local upload

Only if you want to deploy from your own computer rather than GitHub Actions,
set `NEOCITIES_API_KEY` privately and run:

```powershell
.\.venv\Scripts\python.exe scripts/build.py
.\.venv\Scripts\python.exe scripts/check.py
.\.venv\Scripts\python.exe scripts/prepare_neocities_release.py
.\.venv\Scripts\python.exe scripts/check.py
.\.venv\Scripts\python.exe scripts/deploy_neocities.py --dry-run --require-immutable
# After examining the result, intentionally publish:
.\.venv\Scripts\python.exe scripts/deploy_neocities.py --require-immutable
```

## Public endpoints

`site.config.json` contains public addresses, never credentials:

- `playerCountUrl`: HTTPS URL of the separately deployed
  `workers/players-worker.js`. It queries Steam app 204300 and exposes only
  the current number. The frontend refreshes while visible and never invents
  a count. Steam caching may delay apparent updates.
- `guestbookUrl`: HTTPS URL of the separately deployed
  `workers/guestbook-worker.js`. Bind a Cloudflare KV namespace as
  `GUESTBOOK` and set `SITE_ORIGIN` to your exact Neocities origin,
  without a trailing slash.

New guestbook entries use `pending:` keys and are not public. To approve an
entry, copy its JSON to the same key suffix with `published:` and remove its
pending key. Pending entries expire after 30 days. The Worker returns up to
50 published entries; KV eventual consistency means cooldown is best effort.

Rebuild and publish after changing endpoint addresses. Until configured, the
frontend retains its pending states and browser-local guestbook draft.

## Guestbook abuse and request-size limits

The guestbook Worker rejects requests over **4096 bytes**, including requests
without or with incorrect `Content-Length`, by reading its body incrementally.
Invalid UTF-8/JSON is rejected before adding any pending entry. The existing
`SITE_ORIGIN`/CORS restriction controls browser access, **not authentication**:
a non-browser HTTP client can forge an Origin header.

KV cooldown uses Cloudflare KV and is eventually consistent, so simultaneous
or distributed requests can bypass the advisory rate key. Keep the moderated
`pending:` queue, and before exposing the public Worker consider Cloudflare
edge rate-limiting rules / a verified Turnstile setup with a separate test gate.
No Worker is deployed by this repository change.

## Read-only orphan audit (no deletion)

After a migration or asset optimization, Neocities may still host files that
the latest build no longer references. To inspect them, run **Actions → Deploy
to Neocities → Run workflow**, select `main`, and check **List remote-only
files with sizes**. This mode performs a valid build and uses only API
`GET /info` + `GET /list`, then prints counts, names and byte sizes. It
**never uploads, deletes or prunes files**, even if the `dry_run` checkbox is
unchecked. Site identity must match `site.config.json`.

Local equivalent with the API key already privately set:

```powershell
.\.venv\Scripts\python.exe scripts/build.py
.\.venv\Scripts\python.exe scripts/deploy_neocities.py --audit-orphans
```

Remote-only does **not** mean safe to delete. The report may contain manually
managed content or files still referenced by browsers' cached HTML. Any
retention/deletion procedure requires a separate reviewed plan and explicit
authorization; no such deletion workflow is provided.

## Immutable release staging and emergency recovery

The GitHub Actions release order is now: build and offline tests → fresh Steam
history → ordinary static checks and JS tests → immutable transformation →
check immutable output → authenticated read-only diff → (if explicitly
authorized) support-file upload + remote hash verification → HTML cutover.

**If uploads stop during support resources:** old public HTML and all its
immutable files remain. Review the log, verify site identity, then repeat the
same release/dry-run; its hash-based diff skips already-present files.
**If uploads stop during HTML:** some URLs may serve old HTML and others new.
Both releases retain their immutable dependencies. Retry **the same commit**
rather than mixing a third deployment. Run the root/deep-link browser checks.

**Emergency rollback:** a *previously accepted release* can be restored by
rebuilding its exact source revision and generating the same immutable output,
then explicitly re-publishing its prior HTML entries as a separately reviewed,
manual release. GitHub's current workflow checks out `main` only: it does
**not** offer a one-click rollback selector or reconstruct unknown older HTML.
Before relying on rollback, archive the accepted source SHA and built HTML,
check the retained hashed dependencies via API, and perform a controlled
rollback drill. No old hashed files or hand-created files may be automatically
pruned while cached HTML might refer to them.

Every changed image/JS/JSON/CSS file receives a new unique SHA-derived URL,
rather than cloning the entire ~20 MB asset collection for every release.
Neocities free storage still grows over time with changed resources; periodically
review the *read-only* orphan audit before planning a human-approved retention
policy. Do not enable auto-deploy without a controlled first publication.
