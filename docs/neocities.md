# Neocities publication and services

Neocities hosts the generated static files. Python, GitHub workflows and
Cloudflare Workers are not executed by uploading their source files there.

## First publication

1. Set `siteUrl` in `site.config.json` to your real HTTPS website origin.
2. Build and run the README checks.
3. In GitHub repository Settings → Secrets and variables → Actions, add
   `NEOCITIES_API_KEY` from your Neocities site settings. Never put it in Git.
4. Open Actions → Deploy to Neocities → Run workflow on `main`.
5. Verify root, all `/nauts/<slug>/` URLs, image paths and `not_found.html` on
   the live host. The workflow publishes the exact selected main revision.

Alternative: upload the contents of `dist/` manually, preserving directories.
Do not upload the `dist` directory itself as a nested folder. Omit the hidden
build marker. Source JSON, raw Wiki exports, tests and Worker code are not part
of the generated frontend upload.

The script calls the official upload API once and does not delete remote
files. Obsolete files from earlier versions therefore require explicit cleanup
after reviewing what should be removed. No publication was performed during
the repository foundation task.

## Local upload

Set `NEOCITIES_API_KEY` privately in your shell, then run:

```powershell
.\.venv\Scripts\python.exe scripts/build.py
.\.venv\Scripts\python.exe scripts/deploy_neocities.py
```

## Public endpoints

`site.config.json` contains public addresses, never credentials:

- `playerCountUrl`: HTTPS URL of the separately deployed
  `workers/players-worker.js`. It queries Steam app 204300 and exposes only
  the current number. The frontend refreshes while visible and never invents
  a count. Steam caching may delay apparent updates.
- `guestbookUrl`: HTTPS URL of the separately deployed
  `workers/guestbook-worker.js`. Bind a Cloudflare KV namespace as `GUESTBOOK`
  and set `SITE_ORIGIN` to your exact Neocities origin, without a trailing `/`.

New guestbook entries use `pending:` keys and are not public. To approve an
entry, copy its JSON to the same key suffix with `published:` and remove its
pending key. Pending entries expire after 30 days. The Worker returns up to
50 published entries; KV eventual consistency means cooldown is best effort.

Rebuild/publish after changing endpoint addresses. Until configured, the
frontend retains its honest pending states and browser-local guestbook draft.

Official references:
- https://neocities.org/api
- https://neocities.org/site_files/allowed_types
