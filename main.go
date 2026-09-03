package main

import (
	"compress/gzip"
	"context"
	_ "embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/fsnotify/fsnotify"
	"gopkg.in/yaml.v3"
)

type Announcement struct {
	Text string `yaml:"text" json:"text"`
	Type string `yaml:"type" json:"type"`
}

type CategoryColoursConfig struct {
	Enabled bool `yaml:"enabled" json:"enabled"`
	Titles  bool `yaml:"titles" json:"titles"`
}

func (c *CategoryColoursConfig) UnmarshalYAML(value *yaml.Node) error {
	if value.Kind == yaml.ScalarNode {
		var b bool
		if err := value.Decode(&b); err != nil {
			return err
		}
		c.Enabled = b
		return nil
	}

	type alias CategoryColoursConfig
	var a alias
	if err := value.Decode(&a); err != nil {
		return err
	}
	*c = CategoryColoursConfig(a)
	return nil
}

type StandaloneWidgetConfig struct {
	ID        string            `yaml:"id" json:"id"`
	Name      string            `yaml:"name" json:"name"`
	Type      string            `yaml:"type" json:"type"`
	URL       string            `yaml:"url" json:"-"`
	Icon      string            `yaml:"icon" json:"icon"`
	Logo      string            `yaml:"logo" json:"logo"`
	LogoDark  string            `yaml:"logo_dark" json:"logo_dark"`
	LogoLight string            `yaml:"logo_light" json:"logo_light"`
	Auth      map[string]string `yaml:"auth" json:"-"`
	Settings  map[string]string `yaml:"settings" json:"settings"`
}

type Config struct {
	Header         string                   `yaml:"header" json:"header"`
	Description    string                   `yaml:"description" json:"description"`
	HeaderColors   []string                 `yaml:"header_colors" json:"header_colors"`
	Footer         string                   `yaml:"footer" json:"footer"`
	Favicon        string                   `yaml:"favicon" json:"favicon"`
	NewTabs        *bool                    `yaml:"new_tabs" json:"new_tabs"`
	ShowOnlyDown   bool                     `yaml:"show_only_down" json:"show_only_down"`
	ShowPing       bool                     `yaml:"show_ping" json:"show_ping"`
	ShowWeather    bool                     `yaml:"show_weather" json:"show_weather"`
	WeatherAnimate *bool                    `yaml:"weather_animate" json:"weather_animate"`
	WeatherCoords  string                   `yaml:"weather_coords" json:"weather_coords"`
	ShowSysMetrics *bool                    `yaml:"show_sys_metrics" json:"show_sys_metrics"`
	GithubToken    string                   `yaml:"github_token" json:"-"`
	CategoryColors CategoryColoursConfig    `yaml:"category_colors" json:"category_colors"`
	Announcements  []Announcement           `yaml:"announcements" json:"announcements"`
	Buttons        []Button                 `yaml:"buttons" json:"buttons"`
	Widgets        []StandaloneWidgetConfig `yaml:"widgets" json:"widgets"`
	Services       []Service                `yaml:"services" json:"services"`
}

type Button struct {
	Name      string `yaml:"name" json:"name"`
	URL       string `yaml:"url" json:"url"`
	Icon      string `yaml:"icon" json:"icon"`
	Logo      string `yaml:"logo" json:"logo"`
	LogoDark  string `yaml:"logo_dark" json:"logo_dark"`
	LogoLight string `yaml:"logo_light" json:"logo_light"`
}

type WidgetConfig struct {
	Type     string            `yaml:"type" json:"type"`
	URL      string            `yaml:"url" json:"-"`
	Auth     map[string]string `yaml:"auth" json:"-"`
	Settings map[string]string `yaml:"settings" json:"settings"`
}

type WidgetData map[string]interface{}

type WidgetParser interface {
	Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error)
}

var widgetRegistry = map[string]WidgetParser{
	"pihole":        &PiholeWidget{},
	"proxmox":       &ProxmoxWidget{},
	"portainer":     &PortainerWidget{},
	"qbittorrent":   &QbittorrentWidget{},
	"jellyfin":      &JellyfinWidget{},
	"speedtest":     &SpeedtestWidget{},
	"homeassistant": &HomeAssistantWidget{},
	"blocky":        &BlockyWidget{},
	"sys_metrics":   &SysMetricsWidget{},
	"system":        &SysMetricsWidget{},
}

type SysMetricsWidget struct{}

func (w *SysMetricsWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	metrics := getSysMetrics()
	if metrics == nil {
		return nil, fmt.Errorf("failed to read system metrics")
	}
	return WidgetData{
		"CPU":    fmt.Sprintf("%d%%", metrics.CPU),
		"RAM":    fmt.Sprintf("%d%%", metrics.RAM),
		"Uptime": metrics.Uptime,
	}, nil
}

