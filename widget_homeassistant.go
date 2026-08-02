package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type HomeAssistantWidget struct{}

func (w *HomeAssistantWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("homeassistant widget requires a url")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", cfg.URL, nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Content-Type", "application/json")

	if key, ok := cfg.Auth["key"]; ok && key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("homeassistant api returned status %d", resp.StatusCode)
	}

	var state struct {
		State      string                 `json:"state"`
		Attributes map[string]interface{} `json:"attributes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&state); err != nil {
		return nil, err
	}

	unit := ""
	if state.Attributes != nil {
		if u, ok := state.Attributes["unit_of_measurement"]; ok {
			unit = fmt.Sprintf(" %v", u)
		}
	}

	return WidgetData{
		"State": fmt.Sprintf("%s%s", state.State, unit),
	}, nil
}
