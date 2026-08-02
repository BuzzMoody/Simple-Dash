package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type PortainerWidget struct{}

type portainerContainer struct {
	State string `json:"State"`
}

func (w *PortainerWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("portainer widget requires a url")
	}

	url := cfg.URL
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	if key, ok := cfg.Auth["key"]; ok && key != "" {
		req.Header.Set("X-API-Key", key)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("portainer api returned status %d", resp.StatusCode)
	}

	var containers []portainerContainer
	if err := json.NewDecoder(resp.Body).Decode(&containers); err != nil {
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
