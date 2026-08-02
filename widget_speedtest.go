package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type SpeedtestWidget struct{}

func (w *SpeedtestWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("speedtest widget requires a url")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", cfg.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	if key, ok := cfg.Auth["key"]; ok && key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("speedtest tracker api returned status %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			Ping     float64 `json:"ping"`
			Download float64 `json:"download"`
			Upload   float64 `json:"upload"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return WidgetData{
		"Ping":     fmt.Sprintf("%.0f ms", result.Data.Ping),
		"Download": fmt.Sprintf("%.0f Mbps", result.Data.Download),
		"Upload":   fmt.Sprintf("%.0f Mbps", result.Data.Upload),
	}, nil
}
