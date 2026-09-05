package main

import (
	"context"
	"fmt"
	"net/http"
)

type PortainerWidget struct{}

type portainerContainer struct {
	State string `json:"State"`
}

func (w *PortainerWidget) Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error) {
	headers := make(map[string]string)
	if key, ok := cfg.Auth["key"]; ok && key != "" {
		headers["X-API-Key"] = key
	}

	var containers []portainerContainer
	if err := widgetFetch(ctx, client, "GET", cfg.URL, headers, &containers); err != nil {
		return nil, err
	}

	running := 0
	stopped := 0

	for _, c := range containers {
		if c.State == "running" {
			running++
		} else {
			stopped++
		}
	}

	return []WidgetMetric{
		{
			Key:       "running",
			Label:     "Running",
			Value:     running,
			Formatted: fmt.Sprintf("%d", running),
			Icon:      "activity",
		},
		{
			Key:       "stopped",
			Label:     "Stopped",
			Value:     stopped,
			Formatted: fmt.Sprintf("%d", stopped),
			Icon:      "pause-circle",
			Threshold: &MetricThreshold{Warning: 1, Danger: 5},
		},
	}, nil
}
