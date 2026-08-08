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

func (w *BlockyWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
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

	return WidgetData{
		"Queries": int(totalQueries),
		"Blocked": int(blockedQueries),
		"Percent": fmt.Sprintf("%.1f%%", percentage),
	}, nil
}
