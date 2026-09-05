package main

import (
	"context"
	"fmt"
	"net/http"
)

type ProxmoxWidget struct{}

func (w *ProxmoxWidget) Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error) {
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

	return []WidgetMetric{
		{
			Key:       "cpu",
			Label:     "CPU",
			Value:     cpuPercent,
			Formatted: fmt.Sprintf("%.1f%%", cpuPercent),
			Unit:      "%",
			Icon:      "cpu",
			Threshold: &MetricThreshold{Warning: 75, Danger: 90},
		},
		{
			Key:       "ram",
			Label:     "RAM",
			Value:     ramPercent,
			Formatted: fmt.Sprintf("%.1f%%", ramPercent),
			Unit:      "%",
			Icon:      "ram",
			Threshold: &MetricThreshold{Warning: 80, Danger: 95},
		},
	}, nil
}
