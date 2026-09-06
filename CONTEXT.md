# WeiJiaoGe Gallery

A high-fidelity visual gallery and interactive workbench for Gemini Nano Banana prompt engineering cases.

## Gallery & Layout

**Case Card**:
An individual display tile presenting a generated image along with its aspect ratio badge, title, metadata, and quick actions.
_Avoid_: Item, post, tile

**Masonry Column**:
A vertical container managed by the layout balancer to stack case cards with varying aspect ratios into a balanced multi-column flow.
_Avoid_: Waterfall lane, grid cell, column track

**Aspect Badge**:
A floating pill on the case card image denoting original image proportions such as 1:1, 16:9, or 9:16.
_Avoid_: Ratio tag, dimension label

**Batch Sentinel**:
An unstyled boundary DOM element monitored by an intersection observer to trigger progressive rendering of card batches.
_Avoid_: Infinite scroll loader, bottom anchor, page trigger

## Taxonomy & Filtering

**Primary Category**:
The top-level origin or source classification of a case, provided directly by the dataset.
_Avoid_: Source folder, root category, channel

**Feature Chip**:
An interactive capsule tag representing specific prompt engineering capabilities (e.g., `#多图参考`, `#实时联网`), derived via hybrid data-and-rule extraction.
_Avoid_: Filter pill, subcategory, secondary tag

## Prompt Engineering & Workbench

**Workbench Modal**:
The two-pane immersive overlay presenting the media viewport on the left and structured prompt deconstruction and actions on the right.
_Avoid_: Lightbox, popup, detail dialog

**Media Viewport**:
The focused visual container within the Workbench Modal showcasing the active case image with zoom and download capabilities.
_Avoid_: Big image, preview box, left panel

**Thumbnail Strip**:
A horizontal list of miniature image previews beneath the media viewport for multi-image comparison.
_Avoid_: Image picker, carousel dots, preview bar

**Main Prompt**:
The primary or initial prompt text of a case, targeted by card-level quick-copy actions.
_Avoid_: Primary prompt, root prompt

**Prompt Chain**:
An ordered sequence of prompt iterations or multi-step execution stages belonging to a single case.
_Avoid_: Multi-prompt, workflow steps, prompt history

**Prompt Variable**:
A bracketed placeholder (e.g. `[Subject]`, `[Style]`) within a structured prompt template intended for user substitution.
_Avoid_: Slot, placeholder, parameter token

**Studio Handoff**:
The guided transfer flow that copies prompt text to the clipboard and navigates the user directly to Google AI Studio.
_Avoid_: Run button, external link, studio redirect

## Visual Themes

**Dark Obsidian**:
The deep-toned theme palette combining dark charcoal backgrounds with warm gold accents to elevate visual contrast for generated artworks.
_Avoid_: Night mode, pure black theme, OLED theme
