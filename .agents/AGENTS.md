# Project Topology & Architecture Primer
*   The backend uses Go's standard library `net/http` to serve an API and render templates.
*   The frontend relies strictly on Vanilla JavaScript and CSS (located in `/static`).
*   Go's `embed` package is used to bake static assets directly into the compiled binary to ensure a single, portable executable.
*   The application runs exclusively as a Docker container, with user configurations and external assets mounted via volume to `/app/data/`.

# Best Practices & Guidelines

## 1. Maximum Performance & Efficiency
All code written for this project must be as efficient and performant as possible. Avoid unnecessary overhead, optimize operations, and ensure the app remains blazing fast even on low-powered hardware. When polling services for status updates, polling intervals must never drop below 5 seconds, and you must use bounded concurrency for network requests.

## 2. High-Performance Animations
When implementing CSS animations, strictly limit them to compositor-only properties (`transform` and `opacity`). Never continuously animate properties that trigger layout reflows or repaints (like `box-shadow`, `width`, `height`, or `margin`) to ensure zero performance overhead for low-powered clients.

## 3. Modular Code & Zero-Dependency Policy
Whenever a feature is added or removed, ensure that all code relating to that feature is added or completely removed in a modular way. Always reuse existing functions, CSS, and structural code to avoid doubling up on functionality and to keep the codebase ultra-lean.
*   **Zero-Dependency First:** Do not introduce new Go modules (in `go.mod`) or external JavaScript/CSS libraries unless absolutely necessary and explicitly approved. Utilize Go's standard library and Vanilla JavaScript web APIs to solve problems first.

# Documentation & Configuration

## 4. Keep Docs in Sync
Every time you push a change to the repository, you MUST check that `README.md` and `data/config.example.yaml` are fully up-to-date with any new features added, or any features removed. Ensure all configuration options are beautifully documented with their defaults.

## 5. Config Backward-Compatibility
Users mount their own `config.yaml` and upgrade the container independently. Any new configuration field must have a safe default when absent. Renaming or removing a field must degrade gracefully with a logged warning; it must never cause a crash.

# Stability & Testing

## 6. Plan-First Workflow & Explicit User Approval
Before making any code changes, structural modifications, or committing files, you MUST create a detailed `.md` plan file outlining the feature or fix and present it to the user. You MUST NEVER automatically modify codebase files or execute `git commit` / `git push` without explicit user review and approval of the plan first.
*   **Explicit Commits:** Only run `git add`, `git commit`, and `git push` when explicitly instructed to do so by the user after their review of the changes. Always write descriptive, conventional commit messages that clearly explain the specific change being made.
*   **Crucial Constraint:** When authorized to commit changes, you may only run `git commit` and `git push` **after** locally running and successfully passing `go build`, `go vet ./...`, and `node --check`.

## 7. Strict Go Compilation & Quality
The backend is written in Go, which strictly prohibits unused imports and variables. Whenever you refactor code or remove features from `main.go`, you MUST thoroughly check for any leftover imported packages that are no longer referenced and remove them. 
*   Before committing any backend changes, you MUST always verify your modifications by running `go build` locally to catch any compilation errors.
*   You must also run `go vet ./...` to catch behavioral bugs and `gofmt -w .` to ensure standard, idiomatic Go formatting.

## 8. Strict JavaScript Syntax & Scope Checking
Before committing any changes to JavaScript files (e.g. `static/script.js`), you MUST verify there are no syntax errors by running `node --check <path/to/file.js>` locally.
*   **Crucial Constraint:** `node --check` ONLY catches syntax errors. It DOES NOT catch runtime `ReferenceError`s (e.g., using undefined variables). Before injecting or moving code, you MUST manually read the surrounding lines to verify that all referenced variables are explicitly defined and accessible within that exact scope.

# Language & Convention

## 9. Strict Go Modules Cleanliness
Whenever you add, modify, or remove packages from Go files, you MUST run `go mod tidy` to ensure `go.mod` and `go.sum` remain perfectly clean and accurate before committing.

## 10. Security & XSS Prevention
Since the dashboard renders user-defined configuration values (like URLs, Names, and custom HTML), you must actively ensure that all user-supplied outputs are safely escaped or sanitised to prevent Cross-Site Scripting (XSS) vulnerabilities.
*   **Backend Constraint:** Always use Go's `html/template` package (never `text/template`) for anything rendering config-supplied values.
*   **Frontend Constraint:** Never assign config-derived strings to `innerHTML` in JavaScript; strictly use `textContent` or `setAttribute`.

## 11. Australian English
All written comments, code, instructions, and documentation must be in Australian English (e.g., using "colour" instead of "color"). This rule can be ignored only where code functions or functionality strictly rely on American English syntaxes (such as CSS property names).
*   **Strict Exemption:** Spelling conventions apply to prose, comments, and identifiers only. Never alter config keys, CLI flags, or field names that are already shipped, as these are frozen regardless of spelling.

# Architecture & Deployment

## 12. Docker & Volume Architecture
This application is designed to be run exclusively as a Docker container by end-users. The static assets and Go binary are baked into the container image. The end-user provides configuration and assets by mounting a persistent volume to `/app/data/` (e.g. `config.yaml` and `/logos/`). Any decisions regarding file paths, file reading/writing, or asset management MUST take this immutable container and volume-mount architecture into account.

## 13. Docker-Native Logging
Never write application logs to the container's local filesystem. All backend logging, warnings, and errors must be written to standard output (`os.Stdout`) and standard error (`os.Stderr`) so they can be reliably captured by the Docker daemon.

## 14. Path Traversal Prevention
When reading user-supplied configuration values or serving external assets from `/app/data/`, you must rigorously sanitize file paths using `filepath.Clean()` and actively verify they do not escape the designated base directory before proceeding.

## 15. Strict Context & Conflict Verification
Before making any modifications to CSS, HTML, or JavaScript (especially when refactoring or moving styles):
1. You MUST read at least 20 lines of surrounding code to ensure you aren't missing duplicate properties, media queries, or conflicting logic.
2. You MUST actively search the file to ensure the property you are adding or removing isn't overridden immediately below it.
3. Never make assumptions about how a class is currently styled; always verify its existing properties first.

## 16. Strict Git Staging & Data Privacy
Never use wildcard staging commands like `git add .`, `git add -A`, or `git commit -a`. You MUST explicitly name the specific files you have modified or created when staging (e.g., `git add main.go static/style.css`). Before committing, you must run `git status` to verify exactly what is being staged. This strict policy ensures that generated reports, internal scratchpads, or sensitive data are never accidentally committed to the public repository.

## 17. Widget Animations & Colours
When implementing new API widgets, you MUST ensure that any numeric values returned by the backend (e.g. counts, speeds, percentages) are processed through the `getWidgetMetricColors` and `animateMetric` functions in `script.js` so they use the smooth slot-machine animation and flash effect. Furthermore, you must update `getWidgetMetricColors` to properly categorise the new metric's key based on a good-to-bad scale (Green, Yellow, Orange, Red) if applicable. For indifferent values or "0" values on bad metrics, leave the colour standard (return `null`).