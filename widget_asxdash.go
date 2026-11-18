package main

import (
	"context"
	"net/http"
	"net/url"
)

// asxdashSummaryPath is the ASXDash endpoint added to a bare base URL such as http://192.168.1.20:8085.
const asxdashSummaryPath = "/api/widget/summary"

// AsxdashWidget shows an ASXDash portfolio's value and today's change in dollars and percent.
type AsxdashWidget struct{}

// asxdashFigure is one figure as ASXDash formats it: display text plus a gain, loss or neutral trend.
type asxdashFigure struct {
	Text  string `json:"text"`
	Trend string `json:"trend"`
}

func (w *AsxdashWidget) Fetch(ctx context.Context, client *http.Client, cfg *StandaloneWidgetConfig) ([]WidgetMetric, error) {
	targetURL := cfg.URL
	if u, err := url.Parse(targetURL); err == nil && (u.Path == "" || u.Path == "/") {
		u.Path = asxdashSummaryPath
		targetURL = u.String()
	}

	// Amounts arrive as decimal strings and ASXDash formats them itself (truncated, never rounded), so the widget shows
	// the display text as it is and does no currency maths.
	var data struct {
		TotalValue     string `json:"total_value"`
		DayChange      string `json:"day_change"`
		DayChangeRatio string `json:"day_change_ratio"`
		Display        struct {
			TotalValue       asxdashFigure `json:"total_value"`
			DayChange        asxdashFigure `json:"day_change"`
			DayChangePercent asxdashFigure `json:"day_change_percent"`
		} `json:"display"`
	}

	headers := map[string]string{"Accept": "application/json"}
	if err := widgetFetch(ctx, client, "GET", targetURL, headers, &data); err != nil {
		return nil, err
	}

	return []WidgetMetric{
		{
			Key:       "value",
			Label:     "Value",
			Value:     data.TotalValue,
			Formatted: data.Display.TotalValue.Text,
			Icon:      "wallet",
		},
		{
			Key:       "change",
			Label:     "Today",
			Value:     data.DayChange,
			Formatted: data.Display.DayChange.Text,
			Icon:      "trending",
			Colour:    asxdashTrendColour(data.Display.DayChange.Trend),
		},
		{
			Key:       "change_percent",
			Label:     "Today %",
			Value:     data.DayChangeRatio,
			Formatted: data.Display.DayChangePercent.Text,
			Icon:      "percent",
			Colour:    asxdashTrendColour(data.Display.DayChangePercent.Trend),
		},
	}, nil
}

// asxdashTrendColour maps an ASXDash trend to a metric colour: green for a gain, red for a loss, and none (the default
// text colour) for a flat figure, so a zero is never coloured.
func asxdashTrendColour(trend string) string {
	switch trend {
	case "gain":
		return "green"
	case "loss":
		return "red"
	}
	return ""
}
