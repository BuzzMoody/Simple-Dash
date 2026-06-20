package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

type Announcement struct {
	Text string `yaml:"text" json:"text"`
	Type string `yaml:"type" json:"type"`
}

type Config struct {
	Header        string         `yaml:"header" json:"header"`
	Description   string         `yaml:"description" json:"description"`
	HeaderColors  []string       `yaml:"header_colors" json:"header_colors"`
	Footer        string         `yaml:"footer" json:"footer"`
	Announcements []Announcement `yaml:"announcements" json:"announcements"`
	Buttons       []Button       `yaml:"buttons" json:"buttons"`
	Services      []Service      `yaml:"services" json:"services"`
}

type Button struct {
	Name string `yaml:"name" json:"name"`
	URL  string `yaml:"url" json:"url"`
	Icon string `yaml:"icon" json:"icon"`
}

type Service struct {
	Name        string `yaml:"name" json:"name"`
	URL         string `yaml:"url" json:"url"`
	Category    string `yaml:"category" json:"category"`
	Server      string `yaml:"server" json:"server"`
	Logo        string `yaml:"logo" json:"logo"`
	Icon        string `yaml:"icon" json:"icon"`
	Description string `yaml:"description" json:"description"`
}

var (
	configCache Config
	lastModTime time.Time
	configMutex sync.RWMutex
	configPath  = "data/config.yaml"
)

func loadConfig() error {
	info, err := os.Stat(configPath)
	if err != nil {
		return err
	}

	configMutex.RLock()
	modTime := lastModTime
	configMutex.RUnlock()

	if info.ModTime().After(modTime) {
		configMutex.Lock()
		defer configMutex.Unlock()

		data, err := os.ReadFile(configPath)
		if err != nil {
			return err
		}

		var newConfig Config
		if err := yaml.Unmarshal(data, &newConfig); err != nil {
			return err
		}

		configCache = newConfig
		lastModTime = info.ModTime()
		log.Println("Config reloaded")
	}
	return nil
}

func configHandler(w http.ResponseWriter, r *http.Request) {
	if err := loadConfig(); err != nil {
		http.Error(w, "Failed to load config", http.StatusInternalServerError)
		return
	}

	configMutex.RLock()
	data, err := json.Marshal(configCache)
	configMutex.RUnlock()

	if err != nil {
		http.Error(w, "Failed to encode config", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func main() {
	if err := loadConfig(); err != nil {
		log.Fatalf("Fatal: Could not load initial config (ensure config.yaml is mounted in data/): %v", err)
	}

	http.HandleFunc("/api/config", configHandler)
	http.Handle("/logos/", http.StripPrefix("/logos/", http.FileServer(http.Dir("./data/logos"))))
	http.Handle("/", http.FileServer(http.Dir("./static")))

	port := "8888"
	log.Printf("Server starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
