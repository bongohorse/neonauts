# GitHub Pages preview

Preview URL: https://bongohorse.github.io/neonauts/

GitHub Pages serves the same generated static website as Neocities. The preview
workflow rebuilds on every push to main and can also be run manually.
No Neocities API key is required for this preview.

## One-time activation

1. Open https://github.com/bongohorse/neonauts/settings/pages while signed in.
2. Under Build and deployment, choose **GitHub Actions** as the Source.
3. Open Actions → GitHub Pages preview and run the workflow on main if the
   latest workflow already failed before Pages was activated.

The workflow checks tests and generated links before uploading the Pages
artifact and deploying it to the github-pages environment. Its environment
link and the README provide the website URL. Actions must be permitted in the
repository. Pages activation is an account-side setting, not a source file.

## Paths

The Pages build uses `python scripts/build.py --base-path /neonauts/`.
Naut pages, shared assets and navigation use relative URLs; custom error pages
receive the correct `/neonauts/` prefix. Neocities/local builds keep `/`.

```powershell
.\.venv\Scripts\python.exe scripts/build.py --base-path /neonauts/
.\.venv\Scripts\python.exe scripts/check.py
```

Serve this preview output beneath `/neonauts/` when reproducing the Pages
prefix locally. An ordinary root-level local preview uses the default build.

The public guestbook remains browser-local until a Worker is connected. A
future guestbook Worker must allow the origin of the host where it is used;
GitHub Pages and Neocities have different origins. Hosted music and live
players retain the same pending status as the normal site until configured.
