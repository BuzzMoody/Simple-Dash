package main

import (
	"compress/gzip"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/fsnotify/fsnotify"
	"gopkg.in/yaml.v3"
)

type Announcement struct {
	Text string `yaml:"text" json:"text"`
	Type string `yaml:"type" json:"type"`
}

type CategoryColorsConfig struct {
	Enabled bool `yaml:"enabled" json:"enabled"`
	Titles  bool `yaml:"titles" json:"titles"`
}

func (c *CategoryColorsConfig) UnmarshalYAML(value *yaml.Node) error {
	if value.Kind == yaml.ScalarNode {
		var b bool
		if err := value.Decode(&b); err != nil {
			return err
		}
		c.Enabled = b
		return nil
	}

	type alias CategoryColorsConfig
	var a alias
	if err := value.Decode(&a); err != nil {
		return err
	}
	*c = CategoryColorsConfig(a)
	return nil
}

type Config struct {
	Header         string               `yaml:"header" json:"header"`
	Description    string               `yaml:"description" json:"description"`
	HeaderColors   []string             `yaml:"header_colors" json:"header_colors"`
	Footer         string               `yaml:"footer" json:"footer"`
	Favicon        string               `yaml:"favicon" json:"favicon"`
	NewTabs        *bool                `yaml:"new_tabs" json:"new_tabs"`
	ShowOnlyDown   bool                 `yaml:"show_only_down" json:"show_only_down"`
	ShowPing       bool                 `yaml:"show_ping" json:"show_ping"`
	ShowWeather    bool                 `yaml:"show_weather" json:"show_weather"`
	WeatherAnimate *bool                `yaml:"weather_animate" json:"weather_animate"`
	WeatherCoords  string               `yaml:"weather_coords" json:"weather_coords"`
	ShowSysMetrics *bool                `yaml:"show_sys_metrics" json:"show_sys_metrics"`
	CategoryColors CategoryColorsConfig `yaml:"category_colors" json:"category_colors"`
	Announcements  []Announcement       `yaml:"announcements" json:"announcements"`
	Buttons        []Button             `yaml:"buttons" json:"buttons"`
	Services       []Service            `yaml:"services" json:"services"`
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
	Pinned      bool   `yaml:"pinned" json:"pinned"`
}

type ServiceStatus struct {
	IsUp    bool `json:"is_up"`
	Latency int  `json:"latency,omitempty"`
}

type SysMetrics struct {
	CPU    int    `json:"cpu"`
	RAM    int    `json:"ram"`
	Uptime string `json:"uptime"`
}

type StreamPayload struct {
	Services map[string]ServiceStatus `json:"services"`
	Metrics  *SysMetrics              `json:"metrics,omitempty"`
}

var (
	configCache   atomic.Pointer[Config]
	statusCache   atomic.Pointer[map[string]ServiceStatus]
	lastModTime   atomic.Int64 // UnixNano
	configPath    = "data/config.yaml"
	statusClients sync.Map // map[chan string]bool

	globalClient = &http.Client{Timeout: 3 * time.Second}

	//go:embed VERSION
	versionData []byte

	//go:embed static/index.html
	rawIndexHTML []byte

	//go:embed static/style.css
	styleCSS []byte

	//go:embed static/script.js
	scriptJS []byte

	//go:embed static/sw.js
	swJS []byte

	indexHTML []byte
)

func initStaticFiles() {
	versionStr := strings.TrimSpace(string(versionData))
	if versionStr != "" {
		indexStr := strings.ReplaceAll(string(rawIndexHTML), "{{VERSION}}", versionStr)
		indexHTML = []byte(indexStr)
	} else {
		indexHTML = rawIndexHTML
	}
}

func handleMemFile(content []byte, contentType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Content-Type", contentType)
		w.Write(content)
	}
}

