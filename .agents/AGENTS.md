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

## 5. Continuous Integration & Commits
After successfully completing a task, making structural modifications, or implementing a bug fix, you MUST automatically commit your changes to the Git repository using `git add`, `git commit -m "..."`, and `git push`. Always write descriptive, conventional commit messages that clearly explain the specific change being made (e.g., `feat: Implement dynamic category-based hover colors` or `fix: Resolve CSS variable scoping issue`). This ensures a continuous and well-documented workflow across sessions.

# Stability & Testing
## 6. Strict Go Compilation & Unused Imports
The backend is written in Go, which strictly prohibits unused imports and variables. Whenever you refactor code or remove features from `main.go`, you MUST thoroughly check for any leftover imported packages that are no longer referenced and remove them. Furthermore, before committing any backend changes, you MUST always verify your modifications by running `go build` locally to catch any compilation errors.
