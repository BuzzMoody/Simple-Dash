package main

import (
	"context"
	"fmt"
	"net/http"
)

type ProxmoxWidget struct{}

func (w *ProxmoxWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	headers := make(map[string]string)
	if key, ok := cfg.Auth["key"]; ok && key != "" {
		headers["Authorization"] = "PVEAPIToken=" + key
	}

	var result struct {
		Data struct {
			CPU    float64 `json:"cpu"`
			MaxCPU float64 `json:"maxcpu"`
			Mem    float64 `json:"mem"`
			MaxMem float64 `json:"maxmem"`
		} `json:"data"`
	}

	if err := widgetFetch(ctx, client, "GET", cfg.URL, headers, &result); err != nil {
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
