package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type ProxmoxWidget struct{}

func (w *ProxmoxWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("proxmox widget requires a url")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", cfg.URL, nil)
	if err != nil {
		return nil, err
	}

	if key, ok := cfg.Auth["key"]; ok && key != "" {
		req.Header.Set("Authorization", "PVEAPIToken="+key)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("proxmox api returned status %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			CPU    float64 `json:"cpu"`
			MaxCPU float64 `json:"maxcpu"`
			Mem    float64 `json:"mem"`
			MaxMem float64 `json:"maxmem"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	cpuPercent := 0.0
	if result.Data.MaxCPU > 0 {
		cpuPercent = result.Data.CPU * 100
	}
	
	ramPercent := 0.0
	if result.Data.MaxMem > 0 {
		ramPercent = (result.Data.Mem / result.Data.MaxMem) * 100
	}

	return WidgetData{
		"CPU": fmt.Sprintf("%.1f%%", cpuPercent),
		"RAM": fmt.Sprintf("%.1f%%", ramPercent),
	}, nil
}
