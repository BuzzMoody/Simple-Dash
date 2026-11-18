package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// asxdashServer serves a widget summary at /api/widget/summary with the given day change figures.
func asxdashServer(t *testing.T, changeText, changeTrend, pctText, pctTrend string) *httptest.Server {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != asxdashSummaryPath {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{
			"total_value": "123456.789", "day_change": "456.789", "day_change_ratio": "0.003714",
			"is_market_open": true, "market_session_pending": false,
			"display": {
				"total_value": {"text": "$123,456.78", "trend": "neutral"},
				"day_change": {"text": %q, "trend": %q},
				"day_change_percent": {"text": %q, "trend": %q}
			},
			"generated_at": "2026-11-18T03:00:00Z"
		}`, changeText, changeTrend, pctText, pctTrend)
	}))
	t.Cleanup(ts.Close)
	return ts
}

func TestAsxdashWidget(t *testing.T) {
	tests := []struct {
		name                            string
		changeText, changeTrend         string
		pctText, pctTrend               string
		wantChangeColour, wantPctColour string
	}{
		{"gain", "+$456.78", "gain", "+0.37%", "gain", "green", "green"},
		{"loss", "-$1,234.56", "loss", "-1.23%", "loss", "red", "red"},
		{"flat", "$0.00", "neutral", "0.00%", "neutral", "", ""},
		{"dollar gain too small for the percentage", "+$5.50", "gain", "0.00%", "neutral", "green", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ts := asxdashServer(t, tt.changeText, tt.changeTrend, tt.pctText, tt.pctTrend)
			// A bare base URL gets the summary path appended.
			metrics, err := (&AsxdashWidget{}).Fetch(context.Background(), ts.Client(), &StandaloneWidgetConfig{Type: "asxdash", URL: ts.URL})
			if err != nil {
				t.Fatalf("Fetch: %v", err)
			}
			want := []WidgetMetric{
				{Key: "value", Label: "Value", Value: "123456.789", Formatted: "$123,456.78", Icon: "wallet"},
				{Key: "change", Label: "Today", Value: "456.789", Formatted: tt.changeText, Icon: "trending", Colour: tt.wantChangeColour},
				{Key: "change_percent", Label: "Today %", Value: "0.003714", Formatted: tt.pctText, Icon: "percent", Colour: tt.wantPctColour},
			}
			if len(metrics) != len(want) {
				t.Fatalf("got %d metrics, want %d", len(metrics), len(want))
			}
			for i := range want {
				if fmt.Sprintf("%+v", metrics[i]) != fmt.Sprintf("%+v", want[i]) {
					t.Errorf("metric %d = %+v, want %+v", i, metrics[i], want[i])
				}
			}
		})
	}
}

func TestAsxdashWidgetURLs(t *testing.T) {
	ts := asxdashServer(t, "+$1.00", "gain", "+0.01%", "gain")
	for _, u := range []string{ts.URL, ts.URL + "/", ts.URL + asxdashSummaryPath} {
		if _, err := (&AsxdashWidget{}).Fetch(context.Background(), ts.Client(), &StandaloneWidgetConfig{URL: u}); err != nil {
			t.Errorf("Fetch(%q): %v", u, err)
		}
	}
	// A URL with its own path is used as given (e.g. behind a reverse proxy), so a wrong path is an error.
	if _, err := (&AsxdashWidget{}).Fetch(context.Background(), ts.Client(), &StandaloneWidgetConfig{URL: ts.URL + "/elsewhere"}); err == nil {
		t.Error("expected an error for a path that is not the summary")
	}
}

func TestAsxdashWidgetServerError(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"boom"}`, http.StatusInternalServerError)
	}))
	defer ts.Close()
	if _, err := (&AsxdashWidget{}).Fetch(context.Background(), ts.Client(), &StandaloneWidgetConfig{URL: ts.URL}); err == nil {
		t.Fatal("expected an error for a 500 response")
	}
}
