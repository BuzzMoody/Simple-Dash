package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type InitPayload struct {
	Services map[string]ServiceStatus `json:"services"`
	Widgets  map[string]WidgetResult  `json:"widgets,omitempty"`
}

func statusStreamHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	msgChan := make(chan SSEMessage, 10)
	clientHub.Register(msgChan)

	defer func() {
		clientHub.Unregister(msgChan)
		close(msgChan)
	}()

	// Send initial full snapshot
	initPayload := InitPayload{}
	if sStat := statusCache.Load(); sStat != nil {
		initPayload.Services = *sStat
	} else {
		initPayload.Services = make(map[string]ServiceStatus)
	}
	if wStat := widgetsCache.Load(); wStat != nil {
		initPayload.Widgets = *wStat
	}

	if data, err := json.Marshal(initPayload); err == nil {
		fmt.Fprintf(w, "event: init\ndata: %s\n\n", data)
		flusher.Flush()
	}

	pingTicker := time.NewTicker(15 * time.Second)
	defer pingTicker.Stop()

	for {
		select {
		case msg, ok := <-msgChan:
			if !ok {
				return
			}
			w.Write([]byte(msg.Format()))
			flusher.Flush()
		case <-pingTicker.C:
			w.Write([]byte(": ping\n\n"))
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}
