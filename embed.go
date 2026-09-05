package main

import (
	"embed"
	"io/fs"
	"strings"
)

//go:embed VERSION
var versionData []byte

//go:embed static
var embeddedFiles embed.FS

var (
	versionStr string
	indexHTML  []byte
	staticFS   fs.FS
)

func initEmbeddedFiles() {
	versionStr = strings.TrimSpace(string(versionData))
	if versionStr == "" {
		versionStr = "dev"
	}

	rawIndex, err := embeddedFiles.ReadFile("static/index.html")
	if err != nil {
		rawIndex = []byte("<!DOCTYPE html><html><body>Error loading index.html</body></html>")
	}
	indexStr := strings.ReplaceAll(string(rawIndex), "{{VERSION}}", versionStr)
	indexHTML = []byte(indexStr)

	sub, err := fs.Sub(embeddedFiles, "static")
	if err == nil {
		staticFS = sub
	}
}
