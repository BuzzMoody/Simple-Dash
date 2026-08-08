package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func widgetFetch(ctx context.Context, client *http.Client, method, url string, headers map[string]string, out interface{}) error {
	if url == "" {
		return fmt.Errorf("widget requires a url")
	}

	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("api returned status %d", resp.StatusCode)
	}

	if out != nil {
		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}

		if outStr, ok := out.(*string); ok {
			*outStr = string(bodyBytes)
			return nil
		}
		if outBytes, ok := out.(*[]byte); ok {
			*outBytes = bodyBytes
			return nil
		}

		if err := json.Unmarshal(bodyBytes, out); err != nil {
			return err
		}
	}

	return nil
}
