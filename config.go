package main

import (
	"log"
	"os"
	"strconv"
	"strings"
	"sync/atomic"

	"gopkg.in/yaml.v3"
)

type Announcement struct {
	Text string `yaml:"text" json:"text"`
	Type string `yaml:"type" json:"type"`
}

type CategoryColoursConfig struct {
	Enabled bool `yaml:"enabled" json:"enabled"`
	Titles  bool `yaml:"titles" json:"titles"`
}

func (c *CategoryColoursConfig) UnmarshalYAML(value *yaml.Node) error {
	if value.Kind == yaml.ScalarNode {
		var b bool
		if err := value.Decode(&b); err != nil {
			return err
		}
		c.Enabled = b
		return nil
	}

	type alias CategoryColoursConfig
	var a alias
	if err := value.Decode(&a); err != nil {
		return err
	}
	*c = CategoryColoursConfig(a)
	return nil
}

// MetricStep defines a threshold value and colour transition for widget metrics.
type MetricStep struct {
	Value  float64 `yaml:"value" json:"value"`
	Colour string  `yaml:"colour" json:"colour"`
}

func (s *MetricStep) UnmarshalYAML(value *yaml.Node) error {
	type alias MetricStep
	var a struct {
		alias `yaml:",inline"`
		Color string `yaml:"color"`
	}
	if err := value.Decode(&a); err != nil {
		return err
	}
	*s = MetricStep(a.alias)
	if s.Colour == "" && a.Color != "" {
		s.Colour = a.Color
	}
	s.Colour = strings.ToLower(strings.TrimSpace(s.Colour))
	return nil
}

// WidgetLabelConfig defines custom title and colour settings for a widget metric.
type WidgetLabelConfig struct {
	Title   *string      `yaml:"title" json:"title,omitempty"`
	Colour  string       `yaml:"colour" json:"colour,omitempty"`
	Default string       `yaml:"default" json:"default,omitempty"`
	Warning *float64     `yaml:"warning" json:"warning,omitempty"`
	Danger  *float64     `yaml:"danger" json:"danger,omitempty"`
	Steps   []MetricStep `yaml:"steps" json:"steps,omitempty"`
}

func (w *WidgetLabelConfig) UnmarshalYAML(value *yaml.Node) error {
	// Case 1: Scalar node (null or shorthand string title override)
	if value.Kind == yaml.ScalarNode {
		if value.Tag == "!!null" || value.Value == "" || value.Value == "null" || value.Value == "~" {
			empty := ""
			w.Title = &empty
			return nil
		}
		val := value.Value
		w.Title = &val
		return nil
	}

	// Case 2: Mapping node
	if value.Kind == yaml.MappingNode {
		for i := 0; i < len(value.Content); i += 2 {
			k := strings.ToLower(strings.TrimSpace(value.Content[i].Value))
			v := value.Content[i+1]

			switch k {
			case "title", "label", "name":
				if v.Kind == yaml.ScalarNode && (v.Tag == "!!null" || v.Value == "" || v.Value == "null" || v.Value == "~") {
					empty := ""
					w.Title = &empty
				} else {
					val := v.Value
					w.Title = &val
				}
			case "warning":
				var f float64
				if err := v.Decode(&f); err == nil {
					w.Warning = &f
				}
			case "danger":
				var f float64
				if err := v.Decode(&f); err == nil {
					w.Danger = &f
				}
			case "default":
				w.Default = strings.ToLower(strings.TrimSpace(v.Value))
			case "steps":
				var steps []MetricStep
				if err := v.Decode(&steps); err == nil {
					w.Steps = steps
				}
			case "colour", "color":
				if v.Kind == yaml.ScalarNode {
					w.Colour = strings.ToLower(strings.TrimSpace(v.Value))
				} else if v.Kind == yaml.SequenceNode {
					var steps []MetricStep
					if err := v.Decode(&steps); err == nil {
						w.Steps = steps
					}
				} else if v.Kind == yaml.MappingNode {
					for j := 0; j < len(v.Content); j += 2 {
						ck := strings.ToLower(strings.TrimSpace(v.Content[j].Value))
						cv := v.Content[j+1]
						switch ck {
						case "warning":
							var f float64
							if err := cv.Decode(&f); err == nil {
								w.Warning = &f
							}
						case "danger":
							var f float64
							if err := cv.Decode(&f); err == nil {
								w.Danger = &f
							}
						case "default":
							w.Default = strings.ToLower(strings.TrimSpace(cv.Value))
						case "steps":
							var steps []MetricStep
							if err := cv.Decode(&steps); err == nil {
								w.Steps = steps
							}
						default:
							if f, err := strconv.ParseFloat(ck, 64); err == nil {
								w.Steps = append(w.Steps, MetricStep{
									Value:  f,
									Colour: strings.ToLower(strings.TrimSpace(cv.Value)),
								})
							}
						}
					}
				}
			}
		}
		return nil
	}

	return nil
}