type Service struct {
	Name        string        `yaml:"name" json:"name"`
	URL         string        `yaml:"url" json:"url"`
	Category    string        `yaml:"category" json:"category"`
	Logo        string        `yaml:"logo" json:"logo"`
	LogoDark    string        `yaml:"logo_dark" json:"logo_dark"`
	LogoLight   string        `yaml:"logo_light" json:"logo_light"`
	Icon        string        `yaml:"icon" json:"icon"`
	Description string        `yaml:"description" json:"description"`
	Pinned      bool          `yaml:"pinned" json:"pinned"`
	Widget      *WidgetConfig `yaml:"widget,omitempty" json:"widget,omitempty"`
}

type ServiceStatus struct {
	IsUp       bool       `json:"is_up"`
	Latency    int        `json:"latency,omitempty"`
	WidgetData WidgetData `json:"widget_data,omitempty"`
}

type SysMetrics struct {
	CPU    int    `json:"cpu"`
	RAM    int    `json:"ram"`
	Uptime string `json:"uptime"`
}

type StreamPayload struct {
	Services map[string]ServiceStatus `json:"services"`
	Widgets  map[string]WidgetData    `json:"widgets,omitempty"`
}

var (
	configCache   atomic.Pointer[Config]
	statusCache   atomic.Pointer[map[string]ServiceStatus]
	widgetsCache  atomic.Pointer[map[string]WidgetData]
	lastModTime   atomic.Int64 // UnixNano
	configPath    = "data/config.yaml"
	statusClients sync.Map // map[chan string]bool

	globalClient = &http.Client{Timeout: 3 * time.Second}
	widgetClient = &http.Client{Timeout: 5 * time.Second}

	//go:embed VERSION
	versionData []byte

	//go:embed static/index.html
	rawIndexHTML []byte

	//go:embed static/style.css
	styleCSS []byte

	//go:embed static/script.js
	scriptJS []byte

	indexHTML []byte

	releasesCache atomic.Pointer[[]byte]
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

func sanitizeID(s string) string {
	s = strings.ToLower(s)
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			sb.WriteRune(r)
		} else if sb.Len() > 0 && sb.String()[sb.Len()-1:] != "-" {
			sb.WriteRune('-')
		}
	}
	res := strings.Trim(sb.String(), "-")
	if res == "" {
		return "widget"
	}
	return res
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
	} else {
		log.Println("[DEPRECATION] 'show_sys_metrics' is deprecated and will be removed in a future release. Please configure a 'sys_metrics' widget under the 'widgets' block instead.")
	}
	if cfg.ShowSysMetrics != nil && *cfg.ShowSysMetrics {
		hasSysWidget := false
		for _, w := range cfg.Widgets {
			if w.Type == "sys_metrics" || w.Type == "system" {
				hasSysWidget = true
				break
			}
		}
		if !hasSysWidget {
			cfg.Widgets = append([]StandaloneWidgetConfig{
				{
					ID:   "w-system",
					Name: "System",
					Type: "sys_metrics",
					Icon: "💻",
				},
			}, cfg.Widgets...)
		}
	}
	for i := range cfg.Services {
		srv := &cfg.Services[i]
		if srv.Widget != nil && srv.Widget.Type != "" {
			log.Printf("[DEPRECATION] Nested widget under service '%s' is deprecated and will be removed in a future release. Synthesising top-level widget automatically.", srv.Name)
			synthesisedID := "w-" + sanitizeID(srv.Name)
			exists := false
			for _, w := range cfg.Widgets {
				if w.ID == synthesisedID || (w.Type == srv.Widget.Type && w.URL == srv.Widget.URL && srv.Widget.URL != "") {
					exists = true
					break
				}
			}
			if !exists {
				cfg.Widgets = append(cfg.Widgets, StandaloneWidgetConfig{
					ID:        synthesisedID,
					Name:      srv.Name,
					Type:      srv.Widget.Type,
					URL:       srv.Widget.URL,
					Icon:      srv.Icon,
					Logo:      srv.Logo,
					LogoDark:  srv.LogoDark,
					LogoLight: srv.LogoLight,
					Auth:      srv.Widget.Auth,
					Settings:  srv.Widget.Settings,
				})
			}
			srv.Widget = nil
		}
	}
	for i := range cfg.Widgets {
		if cfg.Widgets[i].ID == "" {
			if cfg.Widgets[i].Name != "" {
				cfg.Widgets[i].ID = "w-" + sanitizeID(cfg.Widgets[i].Name)
			} else {
				cfg.Widgets[i].ID = fmt.Sprintf("w-%d", i+1)
			}
		}
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

	newWidgetsStatus := make(map[string]WidgetData)
	if len(cfg.Widgets) > 0 {
		var wWg sync.WaitGroup
		var wMu sync.Mutex
		for _, w := range cfg.Widgets {
			if w.Type == "" {
				continue
			}
			if parser, exists := widgetRegistry[w.Type]; exists {
				wWg.Add(1)
				go func(widget StandaloneWidgetConfig) {
					defer wWg.Done()
					sem <- struct{}{}
					defer func() { <-sem }()

					wCfg := &WidgetConfig{
						Type:     widget.Type,
						URL:      widget.URL,
						Auth:     widget.Auth,
						Settings: widget.Settings,
					}
					wCtx, wCancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer wCancel()
					if data, err := parser.Fetch(wCtx, widgetClient, wCfg); err == nil {
						wMu.Lock()
						newWidgetsStatus[widget.ID] = data
						wMu.Unlock()
					} else {
						log.Printf("Standalone widget fetch error for %s (%s): %v", widget.Name, widget.ID, err)
					}
				}(w)
			}
		}
		wWg.Wait()
	}
	widgetsCache.Store(&newWidgetsStatus)
}

