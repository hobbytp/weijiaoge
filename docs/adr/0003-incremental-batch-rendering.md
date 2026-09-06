# 0003 Incremental Batch Rendering for Masonry Gallery

To maintain sub-50ms initial layout time and prevent thread jank across 300+ image-rich cases, we render case cards in progressive batches of 24 using an IntersectionObserver sentinel.

## Context

The gallery contains over 300 entries with high-resolution external images, growing daily. Rendering hundreds of complex card nodes and calculating masonry column balancing in a single tick triggers layout thrashing and high peak memory, especially on mobile devices.

## Decision

We decouple filtered datasets from the active DOM. When a filter or search runs, we slice the first 24 cases into the masonry columns and place an invisible `Batch Sentinel` at the bottom. As the user scrolls near the bottom, the `IntersectionObserver` triggers the next 24-item slice until exhausted.

## Consequences

Initial render is near-instantaneous. Recalculations during viewport resizing only process currently visible DOM cards, preserving fluid 60fps scrolling.
