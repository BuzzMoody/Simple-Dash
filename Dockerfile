# Stage 1: Build the Go binary
FROM --platform=$BUILDPLATFORM golang:alpine AS builder
ARG TARGETOS
ARG TARGETARCH

WORKDIR /build

# Install dependencies (if any)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build a statically linked binary (cross-compiled natively)
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -a -installsuffix cgo -o dash main.go

# Stage 2: Create the minimal distroless image
FROM gcr.io/distroless/static-debian12:latest

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /build/dash .

# Copy the static assets
COPY --from=builder /build/static ./static

# Expose the default port
EXPOSE 8888

# Run the binary
ENTRYPOINT ["./dash"]
