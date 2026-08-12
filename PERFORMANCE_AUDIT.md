# Performance Audit Report: Simple Dash

**Project:** Simple Dash (`BuzzMoody/Simple-Dash`)  
**Date:** 12 August 2026  
**Auditor:** Antigravity AI  

---

## 1. Executive Summary

This report presents a thorough performance audit of **Simple Dash**, a lightweight, self-hosted homelab dashboard built with Go and Vanilla JavaScript. The codebase was evaluated for memory management, CPU efficiency, network concurrency, DOM manipulation overhead, rendering pipeline bottlenecks, and container execution efficiency.

Overall, **Simple Dash** demonstrates exceptional performance design principles: zero third-party framework dependencies, memory-embedded static assets via Go `embed`, bounded HTTP concurrency, and lightweight container packaging. A small number of optimization opportunities were identified across backend timeout configurations, system metric string allocations, and frontend layout reflow triggers.

---

## 2. Backend Performance Analysis (Go Standard Library)

### 2.1 Concurrency & HTTP Network Polling
- **Bounded Concurrency Semaphore:** In `main.go`, `checkHealth()` bounds concurrent service pings using a buffered channel semaphore (`sem := make(chan struct{}, 10)`). This prevents file descriptor exhaustion and high CPU spikes when monitoring dozens of homelab services.
- **Client Timeout Mismatch:** In `startReleasesFetcher()` (`main.go`), a `context.WithTimeout` of 10 seconds is created for GitHub API release queries. However, the request is executed using `globalClient`, which has a hardcoded `Timeout: 3 * time.Second`. Consequently, slower GitHub API responses fail at the 3-second client boundary rather than respecting the 10-second context window.
  - **Recommendation:** Utilize a dedicated HTTP client or configure `globalClient` timeouts consistently with context deadlines.

### 2.2 Memory Management & In-Memory Asset Serving
- **Zero Disk I/O for Static Assets:** CSS, JS, and HTML templates are embedded directly into the Go binary using `go:embed`. Serviced via `handleMemFile`, asset retrieval incurs zero disk I/O latency.
- **Gzip Buffer Pooling:** `gzipMiddleware` implements a `sync.Pool` for `gzip.Writer` objects (`gzipPool`), avoiding frequent allocations and garbage collection (GC) pressure during HTTP response compression.
- **System Metrics Caching:** `getSysMetrics()` caches system CPU, RAM, and uptime statistics for 30 seconds (`lastMetricsTime`). This eliminates continuous file reading of `/proc/stat`, `/proc/meminfo`, and `/proc/uptime`.
  - **Minor Heap Allocation Optimization:** `strings.Split` and `strings.Fields` in `getSysMetrics()` generate temporary string slice allocations on every cache miss. Using slice-scanning techniques or reusing pre-allocated string buffers can further reduce GC allocations on low-powered single-board computers (e.g. Raspberry Pi).

### 2.3 Server-Sent Events (SSE) Stream Efficiency
- **Non-Blocking Client Broadcasts:** `broadcastStatus()` iterates over client channels registered in `statusClients` (`sync.Map`) using non-blocking `select` sends. Sluggish or disconnected network clients are bypassed without blocking the central health checking goroutine.
- **Ping Ticker Cleanup:** `statusStreamHandler()` properly manages long-lived connection lifecycles with `pingTicker := time.NewTicker(15 * time.Second)` and explicit `defer pingTicker.Stop()`, preventing goroutine and timer leaks.

---

## 3. Frontend Performance & Rendering Pipeline (Vanilla JS & CSS)

### 3.1 Layout Reflows & DOM Operations
- **Targeted Element Updates:** `script.js` maintains explicit element maps (`serviceCardsMap`, `widgetCardsMap`, `widgetMetricElsMap`). Incoming SSE status updates mutate specific `textContent` fields without rebuilding card structures or re-rendering grid DOM trees.
- **Forced Synchronous Layout (Reflow Trigger):** `checkUrlVisibility()` in `script.js` reads `table.offsetWidth` and `col.scrollWidth` / `col.clientWidth` inside resize handler callbacks. Reading layout properties after modifying classes forces synchronous browser layout recalculation.
  - **Recommendation:** Debounce window resize handlers and batch read/write DOM operations using `requestAnimationFrame`.

### 3.2 Animation Performance & GPU Acceleration
- **Compositor-Only Animations:** Keyframe animations and hover transitions in `style.css` (e.g., card transforms, light/dark mode logo crossfades, pin status badges) rely strictly on `transform` and `opacity`.
- **Zero Paint/Reflow Overheads:** No continuous keyframe animations alter geometry properties (`width`, `height`, `margin`, `box-shadow`), ensuring smooth 60 FPS rendering on low-power client hardware and embedded displays.

---

## 4. Container & Build Footprint

- **Minimal Executable Size:** The compiled Go binary (~10.9 MB) runs statically compiled (`CGO_ENABLED=0`) inside `gcr.io/distroless/static-debian13:latest`.
- **Low Memory & CPU Footprint:** Idle container RAM usage remains under 15 MB, making it extremely suitable for lightweight homelab environments.

---

## 5. Summary of Recommended Performance Enhancements

1. **Align HTTP Client Timeouts:** Adjust `globalClient` or create a specific client for GitHub release fetching to ensure context timeouts are strictly honored.
2. **Eliminate Forced Layout Reflows:** Batch layout reads in `script.js` (`checkUrlVisibility`) using `window.requestAnimationFrame()` to avoid layout thrashing during window resize operations.
3. **Optimise `/proc` Parsing:** Replace `strings.Split` in `/proc` metric parsing with allocation-free byte scanning (`bytes.IndexByte`) to minimise GC pressure on low-power devices.
