package main

import (
	"context"
	"fmt"
	"net/http"
)

type JellyfinWidget struct{}

func (w *JellyfinWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	headers := make(map[string]string)
	if key, ok := cfg.Auth["key"]; ok && key != "" {
		headers["X-MediaBrowser-Token"] = key
	}

	var sessions []map[string]interface{}
	err := widgetFetch(ctx, client, "GET", cfg.URL, headers, &sessions)
	if err != nil {
		if err.Error() == "widget requires a url" {
			return nil, fmt.Errorf("jellyfin widget requires a url")
		}
		if err.Error() == "api returned status 400" || err.Error()[:19] == "api returned status" {
			return nil, fmt.Errorf("jellyfin %v", err)
		}
		return nil, err
	}

	activeStreams := 0
	for _, s := range sessions {
		if _, ok := s["NowPlayingItem"]; ok && s["NowPlayingItem"] != nil {
			activeStreams++
		}
	}

	return WidgetData{
		"Active Streams": activeStreams,
	}, nil
}
