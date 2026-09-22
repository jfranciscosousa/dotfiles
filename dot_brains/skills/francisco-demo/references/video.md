# Video presentation and delivery

Use this reference for saved video only. Apply the main skill's session isolation, permissions,
privacy, and validation rules.

## Capture preparation

Plan one coherent scenario: a meaningful starting state, key interactions, and a verified result.
Explore controls and resolve setup before recording. Rehearse mutations only when repetition is safe
and authorized; a cleaner take does not justify duplicate records or external effects.

Read `agent-browser record --help` and the installed `core/references/video-recording.md` when
needed. Use `agent-browser skills path core` to locate that reference. Check existing `ffmpeg` and
the required encoder before capture, and an inspection tool such as `ffprobe` for final review. Do
not install missing tools without approval.

Deliver MP4 unless the user requests another format. Current agent-browser records `.mp4` directly
with H.264 and `.webm` with VP8; choose the matching file extension. Prefer direct output over a
separate conversion pipeline. Verify support in the installed version rather than assuming it.

Set framing and complete authentication before capture unless login is the requested scenario. Start
on the ready application page, not a blank tab. Use the same named session throughout. With
`ARTIFACT_DIR` set to the prepared output directory:

```bash
agent-browser --session "$SESSION" record start "$ARTIFACT_DIR/demo.mp4" --cursor
```

Without a URL argument, recording captures the active tab as it is. It does not create a new context
or repeat navigation. Keep the scenario in that tab; do not assume a new tab or popup is captured.
If the flow requires a different tab, check supported capture behavior before the take.

Use the default 30 fps for normal walkthroughs. Use `--fps 60` only when motion detail benefits from
it, such as dragging or animation. A higher requested rate cannot fix dropped or repeated source
frames. Keep `--contact-sheet` off unless requested; it creates an additional image artifact.

## Human-paced presentation

A demo video is a presentation, not a test run with uniform delays. Wait for observable readiness,
then pause for comprehension. Keep discovery and long reasoning breaks outside the take. Use short,
known action sequences with checks at meaningful transitions.

Suggested timing, adjusted to the content:

- Initial meaningful state: approximately 1.5 seconds.
- Before a consequential interaction: approximately 0.5–1 second.
- After navigation or a major state change: approximately 1–2 seconds after readiness.
- Final verified result: 2–3 seconds.

Do not add these pauses mechanically when command latency already provides enough reading time.

### Pointer and input

Use the built-in `--cursor` recording option for an instructional pointer. It adds an inert overlay
that is hidden from accessibility snapshots and removed on `record stop`. Screenshots taken during
recording include it; take clean final-state screenshots after stopping the recording.

Use native human-paced movement rather than injecting custom cursor code or sending many tiny mouse
commands. Refs below are illustrative; resolve them from the current page:

```bash
agent-browser --session "$SESSION" click @e3 --human
agent-browser --session "$SESSION" drag @e4 @e5 --human
```

For deliberate pointer travel, consult `agent-browser mouse --help` for supported duration, steps,
and seeded movement. Keep the pointer away from text during reading pauses.

Use `type` or `keyboard type` when progressive entry helps explain short, non-secret input. `type`
appends; clear existing content deliberately when replacing it. Use `fill` for reliable replacement
when typing animation adds no value. Do not invent typing-delay flags or slow down credential entry
for presentation.

Scroll in small increments and pause at readable content. Avoid abrupt jumps or scrolling past the
result. Keep actual application feedback visible; do not simulate success with overlays or DOM
edits.

### Composition

Use a consistent viewport and readable text. Wait for loading and layout movement to settle before
the opening pause. Leave confirmations visible long enough to read, then end on the verified result.
Exclude developer tools, unrelated tabs, reporters, desktop content, and setup activity. Preserve
natural transitions when they explain the flow.

## Finalization and review

Stop recording explicitly while the session is still open:

```bash
agent-browser --session "$SESSION" record stop
```

Call `record stop` on failure too, then perform session cleanup. Do not rely on closing a browser
context to finalize the video. Report an incomplete or failed take accurately.

Before reporting successful delivery:

1. Confirm recording stopped successfully and the output exists and is non-empty.
2. Inspect the actual container, codec, dimensions, and duration with available media tooling. A
   filename extension or requested frame rate is not proof of the encoded result.
3. Inspect the opening, important interactions, and ending through playback or temporary extracted
   frames. Frame samples show composition and content; playback is needed to assess pacing and
   motion.
4. Check readability, visible feedback, framing, and privacy. Note blank/loading stretches, stutter,
   accidental overlays, or long idle periods. Do not claim smooth motion from still frames alone.
5. Remove temporary review files created by this run, then link the requested final deliverable.

Rerecord defects only when repeating the scenario is safe and authorized. If conversion is required,
use installed tooling and keep the source until the converted file passes review. Do not rename a
WebM file to `.mp4` or substitute another format without agreement. Report missing format or review
capabilities precisely, separate from whether functional validation passed.
