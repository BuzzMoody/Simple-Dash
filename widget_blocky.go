package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"
)

type BlockyWidget struct{}

func (w *BlockyWidget) Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error) {
	targetURL := cfg.URL
	if !strings.HasSuffix(targetURL, "/api/stats") {
		targetURL = strings.TrimRight(targetURL, "/") + "/api/stats"
	}

	var data struct {
		Summary struct {
			Queries int `json:"queries"`
			Blocked int `json:"blocked"`
		} `json:"summary"`
	}

	if err := widgetFetch(ctx, client, "GET", targetURL, nil, &data); err != nil {
		return nil, err
	}

	percentage := 0.0
	if data.Summary.Queries > 0 {
		percentage = (float64(data.Summary.Blocked) / float64(data.Summary.Queries)) * 100
	}

	return []WidgetMetric{
		{
			Key:       "queries",
			Label:     "Queries",
			Value:     data.Summary.Queries,
			Formatted: fmt.Sprintf("%d", data.Summary.Queries),
			Icon:      "help-circle",
		},
		{
			Key:       "blocked",
			Label:     "Blocked",
			Value:     data.Summary.Blocked,
			Formatted: fmt.Sprintf("%d", data.Summary.Blocked),
			Icon:      "shield",
		},
		{
			Key:       "percent",
			Label:     "Rate",
			Value:     percentage,
			Formatted: fmt.Sprintf("%.1f%%", percentage),
			Unit:      "%",
			Icon:      "percent",
		},
	}, nil
}
