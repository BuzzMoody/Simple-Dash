# Architectural Plan: Align Standalone Widgets with Global Refresh Loop

**Project:** Simple Dash (`BuzzMoody/Simple-Dash`)  
**Task:** Simplify Widget Refreshing by Removing `refresh_interval`  
**Target Files:** `main.go`, `data/config.example.yaml`, `README.md`, `WIDGET_CONFIG_SEPARATION_PLAN.md`  
**Compliance Standard:** `AGENTS.md` (Rules 1–17)  
**Language Standard:** Australian English  

---

## Technical Rationale & Architectural Comparison

### Why relying on the global refresh loop is superior:

| Metric / Aspect | Separate `refresh_interval` Per Widget | Unified Global Refresh Loop (Recommended) |
| :--- | :--- | :--- |
| **Backend Complexity** | Multiple competing tickers, lock contention | Single 60s ticker in `startHealthChecker()` |
| **SSE Stream Overhead** | Fragmented SSE payloads sent out-of-sync | Unified JSON payload broadcasting services & widgets together |
| **Resource Usage (Pi/SBC)**| Frequent CPU wakeups & network context switches | Single batch execution with bounded semaphore (`sem := make(chan struct{}, 10)`) |
| **YAML Configuration** | Noisy config requiring per-widget second values | Clean, minimalistic configuration entries |
| **AGENTS.md Rule 1** | Risk of user setting sub-5s intervals | Guaranteed 60-second cycle bounded concurrency |

---

## Proposed Simplification Plan

1. **Go Backend (`main.go`):**
   * Remove `RefreshInterval` field from `StandaloneWidgetConfig` struct.
   * Remove `RefreshInterval` validation and default assignment in `applyDefaults()`.
   * Continue polling standalone widgets inside `checkHealth()`, which executes on the primary 60-second ticker alongside service health checks.

2. **Documentation & Config Examples (`data/config.example.yaml` & `README.md`):**
   * Remove `refresh_interval` from YAML examples and field option tables in `README.md`.

---

## Verification Pipeline

Upon user approval of this plan:
1. `go build` to verify zero Go compilation errors.
2. `go vet ./...` and `gofmt -w .` to verify backend code quality.
3. `node --check static/script.js` to verify frontend JavaScript syntax.
