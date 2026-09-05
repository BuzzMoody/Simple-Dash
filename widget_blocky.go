package main

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

type BlockyWidget struct{}

func (w *BlockyWidget) Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error) {
	var body string
	if err := widgetFetch(ctx, client, "GET", cfg.URL, nil, &body); err != nil {
		return nil, err
	}

	scanner := bufio.NewScanner(strings.NewReader(body))
	totalQueries := 0.0
	blockedQueries := 0.0

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "blocky_query_total") {
			parts := strings.Fields(line)
			if len(parts) == 2 {
				if val, err := strconv.ParseFloat(parts[1], 64); err == nil {
					totalQueries += val
				}
			}
		} else if strings.HasPrefix(line, "blocky_query_blocked_total") {
			parts := strings.Fields(line)
			if len(parts) == 2 {
				if val, err := strconv.ParseFloat(parts[1], 64); err == nil {
					blockedQueries += val
				}
			}
		}
	}

	percentage := 0.0
	if totalQueries > 0 {
		percentage = (blockedQueries / totalQueries) * 100
	}

	return []WidgetMetric{
		{
			Key:       "queries",
			Label:     "Queries",
			Value:     int(totalQueries),
			Formatted: fmt.Sprintf("%d", int(totalQueries)),
			Icon:      "help-circle",
		},
		{
			Key:       "blocked",
			Label:     "Blocked",
			Value:     int(blockedQueries),
			Formatted: fmt.Sprintf("%d", int(blockedQueries)),
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
