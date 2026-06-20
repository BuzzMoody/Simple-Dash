# Simple Dash

A stunning, ultra-fast, frosted-glass inspired homelab dashboard. Written in Go and delivered as an extremely lightweight distroless Docker container.

## Features
- **Ultra-Lightweight**: Built on a statically compiled Go backend packaged in a secure `distroless` image.
- **Glassmorphism UI**: Beautiful, dynamic gradients and frosted glass elements natively powered by pure CSS.
- **Dynamic Tooltips**: Hover over services to reveal elegant, floating descriptions.
- **Responsive Dock**: A mobile-first floating dock that keeps navigation, themes, and groupings accessible at all times.
- **Live Updates**: Edit your configuration file on the fly; the dashboard re-renders automatically without needing to restart the container!

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
- `header`: *(String)* The primary title of your dashboard.
- `description`: *(String)* A subtitle displayed inline with the header.
- `header_colors`: *(Array of Strings)* A list of precisely two hex colors (e.g. `["#38bdf8", "#a855f7"]`) to create a custom gradient for your header text. If omitted, falls back to the default theme colors.
- `footer`: *(String)* Custom text to be displayed at the very bottom of the page.

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
Links that appear immediately below the announcements, perfect for global administrative tools (like your Router or Proxmox nodes).
```yaml
buttons:
  - name: "Router"
    url: "http://192.168.1.1"
    icon: "🌐"
```

### Services
Your primary application cards.
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
- `url`: *(String)* The destination link when the card is clicked.
- `category`: *(String)* The group this service belongs to. Used when you toggle the grouping mode in the floating dock.
- `logo`: *(String)* The exact filename of an image stored inside your local `logos/` directory.
- `icon`: *(String)* A fallback text emoji if the logo cannot be loaded or is omitted.
- `description`: *(String)* (Optional) A brief description that elegantly floats in a frosted tooltip whenever a user hovers over the card.

---
*Built with Go & Vanilla JS*