type StandaloneWidgetConfig struct {
	ID        string                       `yaml:"id" json:"id"`
	Name      string                       `yaml:"name" json:"name"`
	Type      string                       `yaml:"type" json:"type"`
	URL       string                       `yaml:"url" json:"-"`
	Icon      string                       `yaml:"icon" json:"icon"`
	Logo      string                       `yaml:"logo" json:"logo"`
	LogoDark  string                       `yaml:"logo_dark" json:"logo_dark"`
	LogoLight string                       `yaml:"logo_light" json:"logo_light"`
	Auth      map[string]string            `yaml:"auth" json:"-"`
	Settings  map[string]string            `yaml:"settings" json:"settings"`
	Labels    map[string]WidgetLabelConfig `yaml:"labels" json:"labels,omitempty"`
}

func (w *StandaloneWidgetConfig) UnmarshalYAML(value *yaml.Node) error {
	type alias StandaloneWidgetConfig
	var a alias
	if err := value.Decode(&a); err != nil {
		return err
	}
	*w = StandaloneWidgetConfig(a)

	// Process labels or metrics block with explicit null handling
	for i := 0; i < len(value.Content); i += 2 {
		k := strings.ToLower(strings.TrimSpace(value.Content[i].Value))
		v := value.Content[i+1]
		if (k == "labels" || k == "metrics") && v.Kind == yaml.MappingNode {
			if w.Labels == nil {
				w.Labels = make(map[string]WidgetLabelConfig)
			}
			for j := 0; j < len(v.Content); j += 2 {
				lk := strings.ToLower(strings.TrimSpace(v.Content[j].Value))
				lv := v.Content[j+1]
				var item WidgetLabelConfig
				if lv.Kind == yaml.ScalarNode && (lv.Tag == "!!null" || lv.Value == "null" || lv.Value == "~" || lv.Value == "") {
					empty := ""
					item.Title = &empty
				} else {
					if err := lv.Decode(&item); err != nil {
						return err
					}
				}
				w.Labels[lk] = item
			}
		}
	}
	return nil
}

type Button struct {
	Name      string `yaml:"name" json:"name"`
	URL       string `yaml:"url" json:"url"`
	Icon      string `yaml:"icon" json:"icon"`
	Logo      string `yaml:"logo" json:"logo"`
	LogoDark  string `yaml:"logo_dark" json:"logo_dark"`
	LogoLight string `yaml:"logo_light" json:"logo_light"`
}

type Service struct {
	Name        string `yaml:"name" json:"name"`
	URL         string `yaml:"url" json:"url"`
	Category    string `yaml:"category" json:"category"`
	Logo        string `yaml:"logo" json:"logo"`
	LogoDark    string `yaml:"logo_dark" json:"logo_dark"`
	LogoLight   string `yaml:"logo_light" json:"logo_light"`
	Icon        string `yaml:"icon" json:"icon"`
	Description string `yaml:"description" json:"description"`
	Pinned      bool   `yaml:"pinned" json:"pinned"`
}

type ServiceStatus struct {
	IsUp    bool `json:"is_up"`
	Latency int  `json:"latency,omitempty"`
}

