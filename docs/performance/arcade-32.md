# Lazy Arcade — #32

Canvas context creation and first draw now happen synchronously when the secret
cube opens the dialog. Reopen reuses the context; existing listeners are bound
once. Drawing is skipped while closed, including the pause-on-close event;
a delayed tick observes closure and stops before doing work. No module loader.

The game never ran an animation loop at ordinary startup previously; the waste
was one hidden context/scene paint and its invalidation, not constant idle frames.
The #31 trace captured a drawGame layout invalidation at startup.

Five-run evidence: arcade-32-measurements.md / arcade-32-samples.json.
Desktop median JS CPU 51.284 → 41.262 ms, mobile 52.263 → 42.774 ms.
Desktop LCP 2472 → 2476 ms; mobile LCP 1580 → 1568 ms. Layout is variable
and not consistently better; no claim that this fixes the largest document pass.
The final defensive closed-tick guard does not execute on the measured cold path.

Native probes validate no context/paint/RAF before opening, one context on reopen,
ready scene on first open, keyboard movement, native mouse pointer/release,
pause/resume, Escape/focus restore, high-score persistence, restart reset,
no closed paints and zero pending game frames after close. The close event is
asynchronous; the test waits for cleanup rather than asserting before delivery.
Native root, Pages mobile, immutable mobile smoke and raster checks pass.
57 Python tests, all Node suites and site checker in all three builds pass.
Existing disabled-storage guards are unchanged. Physical touch/audio and native
background-tab suspension remain separate acceptance checks. No merge/deployment.
