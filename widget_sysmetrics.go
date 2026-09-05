package main

import (
	"context"
	"fmt"
	"net/http"
)

type SysMetricsWidget struct{}

func (w *SysMetricsWidget) Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error) {
	metrics := getSysMetrics()
	if metrics == nil {
		return nil, fmt.Errorf("failed to read system metrics")
	}

	return []WidgetMetric{
		{
			Key:       "cpu",
			Label:     "CPU",
			Value:     metrics.CPU,
			Formatted: fmt.Sprintf("%d%%", metrics.CPU),
			Unit:      "%",
			Icon:      "cpu",
			Threshold: &MetricThreshold{Warning: 75, Danger: 90},
		},
		{
			Key:       "ram",
			Label:     "RAM",
			Value:     metrics.RAM,
			Formatted: fmt.Sprintf("%d%%", metrics.RAM),
			Unit:      "%",
			Icon:      "ram",
			Threshold: &MetricThreshold{Warning: 80, Danger: 95},
		},
		{
			Key:       "uptime",
			Label:     "Uptime",
			Value:     metrics.Uptime,
			Formatted: metrics.Uptime,
			Icon:      "clock",
		},
	}, nil
}
