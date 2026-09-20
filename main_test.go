package main

import (
	"context"
	"net/http"
	"sync"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestGetSysMetricsRace(t *testing.T) {
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				_ = getSysMetrics()
			}
		}()
	}
	wg.Wait()
}

func TestApplyDefaults(t *testing.T) {
	cfg := &Config{
		Widgets: []StandaloneWidgetConfig{
			{
				Name: "Test Widget",
				Type: "sys_metrics",
			},
			{
				Type: "pihole",
			},
		},
	}
	applyDefaults(cfg)

	if cfg.Header != "Simple Dash" {
		t.Errorf("Expected default header 'Simple Dash', got '%s'", cfg.Header)
	}
	if cfg.Description != "A simple homelab dashboard" {
		t.Errorf("Expected default description, got '%s'", cfg.Description)
	}
	if cfg.NewTabs == nil || *cfg.NewTabs != true {
		t.Errorf("Expected NewTabs to be true")
	}
	if len(cfg.Widgets) != 2 {
		t.Fatalf("Expected 2 widgets, got %d", len(cfg.Widgets))
	}
	if cfg.Widgets[0].ID != "w-test-widget" {
		t.Errorf("Expected widget ID 'w-test-widget', got '%s'", cfg.Widgets[0].ID)
	}
	if cfg.Widgets[1].ID != "w-pihole" {
		t.Errorf("Expected widget ID 'w-pihole', got '%s'", cfg.Widgets[1].ID)
	}
}

func TestSysMetricsWidgetSelfDescribing(t *testing.T) {
	w := &SysMetricsWidget{}
	metrics, err := w.Fetch(context.Background(), globalClient, &StandaloneWidgetConfig{Type: "sys_metrics"})
	if err != nil {
		t.Fatalf("SysMetricsWidget.Fetch failed: %v", err)
	}

	if len(metrics) != 3 {
		t.Fatalf("Expected 3 metrics, got %d", len(metrics))
	}

	keys := map[string]bool{}
	for _, m := range metrics {
		keys[m.Key] = true
		if m.Label == "" {
			t.Errorf("Metric %s has empty label", m.Key)
		}
		if m.Formatted == "" {
			t.Errorf("Metric %s has empty formatted value", m.Key)
		}
		if m.Icon == "" {
			t.Errorf("Metric %s has empty icon", m.Key)
		}
	}

	if !keys["cpu"] || !keys["ram"] || !keys["uptime"] {
		t.Errorf("Missing expected metric keys in SysMetrics: %+v", keys)
	}
}

func TestClientHubConcurrency(t *testing.T) {
	hub := newClientHub()
	var wg sync.WaitGroup

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ch := make(chan SSEMessage, 5)
			hub.Register(ch)
			hub.BroadcastEvent("ping", "hello")
			hub.Unregister(ch)
			close(ch)
		}()
	}

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			hub.BroadcastEvent("services", `{"test": true}`)
		}()
	}

	wg.Wait()
}

func TestCheckRedirectResilience(t *testing.T) {
	// 1. Simulate an HTTPS request redirecting to an HTTP destination (scheme downgrade)
	reqHTTPS, _ := http.NewRequest("GET", "https://example.com/app", nil)
	reqHTTPTarget, _ := http.NewRequest("GET", "http://example.com/login", nil)
	viaHTTPS := []*http.Request{reqHTTPS}

	err := globalClient.CheckRedirect(reqHTTPTarget, viaHTTPS)
	if err != http.ErrUseLastResponse {
		t.Fatalf("Expected http.ErrUseLastResponse on HTTPS to HTTP scheme downgrade, got %v", err)
	}

	// 2. Simulate standard safe redirect (e.g. HTTPS to HTTPS)
	reqHTTPSSafe, _ := http.NewRequest("GET", "https://example.com/login", nil)
	err = globalClient.CheckRedirect(reqHTTPSSafe, viaHTTPS)
	if err != nil {
		t.Fatalf("Expected nil error on safe HTTPS to HTTPS redirect, got %v", err)
	}

	// 3. Simulate excessive redirect protection (>= 10 hops)
	via10 := make([]*http.Request, 10)
	for i := range via10 {
		via10[i] = reqHTTPSSafe
	}
	err = globalClient.CheckRedirect(reqHTTPSSafe, via10)
	if err != http.ErrUseLastResponse {
		t.Fatalf("Expected http.ErrUseLastResponse on >=10 hops, got %v", err)
	}
}

