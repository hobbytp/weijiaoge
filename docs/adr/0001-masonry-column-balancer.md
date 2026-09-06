# 0001 Masonry Column Balancer

To support arbitrary aspect ratios without cropping images while preserving a chronological, left-to-right reading order, we use a lightweight (~30 LOC) vanilla JavaScript column balancer that assigns incoming case cards to the shortest column container.

## Context

WeiJiaoGe Gallery cases contain images in various aspect ratios (1:1, 16:9, 9:16, panoramic). Pure CSS multi-column layouts (`columns: N`) layout content top-to-bottom per column rather than row-wise, breaking the user expectation that the newest and most relevant cases appear across the top row. Native CSS Grid Masonry (`grid-template-rows: masonry`) lacks broad browser support.

## Decision

We reject heavy external layout libraries (like Masonry.js or Isotope) and pure CSS column-flow. Instead, we implement a lightweight vanilla JS column balancer that maintains 1 to 4 flex column containers (responsive to viewport width) and appends each card to the shortest column by tracked height.

## Consequences

Card ordering remains natural (Z-pattern reading order across the top), layout recalculation on viewport resize is minimal and debounced, and external client runtime bundle size remains 0 KB.
