package main

import (
	"fmt"
	"sync"
)

type SSEMessage struct {
	Event string
	Data  string
}

type ClientHub struct {
	mu      sync.RWMutex
	clients map[chan SSEMessage]struct{}
}

func newClientHub() *ClientHub {
	return &ClientHub{
		clients: make(map[chan SSEMessage]struct{}),
	}
}

func (h *ClientHub) Register(ch chan SSEMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[ch] = struct{}{}
}

func (h *ClientHub) Unregister(ch chan SSEMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, ch)
}

func (h *ClientHub) BroadcastEvent(event, data string) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	msg := SSEMessage{Event: event, Data: data}
	for ch := range h.clients {
		select {
		case ch <- msg:
		default:
			// Non-blocking drop if client buffer is saturated
		}
	}
}

var clientHub = newClientHub()

func (h *ClientHub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

func (m SSEMessage) Format() string {
	if m.Event != "" {
		return fmt.Sprintf("event: %s\ndata: %s\n\n", m.Event, m.Data)
	}
	return fmt.Sprintf("data: %s\n\n", m.Data)
}
