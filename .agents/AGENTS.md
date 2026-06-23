# Best Practices & Guidelines

## 1. Maximum Performance & Efficiency
All code written for this project must be as efficient and performant as possible. Avoid unnecessary overhead, optimize operations, and ensure the app remains blazing fast even on low-powered hardware.

## 2. High-Performance Animations
When implementing CSS animations, strictly limit them to compositor-only properties (`transform` and `opacity`). Never continuously animate properties that trigger layout reflows or repaints (like `box-shadow`, `width`, `height`, or `margin`) to ensure zero performance overhead for low-powered clients.

## 3. Modular Code & Reusability
Whenever a feature is added or removed, ensure that all code relating to that feature is added or completely removed in a modular way. Always reuse existing functions, CSS, and structural code to avoid doubling up on functionality and to keep the codebase ultra-lean.

# Documentation & Features
## 4. Keep Docs in Sync
Every time you push a change to the repository, you MUST check that `README.md` and `data/config.example.yaml` are fully up-to-date with any new features added, or any features removed. Ensure all configuration options are beautifully documented with their defaults.
