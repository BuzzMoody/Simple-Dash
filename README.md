# Simple Dash

A stunning, ultra-fast, frosted-glass inspired homelab dashboard. Written in Go and delivered as an extremely lightweight distroless Docker container. 

## Features
- **Ultra-Lightweight Backend**: Built on a statically compiled Go backend and packaged in a highly secure `distroless` image.
- **Glassmorphism UI**: Beautiful, dynamic gradients and frosted glass elements natively powered by pure CSS.
- **Native Light/Dark Mode**: Built-in theme toggle that perfectly adjusts gradients, backgrounds, text colors, and shadows.
- **Theme-Aware Logos**: Support for dynamically switching custom SVG/PNG logos based on the active light/dark theme.
- **Live Health Checks**: Automatically polls your internal services every 60 seconds and pushes instant updates to the UI via Server-Sent Events (SSE).
- **Dynamic Sorting & Grouping**: Instantly toggle between categorical grouping or alphabetical sorting.
- **Real-Time Search**: Built-in, ultra-fast client-side search to quickly filter your services by name, description, or category.
- **Hot-Reloading Configuration**: Edit your configuration file on the fly; the dashboard re-renders automatically without needing to restart the container!

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
  ghcr.io/buzzmoody/simple-dash:main
```

#### Option B: Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  simple-dash:
    image: ghcr.io/buzzmoody/simple-dash:main
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

## Configuration Guide (`config.yaml`)

The entire dashboard is driven by a single `config.yaml` file mounted into the `/app/data` directory. If the container cannot find this file upon booting, it will instantly exit with a fatal error.

### Global Settings
```yaml
header: "Homelab"
description: "My personal server dashboard"
header_colors: ["#38bdf8", "#a855f7"]
footer: "&copy; 2026 Buzz Moody &middot; <a href='https://github.com/BuzzMoody'>GitHub</a>"
favicon: "favicon.svg"
new_tabs: true
show_only_down: false
```
- `header`: *(String)* The primary title of your dashboard.
- `description`: *(String)* A subtitle displayed inline with the header.
- `header_colors`: *(Array of Strings)* A list of precisely two hex colors (e.g. `["#38bdf8", "#a855f7"]`) to create a custom gradient for your header text. If omitted, falls back to the default theme colors.
- `footer`: *(String)* Custom text to be displayed at the very bottom of the page.
- `favicon`: *(String)* The exact filename of an SVG stored inside your `logos/` directory to be used as the browser tab icon.
- `new_tabs`: *(Boolean)* Default is `true`. Sets whether clicking a service or button opens in a new browser tab or the current one.
- `show_only_down`: *(Boolean)* Default is `false`. If set to `true`, the UI will only display status indicators for services that are offline (hiding the green online dots).

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

### Services
Your primary application cards. The dashboard automatically monitors the `url` via HTTP GET requests every 60 seconds to display live health dots.
```yaml
services:
  - name: "Plex"
    url: "http://10.0.0.5:32400"
    category: "Media"
    logo: "plex.svg"
    icon: "🍿"
    description: "Main media streaming server"
```
**Service Options:**
- `name`: *(String)* The title of the application.
- `url`: *(String)* The destination link when the card is clicked. This is also used for the backend health check if `server` is omitted.
- `server`: *(String)* (Optional) A local IP or internal hostname for the backend to use strictly for health checks, bypassing the public `url`.
- `category`: *(String)* The group this service belongs to. Used when grouping mode is enabled.
- `logo`: *(String)* The exact filename of an image stored inside your local `logos/` directory.
- `logo_light` / `logo_dark`: *(String)* Optional alternative logos that dynamically swap depending on the user's active theme.
- `icon`: *(String)* A fallback text emoji if the logo cannot be loaded or is omitted.
- `description`: *(String)* (Optional) A brief description that elegantly floats in a frosted tooltip whenever a user hovers over the card.

---
*Built with Go & Vanilla JS*
