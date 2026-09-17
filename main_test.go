package main

import (
	"context"
	"net/http"
	"sync"
	"testing"
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
