package main

import (
	"context"
	"io"
	"net/http"
	"os"
	"sync/atomic"
	"time"
)

var releasesCache atomic.Pointer[[]byte]

func releasesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	if data := releasesCache.Load(); data != nil {
		w.Write(*data)
		return
	}
	w.Write([]byte("[]"))
}

func startReleasesFetcher() {
	fetch := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/repos/BuzzMoody/Simple-Dash/releases", nil)
		if err != nil {
			return
		}

		var token string
		if cfg := configCache.Load(); cfg != nil {
			token = cfg.GithubToken
		}
		if token != "" {
			req.Header.Set("Authorization", "token "+token)
		}

		resp, err := globalClient.Do(req)
		if err != nil {
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode == 200 {
			if body, err := io.ReadAll(resp.Body); err == nil {
				releasesCache.Store(&body)
				os.MkdirAll("data/.cache", 0755)
				os.WriteFile("data/.cache/releases.json", body, 0644)
			}
		}
	}

	go func() {
		if info, err := os.Stat("data/.cache/releases.json"); err == nil {
			if time.Since(info.ModTime()) < 1*time.Hour {
				if body, err := os.ReadFile("data/.cache/releases.json"); err == nil {
					releasesCache.Store(&body)
				}
			}
		}

		if releasesCache.Load() == nil {
			fetch()
		}

		for range time.Tick(1 * time.Hour) {
			fetch()
		}
	}()
}
