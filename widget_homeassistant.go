package main

import (
	"context"
	"fmt"
	"net/http"
)

type HomeAssistantWidget struct{}

func (w *HomeAssistantWidget) Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error) {
	headers := map[string]string{
		"Content-Type": "application/json",
	}
	if key, ok := cfg.Auth["key"]; ok && key != "" {
		headers["Authorization"] = "Bearer " + key
	}

	var state struct {
		State      string                 `json:"state"`
		Attributes map[string]interface{} `json:"attributes"`
	}

	if err := widgetFetch(ctx, client, "GET", cfg.URL, headers, &state); err != nil {
		return nil, err
	}

	unit := ""
	if state.Attributes != nil {
		if u, ok := state.Attributes["unit_of_measurement"]; ok {
			unit = fmt.Sprintf(" %v", u)
		}
	}

	return []WidgetMetric{
		{
			Key:       "state",
			Label:     "State",
			Value:     state.State,
			Formatted: fmt.Sprintf("%s%s", state.State, unit),
			Icon:      "layers",
		},
	}, nil
}
