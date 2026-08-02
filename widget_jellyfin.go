package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type JellyfinWidget struct{}

func (w *JellyfinWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("jellyfin widget requires a url")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", cfg.URL, nil)
	if err != nil {
		return nil, err
	}

	if key, ok := cfg.Auth["key"]; ok && key != "" {
		req.Header.Set("X-MediaBrowser-Token", key)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("jellyfin api returned status %d", resp.StatusCode)
	}

	var sessions []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&sessions); err != nil {
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
