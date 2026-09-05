package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

var (
	globalClient = &http.Client{Timeout: 3 * time.Second}
	widgetClient = &http.Client{Timeout: 5 * time.Second}

	statusCache  atomic.Pointer[map[string]ServiceStatus]
	widgetsCache atomic.Pointer[map[string]WidgetResult]
)

func checkHealth() {
	cfg := configCache.Load()
	if cfg == nil {
		return
	}

	newStatus := make(map[string]ServiceStatus)
	var wg sync.WaitGroup
	var mu sync.Mutex

	sem := make(chan struct{}, 10) // Bounded concurrency: max 10 concurrent HTTP probes

	for _, s := range cfg.Services {
		if s.URL == "" {
			continue
		}
		wg.Add(1)
		go func(srv Service) {
			defer wg.Done()

			sem <- struct{}{}
			defer func() { <-sem }()

			start := time.Now()
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()

			req, err := http.NewRequestWithContext(ctx, "GET", srv.URL, nil)
			isUp := false
			latencyMs := 0
			if err == nil {
				if resp, err := globalClient.Do(req); err == nil {
					if resp.StatusCode < 500 {
						isUp = true
					}
					io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
					resp.Body.Close()
					if cfg.ShowPing {
						latencyMs = int(time.Since(start).Milliseconds())
						if latencyMs == 0 {
							latencyMs = 1
						}
					}
				}
			}

			status := ServiceStatus{IsUp: isUp, Latency: latencyMs}

			mu.Lock()
			newStatus[srv.URL] = status
			mu.Unlock()
		}(s)
	}
	wg.Wait()
	statusCache.Store(&newStatus)
}

func pollWidgets() {
	cfg := configCache.Load()
	if cfg == nil || len(cfg.Widgets) == 0 {
		return
	}

	newWidgetsStatus := make(map[string]WidgetResult)
	var wWg sync.WaitGroup
	var wMu sync.Mutex

	sem := make(chan struct{}, 5) // Bounded concurrency for widget APIs

	for _, w := range cfg.Widgets {
		if w.Type == "" {
			continue
		}
		if parser, exists := widgetRegistry[w.Type]; exists {
			wWg.Add(1)
			go func(widget StandaloneWidgetConfig) {
				defer wWg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				wCtx, wCancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer wCancel()

				if metrics, err := parser.Fetch(wCtx, widgetClient, &widget); err == nil {
					wMu.Lock()
					newWidgetsStatus[widget.ID] = WidgetResult{Metrics: metrics}
					wMu.Unlock()
				} else {
					log.Printf("Widget fetch error for %s (%s): %v", widget.Name, widget.ID, err)
				}
			}(w)
		}
	}
	wWg.Wait()
	widgetsCache.Store(&newWidgetsStatus)
}

func broadcastServicesStatus() {
	status := statusCache.Load()
	if status == nil {
		return
	}
	data, err := json.Marshal(status)
	if err != nil {
		return
	}
	clientHub.BroadcastEvent("services", string(data))
}

func broadcastWidgetsStatus() {
	wStat := widgetsCache.Load()
	if wStat == nil {
		return
	}
	data, err := json.Marshal(wStat)
	if err != nil {
		return
	}
	clientHub.BroadcastEvent("widgets", string(data))
}

func startHealthChecker() {
	// Standard service health ping ticker (every 60 seconds)
	ticker := time.NewTicker(60 * time.Second)
	go func() {
		checkHealth()
		broadcastServicesStatus()
		for range ticker.C {
			checkHealth()
			broadcastServicesStatus()
		}
	}()
}

func startWidgetsChecker() {
	// Fast telemetry ticker for widgets (every 10 seconds, bounded >= 5s per Rule 1)
	ticker := time.NewTicker(10 * time.Second)
	go func() {
		pollWidgets()
		broadcastWidgetsStatus()
		for range ticker.C {
			pollWidgets()
			broadcastWidgetsStatus()
		}
	}()
}
