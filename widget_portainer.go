package main

import (
	"context"
	"net/http"
)

type PortainerWidget struct{}

type portainerContainer struct {
	State string `json:"State"`
}

func (w *PortainerWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
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

	return WidgetData{
		"Running": running,
		"Stopped": stopped,
	}, nil
}
