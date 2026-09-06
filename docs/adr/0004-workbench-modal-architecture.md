# 0004 Workbench Modal Architecture

To provide an immersive case study and prompt inspection environment, we replace the basic image-only lightbox with a two-pane Workbench Modal featuring media viewing, structured prompt breakdown, Studio Handoff, and full keyboard navigation.

## Context

Users reviewing prompt engineering examples require both visual asset inspection (high-res images, multi-image comparison) and prompt parameter comprehension (variables, multi-step chains, source attribution). The existing lightbox was limited to a simple centered image overlay.

## Decision

We introduce a two-pane `Workbench Modal`:
1. Left pane (`Media Viewport`): Displays the primary image at natural scale with zoom and download capabilities, accompanied by a `Thumbnail Strip` for multi-image cases.
2. Right pane: Displays structured prompt text with colored `Prompt Variable` badges, step navigation for `Prompt Chains`, copy controls, and a `Studio Handoff` button that copies text and opens Google AI Studio.
3. Navigation: Native keyboard shortcuts (`ArrowLeft`, `ArrowRight`, `Escape`) allow continuous browsing without exiting the modal.

## Consequences

The modal acts as a standalone interactive workbench without introducing external modal libraries or framework dependencies.
