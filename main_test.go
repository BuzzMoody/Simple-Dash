package main

import (
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
	cfg := &Config{}
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
	if cfg.ShowSysMetrics == nil || *cfg.ShowSysMetrics != true {
		t.Errorf("Expected ShowSysMetrics to be true")
	}
	if len(cfg.Widgets) != 1 || cfg.Widgets[0].ID != "w-system" {
		t.Errorf("Expected default w-system widget to be synthesised, got %+v", cfg.Widgets)
	}
}

func TestLegacyNestedWidgetNormalisation(t *testing.T) {
	showSys := false
	cfg := &Config{
		ShowSysMetrics: &showSys,
		Services: []Service{
			{
				Name: "Pi-Hole",
				URL:  "http://192.168.1.10/admin",
				Logo: "pi-hole.svg",
				Widget: &WidgetConfig{
					Type: "pihole",
					URL:  "http://192.168.1.10/admin/api.php",
					Auth: map[string]string{"key": "secret123"},
				},
			},
		},
	}

	applyDefaults(cfg)

	if cfg.Services[0].Widget != nil {
		t.Errorf("Expected service.Widget to be cleared after normalisation, got %+v", cfg.Services[0].Widget)
	}

	if len(cfg.Widgets) != 1 {
		t.Fatalf("Expected 1 synthesised widget, got %d", len(cfg.Widgets))
	}

	w := cfg.Widgets[0]
	if w.ID != "w-pi-hole" {
		t.Errorf("Expected widget ID 'w-pi-hole', got '%s'", w.ID)
	}
	if w.Type != "pihole" {
		t.Errorf("Expected widget type 'pihole', got '%s'", w.Type)
	}
	if w.URL != "http://192.168.1.10/admin/api.php" {
		t.Errorf("Expected widget URL 'http://192.168.1.10/admin/api.php', got '%s'", w.URL)
	}
	if w.Logo != "pi-hole.svg" {
		t.Errorf("Expected widget Logo 'pi-hole.svg', got '%s'", w.Logo)
	}
	if w.Auth["key"] != "secret123" {
		t.Errorf("Expected widget Auth key 'secret123', got '%s'", w.Auth["key"])
	}
}

func TestClientHubConcurrency(t *testing.T) {
	hub := newClientHub()
	var wg sync.WaitGroup

	// Concurrently register, broadcast, and unregister
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ch := make(chan string, 5)
			hub.Register(ch)
			hub.Broadcast("ping")
			hub.Unregister(ch)
			close(ch)
		}()
	}

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			hub.Broadcast("status-update")
		}()
	}

	wg.Wait()
}
