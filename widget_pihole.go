package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type piholeAPIResponse struct {
	AdsBlockedToday int     `json:"ads_blocked_today"`
	AdsPercentage   float64 `json:"ads_percentage_today"`
	UniqueClients   int     `json:"unique_clients_ever_seen"`
}

type PiholeWidget struct{}

func (p *PiholeWidget) Fetch(ctx context.Context, client *http.Client, cfg *WidgetConfig) (WidgetData, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("pihole widget requires a url")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", cfg.URL, nil)
	if err != nil {
		return nil, err
	}

	q := req.URL.Query()
	if !q.Has("summaryRaw") && !q.Has("summary") {
		q.Add("summaryRaw", "")
	}
	if key, ok := cfg.Auth["key"]; ok && key != "" {
		q.Add("auth", key)
	}
	req.URL.RawQuery = q.Encode()

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("pihole api returned status %d", resp.StatusCode)
	}

	var data piholeAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	return WidgetData{
		"blocked":    data.AdsBlockedToday,
		"percentage": data.AdsPercentage,
		"clients":    data.UniqueClients,
	}, nil
}