type Config struct {
	Header         string                   `yaml:"header" json:"header"`
	Description    string                   `yaml:"description" json:"description"`
	HeaderColors   []string                 `yaml:"header_colors" json:"header_colors"`
	Footer         string                   `yaml:"footer" json:"footer"`
	Favicon        string                   `yaml:"favicon" json:"favicon"`
	NewTabs        *bool                    `yaml:"new_tabs" json:"new_tabs"`
	ShowOnlyDown   bool                     `yaml:"show_only_down" json:"show_only_down"`
	ShowPing       bool                     `yaml:"show_ping" json:"show_ping"`
	ShowWeather    bool                     `yaml:"show_weather" json:"show_weather"`
	WeatherAnimate *bool                    `yaml:"weather_animate" json:"weather_animate"`
	WeatherCoords  string                   `yaml:"weather_coords" json:"weather_coords"`
	GithubToken    string                   `yaml:"github_token" json:"-"`
	CategoryColors CategoryColoursConfig    `yaml:"category_colors" json:"category_colors"`
	Announcements  []Announcement           `yaml:"announcements" json:"announcements"`
	Buttons        []Button                 `yaml:"buttons" json:"buttons"`
	Widgets        []StandaloneWidgetConfig `yaml:"widgets" json:"widgets"`
	Services       []Service                `yaml:"services" json:"services"`
}

var (
	configCache atomic.Pointer[Config]
	lastModTime atomic.Int64 // UnixNano
	configPath  = "data/config.yaml"
)

func sanitizeID(s string) string {
	s = strings.ToLower(s)
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			sb.WriteRune(r)
		} else if sb.Len() > 0 && sb.String()[sb.Len()-1:] != "-" {
			sb.WriteRune('-')
		}
	}
	res := strings.Trim(sb.String(), "-")
	if res == "" {
		return "widget"
	}
	return res
}

func applyDefaults(cfg *Config) {
	if cfg.Header == "" {
		cfg.Header = "Simple Dash"
	}
	if cfg.Description == "" {
		cfg.Description = "A simple homelab dashboard"
	}
	if cfg.Footer == "" {
		cfg.Footer = "\u00a9 2026 Buzz Moody \u2022 [GitHub](https://github.com/BuzzMoody) \u2022 Built with \u2615 and Go"
	}
	if cfg.NewTabs == nil {
		defaultTabs := true
		cfg.NewTabs = &defaultTabs
	}

	for i := range cfg.Widgets {
		if cfg.Widgets[i].ID == "" {
			if cfg.Widgets[i].Name != "" {
				cfg.Widgets[i].ID = "w-" + sanitizeID(cfg.Widgets[i].Name)
			} else {
				cfg.Widgets[i].ID = "w-" + sanitizeID(cfg.Widgets[i].Type)
			}
		}
	}
}

func loadInitialConfig() error {
	info, err := os.Stat(configPath)
	if err != nil {
		return err
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}

	var newConfig Config
	if err := yaml.Unmarshal(data, &newConfig); err != nil {
		return err
	}

	applyDefaults(&newConfig)

	configCache.Store(&newConfig)
	lastModTime.Store(info.ModTime().UnixNano())
	return nil
}

func reloadConfigIfModified() {
	info, err := os.Stat(configPath)
	if err != nil {
		log.Printf("Error stating config file: %v", err)
		return
	}

	modTime := info.ModTime().UnixNano()
	if modTime > lastModTime.Load() {
		data, err := os.ReadFile(configPath)
		if err != nil {
			log.Printf("Error reading config file: %v", err)
			return
		}

		var newConfig Config
		if err := yaml.Unmarshal(data, &newConfig); err != nil {
			log.Printf("Error parsing config file: %v", err)
			return
		}

		applyDefaults(&newConfig)

		configCache.Store(&newConfig)
		lastModTime.Store(modTime)
		log.Println("Config reloaded")
		clientHub.BroadcastEvent("config_reload", `{"status":"reloaded"}`)
		go func() {
			checkHealth()
			broadcastServicesStatus()
			pollWidgets()
			broadcastWidgetsStatus()
		}()
	}
}
