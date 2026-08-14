# Feature Proposals & Architectural Assessment: Simple Dash

**Project:** Simple Dash (`BuzzMoody/Simple-Dash`)  
**Date:** 14 August 2026  
**Compliance Standard:** `AGENTS.md` (Rules 1–17)  
**Language Standard:** Australian English  

---

## Executive Summary

This document presents a curated set of feature proposals for **Simple Dash**, designed to expand the dashboard's capabilities while maintaining strict compliance with the architecture, performance, security, and coding standards defined in [AGENTS.md](file:///.agents/AGENTS.md).

Every proposed feature adheres strictly to:
* **Zero-Dependency Policy:** Built entirely using Go's standard library and native Vanilla JavaScript/CSS Web APIs without introducing external modules or frontend libraries.
* **Maximum Performance & Efficiency:** Bounded network concurrency, zero layout reflows during animations, and polling intervals restricted to $\ge 5\text{s}$.
* **Hardware Acceleration:** CSS transitions strictly limited to compositor-only properties (`transform` and `opacity`).
* **Security & XSS Prevention:** HTML template escaping, strict DOM assignment via `textContent`/`setAttribute`, path traversal prevention via `filepath.Clean()`, and credential masking.
* **Backward-Compatible Configuration:** Safe default values for all absent YAML configuration fields.

---

## Proposal Matrix Overview

| Proposal | Primary Utility | Target Files | Code Size Impact | Polling / Perf Impact | Security Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Docker Container Health & Metrics Widget** | Direct container status & RAM/CPU telemetry | `widget_docker.go`, `main.go`, `script.js`, `style.css` | ~+8 KB binary<br>~+1.6 KB static | 15s polling, bounded socket context | Read-only socket queries, `textContent` rendering |
| **2. AdGuard Home DNS Widget** | DNS statistics & blocking metrics | `widget_adguard.go`, `main.go`, `script.js` | ~+5 KB binary<br>~+1.0 KB static | 30s polling, bounded HTTP client | Credential masking (`json:"-"`), XSS safe |
| **3. Service Latency Sparklines** | Latency history & stability visualization | `main.go`, `script.js`, `style.css` | ~+3 KB binary<br>~+2.5 KB static | Zero extra I/O, ring buffer (<10 KB RAM) | Pure SVG DOM creation, no text injection |
| **4. Multi-Criteria Tagging & Search Engine** | Cross-category tagging (`#tag`) | `main.go`, `script.js`, `style.css` | ~+1 KB binary<br>~+2.1 KB static | Client-side DOM filtering, zero reflows | Input escaping on tag pill rendering |
| **5. Speedtest Tracker Widget** | Internet bandwidth monitoring | `widget_speedtest_tracker.go`, `main.go`, `script.js` | ~+4 KB binary<br>~+900 B static | 60s polling, single GET endpoint | Token masking (`json:"-"`), metric sanitisation |
| **6. Collapsible Category Sections** | View management for large homelabs | `script.js`, `style.css` | ~+500 B binary<br>~+1.9 KB static | GPU compositor transitions (`transform`), `localStorage` | Domain-scoped storage keys |

---

## Detailed Feature Specifications

### 1. Native Docker Container Health & Metrics Widget (`widget_docker.go`)

#### Feature Description
Homelab administrators predominantly deploy their self-hosted applications using Docker containers. This feature introduces a native API widget that connects directly to the host's Docker daemon via UNIX domain socket (`unix:///var/run/docker.sock`) or TCP socket. It retrieves container status (Running, Stopped, Paused, Unhealthy) and live telemetry (CPU percentage and memory consumption in megabytes) to display on the associated service card.