var (
	cpuMetricsMutex sync.Mutex
	lastCPUTotal    float64
	lastCPUIdle     float64
	cachedMetrics   *SysMetrics
	lastMetricsTime time.Time
)

func getSysMetrics() *SysMetrics {
	cpuMetricsMutex.Lock()
	defer cpuMetricsMutex.Unlock()

	if cachedMetrics != nil && time.Since(lastMetricsTime) < 30*time.Second {
		return cachedMetrics
	}

	cpuUsage := getCPUUsage()
	ramUsage := getRAMUsage()
	uptimeStr := getUptime()

	cachedMetrics = &SysMetrics{
		CPU:    cpuUsage,
		RAM:    ramUsage,
		Uptime: uptimeStr,
	}
	lastMetricsTime = time.Now()
	return cachedMetrics
}

func getCPUUsage() int {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0
	}

	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 {
		return 0
	}

	fields := strings.Fields(lines[0])
	if len(fields) < 5 || fields[0] != "cpu" {
		return 0
	}

	var user, nice, system, idle, iowait, irq, softirq, steal float64
	fmt.Sscanf(fields[1], "%f", &user)
	fmt.Sscanf(fields[2], "%f", &nice)
	fmt.Sscanf(fields[3], "%f", &system)
	fmt.Sscanf(fields[4], "%f", &idle)
	if len(fields) > 5 {
		fmt.Sscanf(fields[5], "%f", &iowait)
	}
	if len(fields) > 6 {
		fmt.Sscanf(fields[6], "%f", &irq)
	}
	if len(fields) > 7 {
		fmt.Sscanf(fields[7], "%f", &softirq)
	}
	if len(fields) > 8 {
		fmt.Sscanf(fields[8], "%f", &steal)
	}

	total := user + nice + system + idle + iowait + irq + softirq + steal
	idleTotal := idle + iowait

	if lastCPUTotal == 0 {
		lastCPUTotal = total
		lastCPUIdle = idleTotal
		return 0
	}

	totalDiff := total - lastCPUTotal
	idleDiff := idleTotal - lastCPUIdle

	lastCPUTotal = total
	lastCPUIdle = idleTotal

	if totalDiff <= 0 {
		return 0
	}

	cpuPercent := int(((totalDiff - idleDiff) / totalDiff) * 100)
	if cpuPercent < 0 {
		cpuPercent = 0
	}
	if cpuPercent > 100 {
		cpuPercent = 100
	}

	return cpuPercent
}

func getRAMUsage() int {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}

	var memTotal, memAvailable float64
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		if fields[0] == "MemTotal:" {
			fmt.Sscanf(fields[1], "%f", &memTotal)
		} else if fields[0] == "MemAvailable:" {
			fmt.Sscanf(fields[1], "%f", &memAvailable)
		}
	}

	if memTotal == 0 {
		return 0
	}

	memUsed := memTotal - memAvailable
	ramPercent := int((memUsed / memTotal) * 100)
	if ramPercent < 0 {
		ramPercent = 0
	}
	if ramPercent > 100 {
		ramPercent = 100
	}

	return ramPercent
}

func getUptime() string {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return "0m"
	}

	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return "0m"
	}

	var uptimeSec float64
	fmt.Sscanf(fields[0], "%f", &uptimeSec)

	days := int(uptimeSec) / (24 * 3600)
	hours := (int(uptimeSec) % (24 * 3600)) / 3600
	minutes := (int(uptimeSec) % 3600) / 60

	if days > 0 {
		return fmt.Sprintf("%dd %dh", days, hours)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm", hours, minutes)
	}
	return fmt.Sprintf("%dm", minutes)
}

