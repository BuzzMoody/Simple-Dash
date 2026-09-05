package main

import (
	"context"
	"fmt"
	"net/http"
)

type SpeedtestWidget struct{}

func (w *SpeedtestWidget) Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error) {
	headers := map[string]string{
		"Accept": "application/json",
	}
	if key, ok := cfg.Auth["key"]; ok && key != "" {
		headers["Authorization"] = "Bearer " + key
	}

	var result struct {
		Data struct {
			Ping     float64 `json:"ping"`
			Download float64 `json:"download"`
			Upload   float64 `json:"upload"`
		} `json:"data"`
	}

	if err := widgetFetch(ctx, client, "GET", cfg.URL, headers, &result); err != nil {
		return nil, err
	}

	return []WidgetMetric{
		{
			Key:       "ping",
			Label:     "Ping",
			Value:     result.Data.Ping,
			Formatted: fmt.Sprintf("%.0f ms", result.Data.Ping),
			Unit:      "ms",
			Icon:      "activity",
			Threshold: &MetricThreshold{Warning: 50, Danger: 100},
		},
		{
			Key:       "download",
			Label:     "Down",
			Value:     result.Data.Download,
			Formatted: fmt.Sprintf("%.0f Mbps", result.Data.Download),
			Unit:      "Mbps",
			Icon:      "download",
		},
		{
			Key:       "upload",
			Label:     "Up",
			Value:     result.Data.Upload,
			Formatted: fmt.Sprintf("%.0f Mbps", result.Data.Upload),
			Unit:      "Mbps",
			Icon:      "upload",
		},
	}, nil
}
