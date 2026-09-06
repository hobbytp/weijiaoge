# 0002 Hybrid Feature Chips Derivation

To provide rich secondary capability tags without mutating the automated daily crawler schema or disrupting existing data pipelines, we derive Feature Chips using a hybrid approach: consuming explicit tags if present in the data, while falling back to a client-side keyword and pattern rules engine.

## Context

Cases need secondary capability tags (e.g. `#多图参考`, `#实时联网`, `#角色一致`) to power horizontal chip filtering. However, cases are automatically harvested by upstream workflows from diverse external sources into `public/cases.json`, and immediate full-schema refactoring across all crawlers introduces maintenance coupling.

## Decision

We decouple taxonomy filtering from data scraping. The frontend filtering engine checks for an explicit `tags` array on each case; if absent or empty, it dynamically derives tags using regex and token matching against `prompts`, `effects`, and `title`.

## Consequences

Existing crawlers and PR pipelines continue running without schema friction. If upstream data pipelines later populate `tags`, the client seamlessly adopts them with zero code changes.
