# Simple Dash

A stunning, ultra-fast, frosted-glass inspired homelab dashboard. Written in Go and delivered as an extremely lightweight distroless Docker container. 

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./screenshot_dark.png?v=2">
    <source media="(prefers-color-scheme: light)" srcset="./screenshot_light.png?v=2">
    <img alt="Simple Dash Dashboard" src="./screenshot_dark.png?v=2">
  </picture>
</div>

## Features
- **Ultra-Lightweight Backend**: Built on a statically compiled Go backend and packaged in a highly secure `distroless` image.
- **Glassmorphism UI**: Beautiful, dynamic gradients and frosted glass elements natively powered by pure CSS.
- **Native Light/Dark Mode**: Built-in theme toggle that perfectly adjusts gradients, backgrounds, text colours, and shadows.
- **Theme-Aware Logos**: Support for dynamically switching custom SVG/PNG logos based on the active light/dark theme.
- **Live Health Checks**: Automatically polls your internal services every 60 seconds and pushes instant updates to the UI via Server-Sent Events (SSE).
- **Dynamic API Widgets**: Pin beautiful, real-time widgets to your dashboard that fetch live data from your favourite services (Pi-hole, Proxmox, Portainer, etc.).

- **Dynamic Sorting & Grouping**: Instantly toggle between categorical grouping or alphabetical sorting.
- **Real-Time Search**: Built-in, ultra-fast client-side search to quickly filter your services by name, description, or category.
- **Hot-Reloading Configuration**: Edit your configuration file on the fly; the dashboard re-renders automatically without needing to restart the container!
- **Automatic Updates & Changelogs**: Instantly see when a new version is available, and view your current version's changelog directly in the footer.

## Getting Started

### 1. Prepare your Directory

Create a directory on your host machine to store your configuration and custom logos.

```bash
mkdir -p /home/user/simple-dash/logos
```

1. Copy the provided `data/config.example.yaml` into your newly created folder and rename it to `config.yaml`.
2. Add any custom `.png` or `.svg` logo files directly into the `logos/` folder.

### 2. Run the Container

#### Option A: Docker Run

```bash
docker run -d \
  --name simple-dash \
  -p 8888:8888 \
  -v /home/user/simple-dash:/app/data \
  --restart unless-stopped \
  ghcr.io/buzzmoody/simple-dash:latest
```

#### Option B: Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  simple-dash:
    image: ghcr.io/buzzmoody/simple-dash:latest
    container_name: simple-dash
    ports:
      - "8888:8888"
    volumes:
      - /home/user/simple-dash:/app/data
    restart: unless-stopped
```

Start the stack by running:
```bash
docker compose up -d
```

#### Option C: Extended Docker Compose (Healthchecks)

Simple Dash includes a built-in healthcheck for container orchestrators. You can explicitly define this in your `docker-compose.yml` to ensure your orchestrator knows exactly when the dashboard is healthy and ready:

```yaml
version: '3.8'

services:
  simple-dash:
    image: ghcr.io/buzzmoody/simple-dash:latest
    container_name: simple-dash
    ports:
      - "8888:8888"
    volumes:
      - /home/user/simple-dash:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "/app/dash", "-healthcheck"]
      interval: 30s
      timeout: 3s
      retries: 3
```

## Keyboard Navigation & Search

Simple Dash features powerful, performance-focused keyboard navigation out of the box:

- **Silent Search**: Start typing anywhere on the dashboard to instantly filter your services. Your keystrokes are automatically captured into the search bar without stealing native focus.
- **Grid Navigation**: Use the `Up`, `Down`, `Left`, and `Right` arrow keys to seamlessly fly through your service cards in any layout. Press `Enter` to open the highlighted service.
- **Quick Focus**: Press `/` to instantly snap your cursor directly into the search bar for native text manipulation or pasting.
- **Quick Clear**: Press `Esc` at any time to instantly clear your current search filter and reset the dashboard view, or click the `X` button in the search bar.

## Configuration Guide (`config.yaml`)

The entire dashboard is driven by a single `config.yaml` file mounted into the `/app/data` directory. If the container cannot find this file upon booting, it will instantly exit with a fatal error.

### Global Settings
```yaml
header: "Homelab"
description: "My personal server dashboard"
header_colors: ["#38bdf8", "#a855f7"]
footer: "\u00a9 2026 Buzz Moody \u00b7 [GitHub](https://github.com/BuzzMoody)"
favicon: "favicon.svg"
new_tabs: true
show_sys_metrics: true
show_only_down: false
show_ping: true
show_weather: false
weather_animate: true
# weather_coords: "-37.81826872134725, 144.96705907138596"
# github_token: "ghp_xxxxxxxxxxxxxxxxxxxxxx"
category_colors:
  enabled: false
  titles: false
