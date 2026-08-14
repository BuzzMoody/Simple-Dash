package main

import (
	"context"
	"fmt"
	"net/http"
)

type QbittorrentWidget struct{}

func (w *QbittorrentWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	var data struct {
		ServerState struct {
			DlInfoSpeed int `json:"dl_info_speed"`
			UpInfoSpeed int `json:"up_info_speed"`
		} `json:"server_state"`
		Torrents map[string]interface{} `json:"torrents"`
	}

	if err := widgetFetch(ctx, client, "GET", cfg.URL, nil, &data); err != nil {
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
		"Down":   formatSpeed(data.ServerState.DlInfoSpeed),
		"Up":     formatSpeed(data.ServerState.UpInfoSpeed),
		"Active": fmt.Sprintf("%d", len(data.Torrents)),
	}, nil
}