func applyDefaults(cfg *Config) {
	if cfg.Header == "" {
		cfg.Header = "Simple Dash"
	}
	if cfg.Description == "" {
		cfg.Description = "A simple homelab dashboard"
	}
	if cfg.Footer == "" {
		cfg.Footer = "\u00a9 2026 Buzz Moody \u2022 [GitHub](https://github.com/BuzzMoody) \u2022 Built with \u2615 and Go"
	}
	if cfg.NewTabs == nil {
		defaultTabs := true
		cfg.NewTabs = &defaultTabs
	}
	if cfg.ShowSysMetrics == nil {
		defaultMetrics := true
		cfg.ShowSysMetrics = &defaultMetrics
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
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("Failed to create fsnotify watcher: %v. Falling back to polling.", err)
		ticker := time.NewTicker(5 * time.Second)
		go func() {
			for range ticker.C {
				reloadConfigIfModified()
			}
		}()
		return
	}

	go func() {
		defer watcher.Close()
		var timer *time.Timer
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if strings.HasSuffix(event.Name, "config.yaml") && (event.Has(fsnotify.Write) || event.Has(fsnotify.Create)) {
					if timer != nil {
						timer.Stop()
					}
					timer = time.AfterFunc(100*time.Millisecond, func() {
						reloadConfigIfModified()
					})
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Printf("Config watcher error: %v", err)
			}
		}
	}()

	err = watcher.Add("data")
	if err != nil {
		log.Printf("Failed to add data directory to watcher: %v", err)
	}
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

	newStatus := make(map[string]ServiceStatus)
	var wg sync.WaitGroup
	var mu sync.Mutex

	sem := make(chan struct{}, 10) // Limit to 10 concurrent requests

	for _, s := range cfg.Services {
		if s.URL == "" {
			continue
		}
		wg.Add(1)
		go func(srv Service) {
			defer wg.Done()

			sem <- struct{}{}
			defer func() { <-sem }()

			pingUrl := srv.URL
			if srv.Server != "" {
				pingUrl = srv.Server
			}

			start := time.Now()
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			req, err := http.NewRequestWithContext(ctx, "GET", pingUrl, nil)
			isUp := false
			latencyMs := 0
			if err == nil {
				if resp, err := globalClient.Do(req); err == nil {
					if resp.StatusCode < 500 {
						isUp = true
					}
					resp.Body.Close()
					if cfg.ShowPing {
						latencyMs = int(time.Since(start).Milliseconds())
						if latencyMs == 0 {
							latencyMs = 1
						}
					}
				}
			}

			status := ServiceStatus{IsUp: isUp, Latency: latencyMs}

			mu.Lock()
			newStatus[srv.URL] = status
			mu.Unlock()
		}(s)
	}
	wg.Wait()
	statusCache.Store(&newStatus)
}

var (
	lastCPUTotal float64
	lastCPUIdle  float64
)