```
- `header`: *(String)* The primary title of your dashboard.
- `description`: *(String)* A subtitle displayed inline with the header.
- `header_colors`: *(Array of Strings)* A list of precisely two hex colours (e.g. `["#38bdf8", "#a855f7"]`) to create a custom gradient for your header text. If omitted, falls back to the default theme colours.
- `footer`: *(String)* Custom text to be displayed at the very bottom of the page. Supports standard Markdown links `[text](url)`. Note: HTML entities (like `&copy;`) are not fully supported; use literal Unicode characters (like `©`) instead.
- `favicon`: *(String)* The exact filename of an SVG stored inside your `logos/` directory to be used as the browser tab icon.
- `new_tabs`: *(Boolean)* Default is `true`. Sets whether clicking a service or button opens in a new browser tab or the current one.
- `show_sys_metrics`: *(Boolean)* Default is `true`. If set to `true`, a live hardware metrics pill (CPU, RAM, Uptime) is elegantly displayed at the top of the dashboard, updating every 60 seconds with zero backend overhead.
- `show_only_down`: *(Boolean)* Default is `false`. Only display the status dot on services that are offline. Online services will have no dot, keeping the UI cleaner.
- `show_ping`: *(Boolean)* Default is `false`. If set to `true`, the UI will dynamically display the ping latency in milliseconds for healthy online services (appended to tooltips in Grid view, and displayed in the status column in List view), colour-coded based on response time. This option operates entirely independently of `show_only_down`.
- `show_weather`: *(Boolean)* Default is `false`. Fetches and displays the current local temperature and a weather icon in the dashboard subheading. Does not require any API keys.
- `weather_animate`: *(Boolean)* Default is `true`. Toggles the smooth, theme-aware colour animations on the weather icons.
- `weather_coords`: *(String)* (Optional) Hardcode your latitude and longitude as a comma-separated string (e.g. `"-37.81826872134725, 144.96705907138596"`) for the weather module. If omitted, the dashboard will automatically fall back to an IP-based location API to approximate your location without needing browser permissions.
- `github_token`: *(String)* (Optional) Add your GitHub Personal Access Token to prevent hitting rate limits when the dashboard checks for updates.
- `category_colors`: *(Boolean or Object)* Default is `false`. If set to `true`, cards will have uniquely generated colours based on their category. Can also be defined as a nested object to enable additional colouring options:
  - `enabled`: *(Boolean)* Colourises service cards and category title borders.
  - `titles`: *(Boolean)* Colourises the category title text itself to match.

### Announcements
Display highly visible global status alerts or messages at the top of the dashboard.
```yaml
announcements:
  - text: "System maintenance at midnight"
    type: "warning"
```
**Types available:**
- `success` (Green / Online)
- `warning` (Yellow / Alert)
- `outage` (Red / Down)
- *omit* (Default Frosted Purple)

### Quick Action Buttons
Links that appear in the top-right header, perfect for global administrative tools (like your Router or Proxmox nodes).
```yaml
buttons:
  - name: "Router"
    url: "http://192.168.1.1"
    icon: "🌐"
```
**Button Options:**
- `name`: *(String)* The title of the button.
- `url`: *(String)* The destination link.
- `icon`: *(String)* A fallback text emoji.
- `logo`: *(String)* The filename of an image stored inside your `logos/` directory.
- `logo_light` / `logo_dark`: *(String)* Optional alternative logos that dynamically swap depending on the user's active theme.

### Standalone Widgets
Decoupled top-level widgets that monitor services, infrastructure, or host stats independently of service cards.
```yaml
widgets:
  - name: "Pi-hole Statistics"
    type: "pihole"
    logo: "pi-hole.svg"
    url: "http://192.168.1.10/admin/api.php"
    auth:
      key: "your_secret_api_key_here"
