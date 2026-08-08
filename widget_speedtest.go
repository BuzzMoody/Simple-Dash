package main

import (
	"context"
	"fmt"
	"net/http"
)

type SpeedtestWidget struct{}

func (w *SpeedtestWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
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

	return WidgetData{
		"Ping":     fmt.Sprintf("%.0f ms", result.Data.Ping),
		"Download": fmt.Sprintf("%.0f Mbps", result.Data.Download),
		"Upload":   fmt.Sprintf("%.0f Mbps", result.Data.Upload),
	}, nil
}
