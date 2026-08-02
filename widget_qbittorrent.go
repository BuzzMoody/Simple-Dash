package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type QbittorrentWidget struct{}

func (w *QbittorrentWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("qbittorrent widget requires a url")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", cfg.URL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("qbittorrent api returned status %d", resp.StatusCode)
	}

	var data struct {
		DlInfoSpeed int `json:"dl_info_speed"`
		UpInfoSpeed int `json:"up_info_speed"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	formatSpeed := func(bytesPerSec int) string {
		mb := float64(bytesPerSec) / 1024 / 1024
		if mb >= 1 {
			return fmt.Sprintf("%.1f MB/s", mb)
		}
		kb := float64(bytesPerSec) / 1024
		return fmt.Sprintf("%.1f KB/s", kb)
	}

	return WidgetData{
		"Download": formatSpeed(data.DlInfoSpeed),
		"Upload":   formatSpeed(data.UpInfoSpeed),
	}, nil
}
