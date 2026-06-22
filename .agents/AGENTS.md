# UI/UX Best Practices

## 1. Sticky Footer Layouts (CSS)
When pinning a footer to the bottom of a page, prefer using `position: absolute; bottom: 0;` on the footer inside a `position: relative; min-height: 100vh;` wrapper (with appropriate `padding-bottom`), rather than applying `flex: 1` or altering the display properties of the main content wrapper. This ensures the internal flow of grids and content is never disrupted.

## 2. High-Performance Animations
When implementing CSS animations, strictly limit them to compositor-only properties (`transform` and `opacity`). Never continuously animate properties that trigger layout reflows or repaints (like `box-shadow`, `width`, `height`, or `margin`) to ensure zero performance overhead for low-powered clients.

## 3. Gradient Text Shadows
Avoid applying `filter: drop-shadow` or `text-shadow` to text elements that utilize `-webkit-background-clip: text` with a background gradient, as it can create muddy or undesirable visual artifacts, especially in light themes.
