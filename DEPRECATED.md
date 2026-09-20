# Deprecated Functionality Registry

This document records all configuration options, widget fields, and architectural behaviours that have been deprecated or superseded in Simple Dash, along with their deprecation version and replacement guidelines.

---

## 1. Top-Level `show_sys_metrics`

* **Status:** Deprecated (v0.1.7) / Superseded (dev branch).
* **Original Behaviour:** A root-level boolean flag (`show_sys_metrics: true|false`) in `config.yaml` that automatically prepended a default system metrics widget card to the dashboard.
* **Deprecation Rationale:** System metrics are now treated as a first-class standalone widget like all other services, giving users complete control over its title, position, icon, and customisation.
* **Replacement:** Add a `sys_metrics` entry to the top-level `widgets:` array.

### Migration Example

**Old (`config.yaml`):**
```yaml
show_sys_metrics: true
```

**Replacement (`config.yaml`):**
```yaml
widgets:
  - name: "Host System"
    type: "sys_metrics"
    icon: "💻"
```

---

## 2. Nested Service Widgets (`services[].widget`)

* **Status:** Deprecated (v0.1.7) / Superseded (dev branch).
* **Original Behaviour:** Defining an API widget directly inside a service item under `services:`, for example:
  ```yaml
  services:
    - name: "Pi-hole"
      url: "http://192.168.1.10/admin"
      widget:
        type: "pihole"
        url: "http://192.168.1.10/admin/api.php"
        auth:
          key: "..."
  ```
* **Deprecation Rationale:** Nested service widgets coupled the service link with API telemetry display, creating confusion between navigation shortcuts and dashboard status widgets. Standalone widgets in the dedicated `widgets:` block allow independent layout, dedicated telemetry rendering, and cleaner configuration schema.
* **Replacement:** Define the widget under the top-level `widgets:` block and the service link under `services:`.

### Migration Example

**Old (`config.yaml`):**
```yaml
services:
  - name: "Pi-hole"
    url: "http://192.168.1.10/admin"
    category: "Infrastructure"
    logo: "pi-hole.svg"
    widget:
      type: "pihole"
      url: "http://192.168.1.10/admin/api.php"
      auth:
        key: "secret123"
```

**Replacement (`config.yaml`):**
```yaml
widgets:
  - name: "Pi-hole Stats"
    type: "pihole"
    logo: "pi-hole.svg"
    url: "http://192.168.1.10/admin/api.php"
    auth:
      key: "secret123"

services:
  - name: "Pi-hole"
    url: "http://192.168.1.10/admin"
    category: "Infrastructure"
    logo: "pi-hole.svg"
    description: "Network-wide Ad Blocking"
```

---

## 3. Legacy Local Storage Keys (`dashy-*`)

* **Status:** Deprecated (v0.1.7) / Superseded (dev branch).
* **Original Behaviour:** Reading `dashy-theme`, `dashy-layout`, `dashy-groupby`, and `dashy-weather` from `localStorage`.
* **Deprecation Rationale:** Migration from legacy naming to standard `simpledash-*` prefix.
* **Replacement:** Use `simpledash-theme`, `simpledash-layout`, `simpledash-groupby`, and `simpledash-weather`.

---

## 4. Blocky `/metrics` Prometheus Scraping

* **Status:** Deprecated (v0.1.7) / Removed (dev branch).
* **Original Behaviour:** The Blocky widget fetched raw Prometheus text from `http://<ip>:4000/metrics` and parsed regex lines.
* **Deprecation Rationale:** Blocky's `/metrics` endpoint exports per-client counters and does not represent global query totals accurately. Modern Blocky provides a dedicated `/api/stats` JSON endpoint that returns exact, aggregated query and blocking totals.
* **Replacement:** Point the Blocky widget `url` to `http://<ip>:4000/api/stats` (or simply `http://<ip>:4000`) and ensure statistics collection is enabled in your Blocky configuration.

### Migration Example

**Old (`config.yaml`):**
```yaml
widgets:
  - name: "Blocky Stats"
    type: "blocky"
    url: "http://192.168.1.10:4000/metrics"
```

**Replacement (`config.yaml`):**
```yaml
widgets:
  - name: "Blocky Stats"
    type: "blocky"
    url: "http://192.168.1.10:4000/api/stats"
```
