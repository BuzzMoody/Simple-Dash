# AGENTS.md Compliance Report

After a rigorous line-by-line review of the entire project against the newly updated `.agents/AGENTS.md` guidelines, I have identified a few specific areas of the codebase that currently violate the strict constraints you have set out. 

Here is what needs to be changed:

### 1. 🚨 Security: XSS Vulnerability (Violates Rule 10)
**File:** `static/script.js`
**Constraint:** *"Never assign config-derived strings to innerHTML in JavaScript; strictly use textContent or setAttribute."*

**Issue:** Throughout `script.js`, there are multiple instances where values directly sourced from the user's `config.yaml` are passed directly into `.innerHTML` assignments. This includes `service.name`, `service.description`, `btn.name`, and the global `description` and `footer`. 
**Required Change:** We must refactor these DOM insertions to safely use `.textContent` to prevent Cross-Site Scripting (XSS) injection, or implement a secure HTML sanitization method if HTML rendering is strictly required (like in the footer).

### 2. 🚨 Security: Path Traversal (Violates Rule 14)
**File:** `main.go` (Function: `faviconHandler`)
**Constraint:** *"You must rigorously sanitize file paths using filepath.Clean() and actively verify they do not escape the designated base directory."*

**Issue:** The `faviconHandler` currently handles the user-defined `Favicon` string by blindly concatenating it: 
`http.ServeFile(w, r, "./data/logos/"+cfg.Favicon)`. 
If a malicious user modifies their config to read `favicon: "../../../etc/passwd"`, this function will happily serve arbitrary files outside the container's designated data directory.
**Required Change:** We need to parse this string through `filepath.Clean()` and strictly enforce that the resolved path has a prefix of `./data/logos/`.

### 3. 🧹 Code Quality: Go Formatting (Violates Rule 7)
**File:** `main.go`
**Constraint:** *"You must also run [...] gofmt -w . to ensure standard, idiomatic Go formatting."*

**Issue:** Running `gofmt -l .` currently flags `main.go` as improperly formatted. There are spacing and indentation inconsistencies in the backend code that do not meet the strict idiomatic Go standard.
**Required Change:** Run `gofmt -w main.go` to safely format the file.

---

### Conclusion
Outside of these three issues, the project is remarkably compliant! The Docker structure, standard libraries, zero-dependency policy, CSS animations, and concurrent go-routines are perfectly adhering to your high standards. 

Let me know if you would like me to proceed with implementing these fixes!