func getSysMetrics() *SysMetrics {
	metrics := &SysMetrics{}

	// CPU
	statBytes, err := os.ReadFile("/proc/stat")
	if err == nil {
		lines := strings.Split(string(statBytes), "\n")
		if len(lines) > 0 {
			fields := strings.Fields(lines[0])
			if len(fields) > 4 && fields[0] == "cpu" {
				var total float64
				for _, f := range fields[1:] {
					v, _ := strconv.ParseFloat(f, 64)
					total += v
				}
				idle, _ := strconv.ParseFloat(fields[4], 64)

				if lastCPUTotal > 0 {
					diffTotal := total - lastCPUTotal
					diffIdle := idle - lastCPUIdle
					if diffTotal > 0 {
						metrics.CPU = int((diffTotal - diffIdle) / diffTotal * 100)
					}
				}
				lastCPUTotal = total
				lastCPUIdle = idle
			}
		}
	}

	// RAM
	memBytes, err := os.ReadFile("/proc/meminfo")
	if err == nil {
		lines := strings.Split(string(memBytes), "\n")
		var memTotal, memAvailable float64
		for _, line := range lines {
			if strings.HasPrefix(line, "MemTotal:") {
				fields := strings.Fields(line)
				if len(fields) > 1 {
					memTotal, _ = strconv.ParseFloat(fields[1], 64)
				}
			} else if strings.HasPrefix(line, "MemAvailable:") {
				fields := strings.Fields(line)
				if len(fields) > 1 {
					memAvailable, _ = strconv.ParseFloat(fields[1], 64)
				}
			}
		}
		if memTotal > 0 {
			metrics.RAM = int(((memTotal - memAvailable) / memTotal) * 100)
		}
	}

	// Uptime
	uptimeBytes, err := os.ReadFile("/proc/uptime")
	if err == nil {
		fields := strings.Fields(string(uptimeBytes))
		if len(fields) > 0 {
			uptimeSecs, _ := strconv.ParseFloat(fields[0], 64)
			days := int(uptimeSecs) / 86400
			hours := (int(uptimeSecs) % 86400) / 3600
			if days > 0 {
				metrics.Uptime = fmt.Sprintf("%dd %02dh", days, hours)
			} else {
				metrics.Uptime = fmt.Sprintf("%dh", hours)
			}
		}
	}

	return metrics
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
	cfg := configCache.Load()
	payload := StreamPayload{
		Services: *status,
	}
	if cfg != nil && cfg.ShowSysMetrics != nil && *cfg.ShowSysMetrics {
		payload.Metrics = getSysMetrics()
	}
	data, _ := json.Marshal(payload)
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
		cfg := configCache.Load()
		payload := StreamPayload{
			Services: *status,
		}
		if cfg != nil && cfg.ShowSysMetrics != nil && *cfg.ShowSysMetrics {
			payload.Metrics = getSysMetrics()
		}
		data, _ := json.Marshal(payload)
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
	wroteHeader bool
}

func (w *gzipResponseWriter) WriteHeader(statusCode int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	w.ResponseWriter.Header().Del("Content-Length")
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *gzipResponseWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	return w.Writer.Write(b)
}

var gzipPool = sync.Pool{
	New: func() interface{} {
		return gzip.NewWriter(io.Discard)
	},
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

		gz := gzipPool.Get().(*gzip.Writer)
		gz.Reset(w)
		defer func() {
			gz.Close()
			gzipPool.Put(gz)
		}()

		gzw := &gzipResponseWriter{Writer: gz, ResponseWriter: w}
		next.ServeHTTP(gzw, r)
	})
}

func faviconHandler(w http.ResponseWriter, r *http.Request) {
	cfg := configCache.Load()
	if cfg != nil && cfg.Favicon != "" {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

		baseDir := filepath.Clean("data/logos")
		cleanPath := filepath.Clean(filepath.Join(baseDir, cfg.Favicon))

		if !strings.HasPrefix(cleanPath, baseDir) {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		http.ServeFile(w, r, cleanPath)
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

	initStaticFiles()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/config", configHandler)
	mux.HandleFunc("/api/status/stream", statusStreamHandler)
	mux.HandleFunc("/favicon.ico", faviconHandler)
	mux.Handle("/logos/", http.StripPrefix("/logos/", http.FileServer(http.Dir("./data/logos"))))

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/", "/index.html":
			handleMemFile(indexHTML, "text/html; charset=utf-8")(w, r)
		case "/style.css":
			handleMemFile(styleCSS, "text/css; charset=utf-8")(w, r)
		case "/script.js":
			handleMemFile(scriptJS, "application/javascript; charset=utf-8")(w, r)
		case "/sw.js":
			handleMemFile(swJS, "application/javascript; charset=utf-8")(w, r)
		default:
			http.NotFound(w, r)
		}
	})

	port := "8888"
	log.Printf("Server starting on port %s...", port)

	// Apply gzip middleware to the entire mux router
	if err := http.ListenAndServe(":"+port, gzipMiddleware(mux)); err != nil {
		log.Fatal(err)
	}
}
