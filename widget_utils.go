package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// MetricThreshold defines thresholds for colour transitions.
type MetricThreshold struct {
	Warning  float64 `json:"warning,omitempty"`
	Danger   float64 `json:"danger,omitempty"`
	Inverted bool    `json:"inverted,omitempty"` // true if lower numbers are worse (e.g. download speed)
}

// WidgetMetric represents a self-describing metric returned by a widget parser.
type WidgetMetric struct {
	Key       string           `json:"key"`
	Label     string           `json:"label"`
	Value     interface{}      `json:"value"`
	Formatted string           `json:"formatted"`
	Unit      string           `json:"unit,omitempty"`
	Icon      string           `json:"icon,omitempty"`
	Threshold *MetricThreshold `json:"threshold,omitempty"`
}

// WidgetResult contains the ordered metrics for a widget.
type WidgetResult struct {
	Metrics []WidgetMetric `json:"metrics"`
}

// WidgetParser is the interface implemented by all service widgets.
type WidgetParser interface {
	Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error)
}

var widgetRegistry = map[string]WidgetParser{
	"pihole":        &PiholeWidget{},
	"proxmox":       &ProxmoxWidget{},
	"portainer":     &PortainerWidget{},
	"qbittorrent":   &QbittorrentWidget{},
	"jellyfin":      &JellyfinWidget{},
	"speedtest":     &SpeedtestWidget{},
	"homeassistant": &HomeAssistantWidget{},
	"blocky":        &BlockyWidget{},
	"sys_metrics":   &SysMetricsWidget{},
	"system":        &SysMetricsWidget{},
}

func widgetFetch(ctx context.Context, client *http.Client, method, url string, headers map[string]string, out interface{}) error {
	if url == "" {
		return fmt.Errorf("widget requires a url")
	}

	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("api returned status %d", resp.StatusCode)
	}

	if out != nil {
		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}

		if outStr, ok := out.(*string); ok {
			*outStr = string(bodyBytes)
			return nil
		}
		if outBytes, ok := out.(*[]byte); ok {
			*outBytes = bodyBytes
			return nil
		}

		if err := json.Unmarshal(bodyBytes, out); err != nil {
			return err
		}
	}

	return nil
}
