package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type SysMetrics struct {
	CPU    int    `json:"cpu"`
	RAM    int    `json:"ram"`
	Uptime string `json:"uptime"`
}

var (
	cpuMetricsMutex sync.Mutex
	lastCPUTotal    float64
	lastCPUIdle     float64
	cachedMetrics   *SysMetrics
	lastMetricsTime time.Time
)

func getSysMetrics() *SysMetrics {
	cpuMetricsMutex.Lock()
	defer cpuMetricsMutex.Unlock()

	if cachedMetrics != nil && time.Since(lastMetricsTime) < 5*time.Second {
		return cachedMetrics
	}

	cpuUsage := getCPUUsage()
	ramUsage := getRAMUsage()
	uptimeStr := getUptime()

	cachedMetrics = &SysMetrics{
		CPU:    cpuUsage,
		RAM:    ramUsage,
		Uptime: uptimeStr,
	}
	lastMetricsTime = time.Now()
	return cachedMetrics
}

func getCPUUsage() int {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0
	}

	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 {
		return 0
	}

	fields := strings.Fields(lines[0])
	if len(fields) < 5 || fields[0] != "cpu" {
		return 0
	}

	var vals [8]float64
	for i := 0; i < 8 && i+1 < len(fields); i++ {
		vals[i], _ = strconv.ParseFloat(fields[i+1], 64)
	}

	total := vals[0] + vals[1] + vals[2] + vals[3] + vals[4] + vals[5] + vals[6] + vals[7]
	idleTotal := vals[3] + vals[4]

	if lastCPUTotal == 0 {
		lastCPUTotal = total
		lastCPUIdle = idleTotal
		return 0
	}

	totalDiff := total - lastCPUTotal
	idleDiff := idleTotal - lastCPUIdle

	lastCPUTotal = total
	lastCPUIdle = idleTotal

	if totalDiff <= 0 {
		return 0
	}

	cpuPercent := int(((totalDiff - idleDiff) / totalDiff) * 100)
	if cpuPercent < 0 {
		cpuPercent = 0
	}
	if cpuPercent > 100 {
		cpuPercent = 100
	}

	return cpuPercent
}

func getRAMUsage() int {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}

	var memTotal, memAvailable float64
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		if fields[0] == "MemTotal:" {
			fmt.Sscanf(fields[1], "%f", &memTotal)
		} else if fields[0] == "MemAvailable:" {
			fmt.Sscanf(fields[1], "%f", &memAvailable)
		}
	}

	if memTotal == 0 {
		return 0
	}

	memUsed := memTotal - memAvailable
	ramPercent := int((memUsed / memTotal) * 100)
	if ramPercent < 0 {
		ramPercent = 0
	}
	if ramPercent > 100 {
		ramPercent = 100
	}

	return ramPercent
}

func getUptime() string {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return "0m"
	}

	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return "0m"
	}

	var uptimeSec float64
	fmt.Sscanf(fields[0], "%f", &uptimeSec)

	days := int(uptimeSec) / (24 * 3600)
	hours := (int(uptimeSec) % (24 * 3600)) / 3600
	minutes := (int(uptimeSec) % 3600) / 60

	if days > 0 {
		return fmt.Sprintf("%dd %dh", days, hours)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm", hours, minutes)
	}
	return fmt.Sprintf("%dm", minutes)
}
