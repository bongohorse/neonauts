# Cold-load lab measurements

Revision: e57d0b9f18654a1226897a3bafa8267aa882a09d; Chromium 141.0.7390.37; Playwright 1.56.0.

Mode: local-static-lab; CPU ×4; 150 ms latency; 1.6 Mbit/s download; 750 kbit/s upload; cache bypass; DPR 1.25.

| Scenario | Metric | Median | Min | Max | Raw samples |
|---|---|---:|---:|---:|---|
| root-desktop | fcp | 1564.000 | 1532.000 | 1688.000 | 1688.000, 1532.000, 1564.000, 1572.000, 1556.000 |
| root-desktop | lcp | 2472.000 | 2468.000 | 2480.000 | 2468.000, 2480.000, 2480.000, 2472.000, 2472.000 |
| root-desktop | cls | 0.000 | 0.000 | 0.000 | 0.000, 0.000, 0.000, 0.000, 0.000 |
| root-desktop | transferBytes | 588249.000 | 588249.000 | 588249.000 | 588249.000, 588249.000, 588249.000, 588249.000, 588249.000 |
| root-desktop | requests | 37.000 | 37.000 | 37.000 | 37.000, 37.000, 37.000, 37.000, 37.000 |
| root-desktop | layout | 124.674 | 110.311 | 145.522 | 145.522, 129.048, 122.905, 124.674, 110.311 |
| root-desktop | script | 51.284 | 47.708 | 57.230 | 51.284, 50.512, 47.708, 57.230, 56.917 |
| root-desktop | longTasks | 2.000 | 2.000 | 2.000 | 2.000, 2.000, 2.000, 2.000, 2.000 |
| pages-mobile | fcp | 1580.000 | 1556.000 | 1692.000 | 1580.000, 1692.000, 1560.000, 1656.000, 1556.000 |
| pages-mobile | lcp | 1580.000 | 1556.000 | 1692.000 | 1580.000, 1692.000, 1560.000, 1656.000, 1556.000 |
| pages-mobile | cls | 0.000 | 0.000 | 0.000 | 0.000, 0.000, 0.000, 0.000, 0.000 |
| pages-mobile | transferBytes | 588249.000 | 588249.000 | 588249.000 | 588249.000, 588249.000, 588249.000, 588249.000, 588249.000 |
| pages-mobile | requests | 37.000 | 37.000 | 37.000 | 37.000, 37.000, 37.000, 37.000, 37.000 |
| pages-mobile | layout | 134.899 | 128.446 | 160.526 | 134.899, 160.526, 143.955, 128.446, 129.492 |
| pages-mobile | script | 52.263 | 44.781 | 54.182 | 52.263, 54.182, 53.372, 49.823, 44.781 |
| pages-mobile | longTasks | 2.000 | 2.000 | 2.000 | 2.000, 2.000, 2.000, 2.000, 2.000 |

Times are milliseconds; CLS unitless; bytes include encoded response/header bytes reported by CDP. Long-task counts cover the observation window. CPU durations are cumulative CDP counters, not a breakdown of individual peaks. See docs/performance.md for limits.
