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
}