#### Required Code Changes
1. **Backend (`widget_docker.go`):**
   * Create a new file [`widget_docker.go`](file:///Storage/Apps/Antigravity/Dash/widget_docker.go) implementing the `WidgetParser` interface.
   * Configure a custom `http.Client` using Go's standard library `net.DialContext` to dial UNIX sockets:
     ```go
     transport := &http.Transport{
         DialContext: func(ctx context.Context, proto, addr string) (net.Conn, error) {
             return net.DialTimeout("unix", "/var/run/docker.sock", 2*time.Second)
         },
     }
     ```
   * Query the Docker Engine API endpoint `/containers/{id_or_name}/json` for status and `/containers/{id_or_name}/stats?stream=false` for CPU/RAM telemetry.
2. **Registry (`main.go`):**
   * Register `"docker"` in `widgetRegistry` inside [`main.go`](file:///Storage/Apps/Antigravity/Dash/main.go#L98-L107).
3. **Frontend (`static/script.js`):**
   * Extend `getWidgetMetricColors` to categorise `cpu_pct` and `mem_mb` on a good-to-bad color scale (Green $<50\%$, Yellow $50\text{--}80\%$, Orange $80\text{--}90\%$, Red $>90\%$).
   * Connect numeric values to `animateMetric` for slot-machine transition effects.
4. **Styling (`static/style.css`):**
   * Define compact layout styles for container telemetry badges matching existing glassmorphism design tokens.
5. **Configuration & Documentation (`data/config.example.yaml`, `README.md`):**
   * Document `widget.type: "docker"` with socket URL and container name options.

#### Code Size Impact
* **Go Compiled Binary:** ~+8 KB increase (uses standard library `net`, `net/http`, and `encoding/json`).
* **Static Assets:** ~+1.2 KB JavaScript, ~+400 Bytes CSS.
* **Config Memory:** Microsecond YAML struct decoding footprint.

#### Performance Impact
* **Polling Interval:** Configured to 15 seconds, comfortably above the 5-second minimum constraint in Rule 1.
* **Network & I/O:** Socket connections use `stream=false` to prevent long-polling goroutine locks. Timeout is bounded to 2 seconds per query.
* **Concurrency:** Query executes inside `checkHealth()` bounded channel semaphore (`sem := make(chan struct{}, 10)`).

#### Security Assessment
* **Socket Path Sanitisation:** Path passed to UNIX dialer is validated with `filepath.Clean()` to prevent directory traversal outside the designated socket path.
* **XSS Prevention:** Container names and status strings rendered strictly using DOM `textContent`.
* **Read-Only Access:** Backend executes strict HTTP `GET` requests against Docker Engine API; no container lifecycle control endpoints (`POST`/`DELETE`) are exposed.

---

### 2. Native AdGuard Home DNS & Security Widget (`widget_adguard.go`)

#### Feature Description
AdGuard Home is one of the most widely deployed network-wide DNS ad-blocking and privacy filtering solutions in modern homelabs. This feature adds a native AdGuard Home widget that polls `/control/status` and `/control/stats` to display total DNS queries, blocked query count, percentage blocked, and malware/phishing domains intercepted over 24 hours.

#### Required Code Changes
1. **Backend (`widget_adguard.go`):**
   * Implement `WidgetParser` in [`widget_adguard.go`](file:///Storage/Apps/Antigravity/Dash/widget_adguard.go).
   * Send HTTP `GET` requests using standard HTTP Basic Authentication (`Authorization: Basic <credentials>`) or API tokens.
   * Parse JSON payload into struct fields: `num_dns_queries`, `num_blocked_filtering`, `blocked_percentage`, `num_replaced_safebrowsing`.
2. **Registry (`main.go`):**
   * Add `"adguard": &AdguardWidget{}` to `widgetRegistry` in [`main.go`](file:///Storage/Apps/Antigravity/Dash/main.go#L98-L107).
3. **Frontend (`static/script.js`):**
   * Add metric key mappings in `getWidgetMetricColors` for `blocked_percentage` (Green $>15\%$, Yellow $5\text{--}15\%$, Red $<5\%$).
   * Route metrics through `animateMetric` for visual slot-machine increments.
4. **Configuration & Documentation (`data/config.example.yaml`, `README.md`):**
   * Document `widget.type: "adguard"` with `auth.username` and `auth.password` or `auth.token`.

#### Code Size Impact
* **Go Compiled Binary:** ~+5 KB increase.
* **Static Assets:** ~+800 Bytes JavaScript, ~+200 Bytes CSS.

#### Performance Impact
* **Polling Interval:** Default 30 seconds.
* **Memory Management:** JSON response parsed directly from `resp.Body` via `json.NewDecoder(resp.Body).Decode(...)`, minimising heap slice allocations.
* **Context Timeout:** Strict 3-second deadline per request.

#### Security Assessment
* **Credential Exposure Protection:** Credential fields inside `WidgetConfig.Auth` are explicitly tagged with `yaml:"auth" json:"-"` to ensure API passwords/tokens are NEVER serialised into the public Server-Sent Events (SSE) stream sent to client browsers.
* **XSS Safe:** All numerical outputs passed via `textContent`.

---

### 3. Service Latency Sparklines & Uptime History (Zero Dependencies)

#### Feature Description
While current status dots show single-point-in-time service health, intermittent homelab network drops or temporary high latency can go unnoticed. This feature adds a rolling latency history buffer to backend health checks. The frontend renders a subtle 10-bar SVG latency sparkline on hover or within the service card footer, providing visual insight into service stability over time.

#### Required Code Changes
1. **Backend (`main.go`):**
   * Expand `ServiceStatus` struct in [`main.go`](file:///Storage/Apps/Antigravity/Dash/main.go#L122-L126) with `LatencyHistory []int` (`json:"latency_history"`).
   * Maintain a rolling fixed-size slice ($N=10$) for each service in memory within `checkHealth()`.
2. **Frontend (`static/script.js`):**
   * Implement lightweight inline SVG generator function `renderLatencySparkline(history)` using native browser DOM `document.createElementNS("http://www.w3.org/2000/svg", ...)`.
   * Map individual latency bars to colour spectrum:
     * Green: $<50\text{ ms}$
     * Yellow: $50\text{--}150\text{ ms}$
     * Orange: $150\text{--}300\text{ ms}$
     * Red: $>300\text{ ms}$ or Offline ($0\text{ ms}$)
3. **Styling (`static/style.css`):**
   * Style sparkline container (`height: 16px`, `gap: 2px`) with zero layout reflow overhead.
4. **Configuration (`data/config.example.yaml`, `README.md`):**
   * Document global toggle `show_latency_history: true` (Default: `false`).

#### Code Size Impact
* **Go Compiled Binary:** ~+3 KB increase (ring-buffer slice maintenance).
* **Static Assets:** ~+2.5 KB JavaScript, ~+500 Bytes CSS.

#### Performance Impact
* **Memory Overhead:** Each service retains exactly 10 integer values in RAM ($80\text{ Bytes}$). For 100 configured services, memory footprint is $<10\text{ KB}$.
* **Zero External Graphing Libraries:** Built completely without external libraries like Chart.js or D3.js, satisfying Rule 3.
* **DOM Rendering:** SVG nodes update in-place during SSE status broadcasts without re-building service card DOM nodes.

#### Security Assessment
* **Injection Safety:** SVG attributes (`x`, `y`, `height`, `fill`) are assigned exclusively using numeric coordinate math via `setAttribute`. No user-supplied text strings are injected into SVG markup.

---

### 4. Cross-Category Tagging & Multi-Criteria Filtering Engine

#### Feature Description
As homelabs grow to dozens of services across multiple servers, grouping by category alone can become restrictive. This feature introduces custom tag arrays for services (e.g. `tags: ["public", "docker", "media"]`). Users can click tag badges on service cards or type tag queries (such as `#public` or `#docker`) in the search bar to perform multi-criteria filtering across all categories.

#### Required Code Changes
1. **Backend (`main.go`):**
   * Add `Tags []string` field (`yaml:"tags" json:"tags"`) to `Service` struct in [`main.go`](file:///Storage/Apps/Antigravity/Dash/main.go#L109-L120).
2. **Frontend (`static/script.js`):**
   * Update search filtering logic `filterServices()` to inspect both text query matches and `#tag` tokens.
   * Render tag pills inside service card elements during initial initialization.
   * Add click listeners to tag pills to auto-fill the search bar with `#tagname`.
3. **Styling (`static/style.css`):**
   * Define pill styles with hardware-accelerated hover states (`transform: translateY(-1px)`, `opacity: 0.9`).
4. **Configuration & Documentation (`data/config.example.yaml`, `README.md`):**
   * Document `tags` syntax in service YAML configuration and update search keyboard navigation docs.

#### Code Size Impact
* **Go Compiled Binary:** ~+1 KB (YAML field unmarshaling).
* **Static Assets:** ~+2.1 KB JavaScript, ~+600 Bytes CSS.

#### Performance Impact
* **Client-Side Filtering:** Operates instantaneously in JavaScript memory using existing `serviceCardsMap`.
* **Zero Reflows:** Visibility is toggled via `hidden` attribute or `display: none` class assignment, avoiding layout recalculations during search input.

#### Security Assessment
* **XSS Prevention:** Tag strings are sanitised and output via `textContent` when generating DOM pills. Arbitrary HTML or script characters inside tag strings cannot execute.

---

### 5. Native Speedtest Tracker Widget (`widget_speedtest_tracker.go`)

#### Feature Description
Homelab users frequently run self-hosted bandwidth monitoring using `alexjustesen/speedtest-tracker`. This feature introduces a native widget parser that fetches the latest automated speedtest result (`/api/speedtest/latest`), displaying real-time download speed (Mbps), upload speed (Mbps), ping latency (ms), and ping jitter (ms).

#### Required Code Changes
1. **Backend (`widget_speedtest_tracker.go`):**
   * Create [`widget_speedtest_tracker.go`](file:///Storage/Apps/Antigravity/Dash/widget_speedtest_tracker.go) implementing `WidgetParser`.
   * Execute HTTP `GET` request to `/api/speedtest/latest` with `Authorization: Bearer <token>`.
   * Decode download, upload, ping, and jitter telemetry.
2. **Registry (`main.go`):**
   * Register `"speedtest-tracker": &SpeedtestTrackerWidget{}` in `widgetRegistry` inside [`main.go`](file:///Storage/Apps/Antigravity/Dash/main.go#L98-L107).
3. **Frontend (`static/script.js`):**
   * Define metric color rules in `getWidgetMetricColors` (Download: Green $>200\text{ Mbps}$, Yellow $50\text{--}200\text{ Mbps}$, Red $<50\text{ Mbps}$).
   * Bind numeric metrics to `animateMetric` slot-machine visual counters.
4. **Configuration & Documentation (`data/config.example.yaml`, `README.md`):**
   * Document `widget.type: "speedtest-tracker"` syntax and auth options.

#### Code Size Impact
* **Go Compiled Binary:** ~+4 KB compiled.
* **Static Assets:** ~+700 Bytes JavaScript, ~+200 Bytes CSS.

#### Performance Impact
* **Polling Interval:** Default 60 seconds (speedtest results update infrequently).
* **Network Traffic:** Single HTTP GET request yielding $<1\text{ KB}$ JSON payload, governed by a 3-second context deadline.

#### Security Assessment
* **Token Protection:** `Auth.token` configured with `json:"-"` struct tag to prevent leaking tokens in public SSE streams.
* **XSS Safe:** Numeric metrics rendered exclusively through `textContent` and standard number formatters.

---

### 6. Collapsible Category Sections with Compositor-Only GPU Transitions

#### Feature Description
For dashboards with 6+ categories and 30+ services, collapsible category sections allow users to minimize less frequently accessed categories (such as "Backups" or "Infrastructure"). Collapsed states are remembered across sessions using browser `localStorage`.

#### Required Code Changes
1. **Frontend (`static/script.js`):**
   * Attach click event listeners to category headers in `script.js`.
   * Save collapsed category titles to `localStorage` key `dash_collapsed_categories`.
   * On page load, apply `.is-collapsed` state prior to initial render to prevent layout shift.
2. **Styling (`static/style.css`):**
   * Implement GPU-accelerated transitions for disclosure chevron and category content visibility:
     ```css
     .category-chevron {
         transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
     }
     .category-header.is-collapsed .category-chevron {
         transform: rotate(-90deg);
     }
     .category-grid {
         transition: opacity 0.2s ease, transform 0.2s ease;
         transform-origin: top center;
     }
     .category-grid.is-collapsed {
         opacity: 0;
         transform: scaleY(0.95);
         display: none;
     }
     ```
   * Strictly avoid animating reflow properties (`height`, `max-height`, `margin`) to satisfy Rule 2.
3. **Configuration & Documentation (`data/config.example.yaml`, `README.md`):**
   * Document optional global key `collapsible_categories: true` (Default: `false`).

#### Code Size Impact
* **Go Compiled Binary:** ~+500 Bytes (configuration struct field).
* **Static Assets:** ~+1.9 KB JavaScript, ~+700 Bytes CSS.

#### Performance Impact
* **Compositor-Only Animations:** Chevron rotation and grid fade operate entirely on the GPU compositor thread without triggering layout reflows or repaints.
* **Zero CLS (Cumulative Layout Shift):** `localStorage` state is read synchronously during UI setup before card rendering.

#### Security Assessment
* **Web Storage Safety:** `localStorage` key is strictly scoped to origin domain. Category identifiers are sanitized before DOM lookup.

---

## Architectural & Compliance Verification Protocol

To ensure all feature implementations remain bug-free and compliant with codebase quality standards, any pull request or commit introducing these features must pass the following local validation pipeline before committing:

1. **Backend Verification:**
   ```bash
   go fmt ./...
   go vet ./...
   go build -o test_build main.go widget_*.go
   go test ./...
   go mod tidy
   ```
2. **Frontend Syntax & Scope Check:**
   ```bash
   node --check static/script.js
   ```
3. **Documentation Sync:**
   * Verify all new YAML settings are documented with safe default fallbacks in [`data/config.example.yaml`](file:///Storage/Apps/Antigravity/Dash/data/config.example.yaml).
   * Update [`README.md`](file:///Storage/Apps/Antigravity/Dash/README.md) with feature descriptions and configuration options.
4. **Git Staging Compliance (Rule 16):**
   * Strictly stage explicit files (never use `git add .` or `git add -A`).