func TestWidgetLabelConfig(t *testing.T) {
	yamlData := `
widgets:
  - name: "qBittorrent"
    type: "qbittorrent"
    labels:
      download: "Download"
      upload: null
      torrents:
        title: null
        colour: "primary"
      ratio:
        color: "secondary"
      speed:
        colour: "green"
      errors:
        colour: "red"
      latency:
        colour:
          default: "primary"
          warning: 50
          danger: 150
      ping:
        colour:
          default: "primary"
          50: "yellow"
          150: "secondary"
          300: "red"
      custom_steps:
        steps:
          - value: 10
            color: "secondary"
          - value: 50
            colour: "red"
  - name: "Aliased Metrics"
    type: "pihole"
    metrics:
      queries: "DNS Queries"
      blocked: null
`

	var cfg struct {
		Widgets []StandaloneWidgetConfig `yaml:"widgets"`
	}

	if err := yaml.Unmarshal([]byte(yamlData), &cfg); err != nil {
		t.Fatalf("Failed to unmarshal widget labels YAML: %v", err)
	}

	if len(cfg.Widgets) != 2 {
		t.Fatalf("Expected 2 widgets, got %d", len(cfg.Widgets))
	}

	w1 := cfg.Widgets[0]
	// Test shorthand string title override
	if w1.Labels["download"].Title == nil || *w1.Labels["download"].Title != "Download" {
		t.Errorf("Expected download title 'Download', got %+v", w1.Labels["download"].Title)
	}

	// Test shorthand null (icon-only)
	if w1.Labels["upload"].Title == nil || *w1.Labels["upload"].Title != "" {
		t.Errorf("Expected upload title to be empty string for icon-only, got %+v", w1.Labels["upload"].Title)
	}

	// Test mapping title null & colour primary
	if w1.Labels["torrents"].Title == nil || *w1.Labels["torrents"].Title != "" {
		t.Errorf("Expected torrents title to be empty string for icon-only, got %+v", w1.Labels["torrents"].Title)
	}
	if w1.Labels["torrents"].Colour != "primary" {
		t.Errorf("Expected torrents colour 'primary', got '%s'", w1.Labels["torrents"].Colour)
	}

	// Test mapping color secondary
	if w1.Labels["ratio"].Colour != "secondary" {
		t.Errorf("Expected ratio colour 'secondary', got '%s'", w1.Labels["ratio"].Colour)
	}

	// Test mapping colour green
	if w1.Labels["speed"].Colour != "green" {
		t.Errorf("Expected speed colour 'green', got '%s'", w1.Labels["speed"].Colour)
	}

	// Test mapping colour red
	if w1.Labels["errors"].Colour != "red" {
		t.Errorf("Expected errors colour 'red', got '%s'", w1.Labels["errors"].Colour)
	}

	// Test stepped thresholds (warning / danger)
	lat := w1.Labels["latency"]
	if lat.Default != "primary" {
		t.Errorf("Expected latency default 'primary', got '%s'", lat.Default)
	}
	if lat.Warning == nil || *lat.Warning != 50 {
		t.Errorf("Expected latency warning 50, got %+v", lat.Warning)
	}
	if lat.Danger == nil || *lat.Danger != 150 {
		t.Errorf("Expected latency danger 150, got %+v", lat.Danger)
	}

	// Test numeric map steps
	png := w1.Labels["ping"]
	if png.Default != "primary" {
		t.Errorf("Expected ping default 'primary', got '%s'", png.Default)
	}
	if len(png.Steps) != 3 {
		t.Fatalf("Expected 3 ping steps, got %d", len(png.Steps))
	}
	if png.Steps[0].Value != 50 || png.Steps[0].Colour != "yellow" {
		t.Errorf("Expected ping step 0 to be 50:yellow, got %+v", png.Steps[0])
	}
	if png.Steps[1].Value != 150 || png.Steps[1].Colour != "secondary" {
		t.Errorf("Expected ping step 1 to be 150:secondary, got %+v", png.Steps[1])
	}
	if png.Steps[2].Value != 300 || png.Steps[2].Colour != "red" {
		t.Errorf("Expected ping step 2 to be 300:red, got %+v", png.Steps[2])
	}

	// Test custom steps list
	cs := w1.Labels["custom_steps"]
	if len(cs.Steps) != 2 {
		t.Fatalf("Expected 2 custom steps, got %d", len(cs.Steps))
	}
	if cs.Steps[0].Value != 10 || cs.Steps[0].Colour != "secondary" {
		t.Errorf("Expected custom step 0 to be 10:secondary, got %+v", cs.Steps[0])
	}
	if cs.Steps[1].Value != 50 || cs.Steps[1].Colour != "red" {
		t.Errorf("Expected custom step 1 to be 50:red, got %+v", cs.Steps[1])
	}

	// Test metrics alias
	w2 := cfg.Widgets[1]
	if w2.Labels["queries"].Title == nil || *w2.Labels["queries"].Title != "DNS Queries" {
		t.Errorf("Expected queries title 'DNS Queries', got %+v", w2.Labels["queries"].Title)
	}
	if w2.Labels["blocked"].Title == nil || *w2.Labels["blocked"].Title != "" {
		t.Errorf("Expected blocked title empty string, got %+v", w2.Labels["blocked"].Title)
	}
}

func TestPollWidgetsLabelOverride(t *testing.T) {
	customTitle := "Processor"
	emptyTitle := ""
	cfg := &Config{
		Widgets: []StandaloneWidgetConfig{
			{
				ID:   "w-sys",
				Name: "System",
				Type: "sys_metrics",
				Labels: map[string]WidgetLabelConfig{
					"cpu": {
						Title: &customTitle,
					},
					"ram": {
						Title: &emptyTitle,
					},
				},
			},
		},
	}

	configCache.Store(cfg)
	pollWidgets()

	wStat := widgetsCache.Load()
	if wStat == nil {
		t.Fatalf("widgetsCache is nil after pollWidgets")
	}

	result, ok := (*wStat)["w-sys"]
	if !ok {
		t.Fatalf("Widget w-sys not found in cache")
	}

	for _, m := range result.Metrics {
		if m.Key == "cpu" && m.Label != "Processor" {
			t.Errorf("Expected cpu label to be 'Processor', got '%s'", m.Label)
		}
		if m.Key == "ram" && m.Label != "" {
			t.Errorf("Expected ram label to be empty (icon-only), got '%s'", m.Label)
		}
		if m.Key == "uptime" && m.Label != "Uptime" {
			t.Errorf("Expected uptime label to be default 'Uptime', got '%s'", m.Label)
		}
	}
}
