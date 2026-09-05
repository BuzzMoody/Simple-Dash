package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	healthcheck := flag.Bool("healthcheck", false, "Run a healthcheck")
	flag.Parse()

	if *healthcheck {
		resp, err := http.Get("http://127.0.0.1:8888/")
		if err != nil || resp.StatusCode != 200 {
			os.Exit(1)
		}
		os.Exit(0)
	}

	if err := loadInitialConfig(); err != nil {
		log.Fatalf("Fatal: Could not load initial config (ensure config.yaml is mounted in data/): %v", err)
	}

	initEmbeddedFiles()
	startConfigWatcher()
	startHealthChecker()
	startWidgetsChecker()
	startReleasesFetcher()

	port := "8888"
	log.Printf("Server starting on port %s...", port)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           setupRouter(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	log.Println("Shutting down server gracefully...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Graceful shutdown failed: %v", err)
	}
}