func startHealthChecker() {
	checkHealth()
	ticker := time.NewTicker(60 * time.Second)
	go func() {
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
	payload := StreamPayload{
		Services: *status,
	}
	if wStat := widgetsCache.Load(); wStat != nil && len(*wStat) > 0 {
		payload.Widgets = *wStat
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
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	msgChan := make(chan string, 5)
	statusClients.Store(msgChan, true)

	defer func() {
		statusClients.Delete(msgChan)
		close(msgChan)
	}()

	if status := statusCache.Load(); status != nil {
		payload := StreamPayload{
			Services: *status,
		}
		if wStat := widgetsCache.Load(); wStat != nil && len(*wStat) > 0 {
			payload.Widgets = *wStat
		}
		data, _ := json.Marshal(payload)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	pingTicker := time.NewTicker(15 * time.Second)
	defer pingTicker.Stop()

	for {
		select {
		case msg := <-msgChan:
			fmt.Fprintf(w, "data: %s\n\n", msg)
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

		if !strings.HasPrefix(cleanPath, baseDir+string(filepath.Separator)) && cleanPath != baseDir {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		http.ServeFile(w, r, cleanPath)
		return
	}
	http.NotFound(w, r)
}

func releasesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	if data := releasesCache.Load(); data != nil {
		w.Write(*data)
		return
	}
	w.Write([]byte("[]"))
}

func startReleasesFetcher() {
	fetch := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/repos/BuzzMoody/Simple-Dash/releases", nil)
		if err != nil {
			return
		}

		var token string
		if cfg := configCache.Load(); cfg != nil {
			token = cfg.GithubToken
		}
		if token != "" {
			req.Header.Set("Authorization", "token "+token)
		}

		resp, err := globalClient.Do(req)
		if err != nil {
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode == 200 {
			if body, err := io.ReadAll(resp.Body); err == nil {
				releasesCache.Store(&body)
				os.MkdirAll("data/.cache", 0755)
				os.WriteFile("data/.cache/releases.json", body, 0644)
			}
		}
	}
	go func() {
		if info, err := os.Stat("data/.cache/releases.json"); err == nil {
			if time.Since(info.ModTime()) < 1*time.Hour {
				if body, err := os.ReadFile("data/.cache/releases.json"); err == nil {
					releasesCache.Store(&body)
				}
			}
		}

		if releasesCache.Load() == nil {
			fetch()
		}

		for range time.Tick(1 * time.Hour) {
			fetch()
		}
	}()
}

type noDirFS struct {
	fs http.FileSystem
}

func (n noDirFS) Open(name string) (http.File, error) {
	f, err := n.fs.Open(name)
	if err != nil {
		return nil, err
	}
	stat, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	if stat.IsDir() {
		f.Close()
		return nil, os.ErrNotExist
	}
	return f, nil
}

func main() {
	healthcheck := flag.Bool("healthcheck", false, "Run a healthcheck")
	flag.Parse()

	if *healthcheck {
		resp, err := http.Get("http://127.0.0.1:8888/")
		if err != nil || resp.StatusCode != 200 {
			os.Exit(1)
		}
		os.Exit(0)
	}

	if err := loadInitialConfig(); err != nil {
		log.Fatalf("Fatal: Could not load initial config (ensure config.yaml is mounted in data/): %v", err)
	}

	startConfigWatcher()
	startHealthChecker()
	startReleasesFetcher()

	initStaticFiles()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/config", configHandler)
	mux.HandleFunc("/api/status/stream", statusStreamHandler)
	mux.HandleFunc("/api/releases", releasesHandler)
	mux.HandleFunc("/favicon.ico", faviconHandler)
	mux.Handle("/logos/", http.StripPrefix("/logos/", http.FileServer(noDirFS{http.Dir("./data/logos")})))

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/", "/index.html":
			w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: http: https:; connect-src 'self' https://api.open-meteo.com https://get.geojs.io; frame-ancestors 'none';")
			handleMemFile(indexHTML, "text/html; charset=utf-8")(w, r)
		case "/style.css":
			handleMemFile(styleCSS, "text/css; charset=utf-8")(w, r)
		case "/script.js":
			handleMemFile(scriptJS, "application/javascript; charset=utf-8")(w, r)
		default:
			http.NotFound(w, r)
		}
	})

	port := "8888"
	log.Printf("Server starting on port %s...", port)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           gzipMiddleware(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	log.Println("Shutting down server gracefully...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Graceful shutdown failed: %v", err)
	}
}
