package main

import (
	"log"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
)

func startConfigWatcher() {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("Failed to create fsnotify watcher: %v. Falling back to polling.", err)
		ticker := time.NewTicker(5 * time.Second)
		go func() {
			for range ticker.C {
				reloadConfigIfModified()
			}
		}()
		return
	}

	go func() {
		defer watcher.Close()
		var timer *time.Timer
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if strings.HasSuffix(event.Name, "config.yaml") && (event.Has(fsnotify.Write) || event.Has(fsnotify.Create)) {
					if timer != nil {
						timer.Stop()
					}
					timer = time.AfterFunc(100*time.Millisecond, func() {
						reloadConfigIfModified()
					})
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Printf("Config watcher error: %v", err)
			}
		}
	}()

	err = watcher.Add("data")
	if err != nil {
		log.Printf("Failed to add data directory to watcher: %v", err)
	}
}