```
**Widget Options:**
- `name`: *(String)* Custom title for the standalone widget card.
- `type`: *(String)* Widget parser key (e.g. `pihole`, `proxmox`, `portainer`, `qbittorrent`, `jellyfin`, `speedtest`, `homeassistant`, `blocky`).
- `url`: *(String)* Target API endpoint URL.
- `logo` / `icon`: *(String)* Optional custom logo filename from `logos/` or emoji text.
- `auth`: *(Map)* API keys or credentials (hidden from browser SSE streams).
- `settings`: *(Map)* Additional widget-specific configuration parameters.

### Services
Your primary application cards. The dashboard automatically monitors the `url` via HTTP GET requests every 60 seconds to display live health dots.
```yaml
services:
  - name: "Pi-Hole"
    url: "http://192.168.1.10/admin"
    category: "Infrastructure"
    logo: "pi-hole.svg"
    description: "Network-wide Ad Blocking"
    widget:
      type: "pihole"
      url: "http://192.168.1.10/admin/api.php"
      auth:
        key: "your_secret_api_key_here"

  - name: "Plex"
    url: "http://10.0.0.5:32400"
    category: "Media"
    logo: "plex.svg"
    icon: "🍿"
    description: "Main media streaming server"
```
**Service Options:**
- `name`: *(String)* The title of the application.
- `url`: *(String)* The destination link when the card is clicked and used for backend health checks.
- `category`: *(String)* The group this service belongs to. Used when grouping mode is enabled.
- `pinned`: *(Boolean)* (Optional) Default is `false`. If set to `true`, the service will be pinned to a special 'Favourites' group at the very top of the dashboard.
- `logo`: *(String)* The exact filename of an image stored inside your local `logos/` directory.
- `logo_light` / `logo_dark`: *(String)* Optional alternative logos that dynamically swap depending on the user's active theme.
- `icon`: *(String)* A fallback text emoji if the logo cannot be loaded or is omitted.
- `description`: *(String)* (Optional) A brief description that elegantly floats in a frosted tooltip whenever a user hovers over the card.
- `widget`: *(Object)* (Optional) Enables a dynamic data widget to display live API data directly on the card.

<details>
<summary><strong>📊 Click here for an in-depth guide on configuring Widgets</strong></summary>

<br>

Widgets are beautiful, API-driven cards that render live metrics fetched directly from your applications. To add a widget to a service, simply append the `widget` block to your service definition.

### Example configuration

```yaml
  - name: "Portainer"
    url: "http://192.168.1.5:9000"
    category: "Infrastructure"
    widget:
      type: "portainer"
      url: "http://192.168.1.5:9000/api/endpoints/1/docker/containers/json"
      auth:
        key: "ptr_yourSuperSecretApiKey123="
```

### Supported Widgets & Requirements

| Type | Data Displayed | `url` Endpoint Required | `auth.key` Required |
|------|---------------|-------------------------|----------------------|
| `pihole` | Queries & Blocked % | `http://<ip>/admin/api.php` | ✅ Web Password Token |
| `blocky` | Queries & Blocked % | `http://<ip>:4000/metrics` | ❌ None |
| `proxmox` | CPU & RAM Usage | `https://<ip>:8006/api2/json/nodes/<node>/status` | ✅ `PVEAPIToken=User@pam!ID=Secret` |
| `portainer` | Running/Stopped | `http://<ip>:9000/api/endpoints/1/docker/containers/json` | ✅ API Token |
| `qbittorrent`| Up, Down & Torrents | `http://<ip>:8080/api/v2/sync/maindata` | ❌ (Bypass local subnet auth) |
| `jellyfin` | Active Streams | `http://<ip>:8096/Sessions` | ✅ API Token |
| `speedtest` | Speedtest results | `http://<ip>:<port>/api/v1/results/latest` | ✅ API Token (if used) |
| `homeassistant`| Entity State | `http://<ip>:8123/api/states/<entity_id>` | ✅ Long-Lived Access Token |

</details>

## Security Note

**Simple Dash has no built-in authentication.** The public-facing configuration—including service names, URLs, descriptions, and categories—is exposed via the unauthenticated `/api/config` endpoint. Widget credentials (`auth` keys, tokens, and passwords) and internal widget URLs are **never** sent to the browser.

This dashboard is designed to be run safely within an internal homelab environment (LAN or VPN). If you intend to expose Simple Dash to the public internet, you **must** place it behind a reverse proxy with an authentication layer (such as Authelia, Authentik, Tailscale, or Cloudflare Access).

---
*Built with Go & Vanilla JS*
