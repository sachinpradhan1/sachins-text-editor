# Prompt for Antigravity — Kinetic "Karaoke Stack" Caption Component

Build a reusable animated caption/subtitle component for my existing website that replicates a specific short-form-video caption style. Implement it so it plugs into my current codebase's structure, styling system, and theme tokens (do not hardcode colors — pull from existing CSS variables / theme config, adding new ones only if none exist).

## What to build

A component (e.g. `KineticCaptions`) that takes **word-level timestamped transcript data** as input:

```json
[
  { "word": "Main", "start": 0.10, "end": 0.32 },
  { "word": "gaane", "start": 0.32, "end": 0.61 },
  { "word": "likhta", "start": 0.61, "end": 0.90 },
  { "word": "tha", "start": 0.90, "end": 1.05 },
  { "word": "toh", "start": 1.10, "end": 1.20 }
]
```

and renders a stacked, self-building caption block synced to media playback (video `currentTime` or an internal timer/prop).

## Behavior spec (exactly what to replicate)

**Container**
- Bottom-anchored, horizontally centered caption block sitting in the lower-third/mid area of the video frame.
- Fixed max-width, text wraps into multiple short lines rather than one long line.

**Build-up animation**
- Captions accumulate **line by line, growing upward** from the anchor point as words are spoken — do not scroll the whole video's transcript continuously; instead, build a stack of roughly 3–4 lines max, then **clear and restart** the stack at the next natural sentence/phrase boundary (use punctuation or a configurable pause-gap threshold in the timestamp data to decide when to reset).
- Each **individual word appears exactly when its `start` timestamp is reached** (not per-line, not per-sentence) — this must be word-level, not batched.
- New word entrance animation: quick scale-up + slight overshoot ("pop") from ~0.7x to 1x, combined with a fast opacity fade-in (roughly 120–180ms, ease-out with a small bounce/overshoot curve — not linear).

**Size/emphasis hierarchy within the stack**
- The line currently being spoken (i.e., containing the most recently revealed word) is the **largest and boldest** — visually the "peak" of the stack.
- As soon as a new line becomes the "current" line, the previous line **shrinks and shifts upward slightly**, dropping to a smaller, lighter-emphasis state (still visible, not removed, until the stack resets).
- The line below/being built (not yet the current spoken line) starts smallest and grows into "current" status as its words fill in.
- So at any moment you can have up to 3 visual tiers simultaneously: small (aging, shifted up) → large (current, center of attention) → small (newly forming, at the bottom).

**Word-level color emphasis**
- Within a line, alternate emphasis between two theme colors (e.g. a neutral/base tone for connective words, an accent tone for emphasized words) — expose this as a configurable pattern (e.g. every Nth word, or driven by an `emphasis: true/false` flag per word in the data) rather than hardcoding which words get which color.

**Typography & readability**
- Bold, condensed, heavy-weight sans-serif (map to whatever the closest weight in my existing site font is — Black/ExtraBold, condensed if available).
- Apply a strong outline/stroke (text-stroke or layered text-shadow) plus a soft drop shadow behind every word, so captions stay legible over any busy background/video.
- Uppercase optional/configurable — default to mixed case matching source text.

**Secondary variant — static title/hook card**
- Also build a second, simpler variant: a static (non-scrolling) 2–3 line bold headline block for intro/hook moments, center-aligned, same font treatment, with support for small decorative accent icons (e.g. sparkle, star, or a custom icon slot) positioned at the corners of the text block, and an optional underline/accent swash beneath the final line. This variant does not animate word-by-word — it can fade/scale in once as a whole unit.

## Technical requirements

- Component should be framework-agnostic-ish but written in whatever my project already uses (match existing component patterns/folder structure — check the repo first).
- Animation should be driven by CSS transitions/keyframes wherever possible for performance; use JS only to toggle state/classes based on the timestamp data and playback time.
- Expose props/config for: max lines before reset, pop-in duration/easing, font size scale ratios between tiers, reset gap threshold (seconds of silence that triggers a stack clear), and the emphasis color pattern.
- Make it reusable across any video/audio element on the site, not hardcoded to one instance.
- Keep it responsive — scale font sizes and container width sensibly on mobile vs desktop.

## Deliverable

Implement the component, wire it into [tell Antigravity where on your site this should go — e.g. a specific video player component/page], and add a short usage example showing how to pass in a transcript JSON and mount it against a video element.
