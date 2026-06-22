package main

import (
	"compress/gzip"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"gopkg.in/yaml.v3"
)

type Announcement struct {
	Text string `yaml:"text" json:"text"`
	Type string `yaml:"type" json:"type"`
}

type Config struct {
	Header        string         `yaml:"header" json:"header"`
	Description   string         `yaml:"description" json:"description"`
	HeaderColors  []string       `yaml:"header_colors" json:"header_colors"`
	Footer        string         `yaml:"footer" json:"footer"`
	Favicon       string         `yaml:"favicon" json:"favicon"`
	NewTabs       *bool          `yaml:"new_tabs" json:"new_tabs"`
	ShowOnlyDown  bool           `yaml:"show_only_down" json:"show_only_down"`
	Announcements []Announcement `yaml:"announcements" json:"announcements"`
	Buttons       []Button       `yaml:"buttons" json:"buttons"`
	Services      []Service      `yaml:"services" json:"services"`
}

type Button struct {
	Name      string `yaml:"name" json:"name"`
	URL       string `yaml:"url" json:"url"`
	Icon      string `yaml:"icon" json:"icon"`
	Logo      string `yaml:"logo" json:"logo"`
	LogoDark  string `yaml:"logo_dark" json:"logo_dark"`
	LogoLight string `yaml:"logo_light" json:"logo_light"`
}

type Service struct {
	Name        string `yaml:"name" json:"name"`
	URL         string `yaml:"url" json:"url"`
	Category    string `yaml:"category" json:"category"`
	Server      string `yaml:"server" json:"server"`
	Logo        string `yaml:"logo" json:"logo"`
	LogoDark    string `yaml:"logo_dark" json:"logo_dark"`
	LogoLight   string `yaml:"logo_light" json:"logo_light"`
	Icon        string `yaml:"icon" json:"icon"`
	Description string `yaml:"description" json:"description"`
}

var (
	configCache atomic.Pointer[Config]
	statusCache atomic.Pointer[map[string]bool]
	lastModTime atomic.Int64 // UnixNano
	configPath  = "data/config.yaml"
	statusClients sync.Map // map[chan string]bool
)

func applyDefaults(cfg *Config) {
	if cfg.Header == "" {
		cfg.Header = "Simple Dash"
	}
	if cfg.Footer == "" {
		cfg.Footer = "&copy; 2026 Buzz Moody &bull; <a href='https://github.com/BuzzMoody' target='_blank'>GitHub</a> &bull; Built with ☕ and Go"
	}
	if cfg.NewTabs == nil {
		defaultTabs := true
		cfg.NewTabs = &defaultTabs
	}
}

func reloadConfigIfModified() {
	info, err := os.Stat(configPath)
	if err != nil {
		log.Printf("Error stating config file: %v", err)
		return
	}

	modTime := info.ModTime().UnixNano()
	if modTime > lastModTime.Load() {
		data, err := os.ReadFile(configPath)
		if err != nil {
			log.Printf("Error reading config file: %v", err)
			return
		}

		var newConfig Config
		if err := yaml.Unmarshal(data, &newConfig); err != nil {
			log.Printf("Error parsing config file: %v", err)
			return
		}

		applyDefaults(&newConfig)

		configCache.Store(&newConfig)
		lastModTime.Store(modTime)
		log.Println("Config reloaded")
	}
}

func startConfigWatcher() {
	// Check config file every 5 seconds
	ticker := time.NewTicker(5 * time.Second)
	go func() {
		for range ticker.C {
			reloadConfigIfModified()
		}
	}()
}

func loadInitialConfig() error {
	info, err := os.Stat(configPath)
	if err != nil {
		return err
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}

	var newConfig Config
	if err := yaml.Unmarshal(data, &newConfig); err != nil {
		return err
	}

	applyDefaults(&newConfig)

	configCache.Store(&newConfig)
	lastModTime.Store(info.ModTime().UnixNano())
	return nil
}

func checkHealth() {
	cfg := configCache.Load()
	if cfg == nil {
		return
	}

	newStatus := make(map[string]bool)
	var wg sync.WaitGroup
	var mu sync.Mutex

	client := http.Client{Timeout: 3 * time.Second}

	for _, s := range cfg.Services {
		if s.URL == "" {
			continue
		}
		wg.Add(1)
		go func(url string, server string) {
			defer wg.Done()
			
			pingUrl := url
			if server != "" {
				pingUrl = server
			}
			
			req, err := http.NewRequest("GET", pingUrl, nil)
			isUp := false
			if err == nil {
				if resp, err := client.Do(req); err == nil {
					if resp.StatusCode < 500 {
						isUp = true
					}
					resp.Body.Close()
				}
			}
			mu.Lock()
			newStatus[url] = isUp
			mu.Unlock()
		}(s.URL, s.Server)
	}
	wg.Wait()
	statusCache.Store(&newStatus)
}

