package main

import (
	"context"
	"fmt"
	"net/http"
)

type HomeAssistantWidget struct{}

func (w *HomeAssistantWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
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

	return WidgetData{
		"State": fmt.Sprintf("%s%s", state.State, unit),
	}, nil
}
