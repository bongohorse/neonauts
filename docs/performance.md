# Reproducible cold-load lab benchmark

Install the existing pinned browser dependency once:

```sh
npm install --no-save --no-package-lock playwright@1.56.0
npx playwright install --with-deps chromium
```

With Python requirements installed, one command builds and measures both root
and Pages-prefix scenarios, five independent samples each:

```sh
node tests/performance.mjs
```

Use `PYTHON` to select a Python executable when needed. `--runs 10` increases
samples; `--out tests/artifacts/performance-before` preserves a comparison.
Results: `raw.json`, `summary.csv`, `summary.md` and first-run viewport PNGs.
Failure screenshots and partial raw results survive failed runs. These ignored
artifacts can be attached to a PR; do not commit large traces by default.

Conditions: desktop 1365×768, mobile viewport 390×844, DPR 1.25, CPU ×4,
150 ms network latency, 1.6 Mbit/s download and 750 kbit/s upload. These are
explicit CDP Fast-4G-like parameters; DevTools preset definitions can differ
between browser versions. Each navigation gets a fresh context, cache bypass
and blocked service workers. This bypasses browser cache, not a CDN edge cache.
The local HTTP server sends uncompressed assets; production compression,
TLS/connection overhead and CDN conditions differ. Compare like with like.

No interaction takes place before collection. Snapshot is two seconds after
load; LCP remains provisional until the page is hidden/closed, so delayed content
outside this window is excluded. FCP, LCP (including element and URL), navigation
and layout-shift observations use browser Performance APIs. CLS excludes shifts
with recent input but sums the fixed observation window; it is not the full
session-window field CLS algorithm. Long Tasks API counts main-thread tasks ≥50 ms
but cannot explain JS call stacks, workers, GPU work or individual layout peaks.
Supported entry types are saved and absent FCP/LCP evidence fails validation.
CDP Performance counters expose cumulative layout, style, script and task CPU time;
these overlap and must not be summed into an invented total. CPU counters are
not an attribution trace. CDP encoded bytes include response/header bytes and
are grouped by network resource type; Resource Timing is also preserved.

All cross-origin requests are explicitly blocked and listed in each sample;
external outages must not affect local pass/fail. Same-origin HTTP failures,
network errors and uncaught JS errors fail validation. The default unopened
radio and guestbook have no configured external dependency. Inspect exclusions
before comparing results. Never infer production correctness from these runs.

For an explicit manual read-only CDN diagnostic (not allowed in CI):

```sh
node tests/performance.mjs --url https://awesomenauts.neocities.org/ --out tests/artifacts/performance-production
```

This also blocks third-party services and measures only a desktop viewport.
It neither uploads files nor modifies credentials. Its results must be kept
separate from local runs. Physical touch/audio and user-field CWV are separate.

Report raw values and median/range; do not select the fastest run. Use the same
browser version, machine, build mode and conditions for before/after. Alternate
before/after runs when variance is large. A single external user trace is context,
not this harness's baseline. CI collects five runs without brittle millisecond
thresholds; correctness assertions and browser smoke remain the pass/fail gates.

Unit checks: `node --test tests/performance-metrics.test.mjs`. Full native smoke
requires the three builds documented by the CI browser job (including immutable
release preparation); the README's older two-build example is insufficient for
that third scenario.
