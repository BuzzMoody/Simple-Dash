package main

import (
	"context"
	"fmt"
	"net/http"
)

type QbittorrentWidget struct{}

func (w *QbittorrentWidget) Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error) {
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

	dlMB := float64(data.ServerState.DlInfoSpeed) / 1024 / 1024
	upMB := float64(data.ServerState.UpInfoSpeed) / 1024 / 1024

	return []WidgetMetric{
		{
			Key:       "download",
			Label:     "Down",
			Value:     dlMB,
			Formatted: formatSpeed(data.ServerState.DlInfoSpeed),
			Icon:      "download",
		},
		{
			Key:       "upload",
			Label:     "Up",
			Value:     upMB,
			Formatted: formatSpeed(data.ServerState.UpInfoSpeed),
			Icon:      "upload",
		},
		{
			Key:       "torrents",
			Label:     "Torrents",
			Value:     len(data.Torrents),
			Formatted: fmt.Sprintf("%d", len(data.Torrents)),
			Icon:      "file-text",
		},
	}, nil
}