func startHealthChecker() {
	go func() {
		checkHealth()
		broadcastStatus()
		ticker := time.NewTicker(60 * time.Second)
		for range ticker.C {
			checkHealth()
			broadcastStatus()
		}
	}()
}

func broadcastStatus() {
	status := statusCache.Load()
	if status == nil {
		return
	}
	data, _ := json.Marshal(*status)
	msg := string(data)
	statusClients.Range(func(key, value interface{}) bool {
		ch := key.(chan string)
		select {
		case ch <- msg:
		default:
		}
		return true
	})
}

func statusStreamHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	msgChan := make(chan string, 1)
	statusClients.Store(msgChan, true)

	defer func() {
		statusClients.Delete(msgChan)
		close(msgChan)
	}()

	if status := statusCache.Load(); status != nil {
		data, _ := json.Marshal(*status)
		w.Write([]byte("data: " + string(data) + "\n\n"))
		flusher.Flush()
	}

	pingTicker := time.NewTicker(15 * time.Second)
	defer pingTicker.Stop()

	for {
		select {
		case msg := <-msgChan:
			w.Write([]byte("data: " + msg + "\n\n"))
			flusher.Flush()
		case <-pingTicker.C:
			w.Write([]byte(": ping\n\n"))
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	status := statusCache.Load()
	if status == nil {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{}`))
		return
	}

	data, err := json.Marshal(*status)
	if err != nil {
		http.Error(w, "Failed to encode status", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func configHandler(w http.ResponseWriter, r *http.Request) {
	cfg := configCache.Load()
	if cfg == nil {
		http.Error(w, "Config not loaded", http.StatusInternalServerError)
		return
	}

	data, err := json.Marshal(cfg)
	if err != nil {
		http.Error(w, "Failed to encode config", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// gzipResponseWriter wraps http.ResponseWriter to support gzip compression
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

// gzipMiddleware compresses HTTP responses for clients that support it
func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") || r.Header.Get("Accept") == "text/event-stream" {
			next.ServeHTTP(w, r)
			return
		}

		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Vary", "Accept-Encoding")
		gz := gzip.NewWriter(w)
		defer gz.Close()

		gzw := gzipResponseWriter{Writer: gz, ResponseWriter: w}
		next.ServeHTTP(gzw, r)
	})
}

// cacheMiddleware sets caching headers for static assets
func cacheMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Cache for 24 hours (86400 seconds)
		w.Header().Set("Cache-Control", "public, max-age=86400")
		next.ServeHTTP(w, r)
	})
}

// noCacheMiddleware sets headers to prevent caching for dynamic assets
func noCacheMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		next.ServeHTTP(w, r)
	})
}

func faviconHandler(w http.ResponseWriter, r *http.Request) {
	cfg := configCache.Load()
	if cfg != nil && cfg.Favicon != "" {
		// Serve the configured favicon with caching headers
		w.Header().Set("Cache-Control", "public, max-age=86400")
		http.ServeFile(w, r, "./data/logos/"+cfg.Favicon)
		return
	}
	http.NotFound(w, r)
}

func main() {
	if err := loadInitialConfig(); err != nil {
		log.Fatalf("Fatal: Could not load initial config (ensure config.yaml is mounted in data/): %v", err)
	}

	startConfigWatcher()
	startHealthChecker()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/config", configHandler)
	mux.HandleFunc("/api/status", statusHandler)
	mux.HandleFunc("/api/status/stream", statusStreamHandler)
	mux.HandleFunc("/favicon.ico", faviconHandler)
	mux.Handle("/logos/", http.StripPrefix("/logos/", cacheMiddleware(http.FileServer(http.Dir("./data/logos")))))
	mux.Handle("/", noCacheMiddleware(http.FileServer(http.Dir("./static"))))

	port := "8888"
	log.Printf("Server starting on port %s...", port)
	
	// Apply gzip middleware to the entire mux router
	if err := http.ListenAndServe(":"+port, gzipMiddleware(mux)); err != nil {
		log.Fatal(err)
	}
}
