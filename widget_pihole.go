package main

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

type piholeAPIResponse struct {
	AdsBlockedToday int     `json:"ads_blocked_today"`
	AdsPercentage   float64 `json:"ads_percentage_today"`
	UniqueClients   int     `json:"unique_clients_ever_seen"`
}

type PiholeWidget struct{}

func (p *PiholeWidget) Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("pihole widget requires a url")
	}

	u, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, err
	}

	q := u.Query()
	if !q.Has("summaryRaw") && !q.Has("summary") {
		q.Add("summaryRaw", "")
	}
	if key, ok := cfg.Auth["key"]; ok && key != "" {
		q.Add("auth", key)
	}
	u.RawQuery = q.Encode()

	var data piholeAPIResponse
	if err := widgetFetch(ctx, client, "GET", u.String(), nil, &data); err != nil {
		return nil, err
	}

	return []WidgetMetric{
		{
			Key:       "blocked",
			Label:     "Blocked",
			Value:     data.AdsBlockedToday,
			Formatted: fmt.Sprintf("%d", data.AdsBlockedToday),
			Icon:      "shield",
		},
		{
			Key:       "percentage",
			Label:     "Percentage",
			Value:     data.AdsPercentage,
			Formatted: fmt.Sprintf("%.1f%%", data.AdsPercentage),
			Unit:      "%",
			Icon:      "percent",
		},
		{
			Key:       "clients",
			Label:     "Clients",
			Value:     data.UniqueClients,
			Formatted: fmt.Sprintf("%d", data.UniqueClients),
			Icon:      "users",
		},
	}, nil
}
