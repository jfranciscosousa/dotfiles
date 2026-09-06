# Video presentation and delivery

Read this reference only when saved video is requested. The skill's environment, permissions,
privacy, and validation rules still apply.

## Capture preparation

Check before capture that existing tooling can deliver the requested format. Deliver MP4 unless the
user requests another format. Do not install conversion or inspection tools without permission.

Create the recorded browser context only after the application and dependencies are ready. Avoid
capturing startup, migrations, seed activity, blank pages, or unrelated preparation.

## Human-paced presentation

A demo video is a presentation, not a test run with uniform delays. Do not use global `slowMo` as
the primary pacing mechanism. Wait for observable readiness first, then pause for comprehension.

Suggested timing, adjusted to the content:

- Initial meaningful state: approximately 1.5 seconds.
- Before an important interaction: 0.4–0.7 seconds.
- After completing a field: 0.3–0.5 seconds.
- Before consequential submission: 0.7–1 second.
- After navigation or major state change: wait for readiness, then 1.2–1.8 seconds.
- Visible success state: 1.5–2 seconds.
- Final verified result: 2–3 seconds.

### Cursor movement

Do not teleport the cursor between controls. Resolve the visible target center, choose a
distance-aware duration of normally 250–600 ms, interpolate with easing, and emit movement points
approximately every 16–25 ms. Pause over the target, click, and allow visible feedback to settle.

Avoid frantic motion, unnecessary hovering, and paths across important text. A Playwright recording
may not show a native pointer. If a visible cursor is needed, use a test-only overlay that does not
intercept input or alter product behavior, and verify it in the output.

### Typing and scrolling

Type visible non-secret text progressively. Use a deterministic cadence: ordinary characters at
approximately 45–85 ms, slightly longer at word boundaries, and a short pause for punctuation. Long
pasted or generated content can be faster while still readable. For masked credentials, prioritize
privacy and reliability over presentation rhythm.

Scroll in small, smooth increments over visible time. Pause at readable content. Avoid abrupt jumps
unless the target is outside a practical scroll path and the jump preserves comprehension.

### Composition

Start at the first meaningful state. Wait for loading and layout movement to settle. Keep the cursor
away from content during reading pauses. Leave confirmations visible long enough to read. Prefer one
coherent scenario; end on the final verified state. Do not show developer tools, unrelated tabs,
reporters, or setup activity.

## Finalization and review

Before reporting successful video delivery:

1. Close the page and recorded context so Playwright finalizes the video.
2. Confirm the file exists, is non-empty, and has a plausible duration.
3. Convert the native video to MP4 with available tooling unless another format was requested.
   Preserve the original until conversion succeeds, then remove it unless the user requested it.
4. Inspect representative frames or play the final deliverable with available tooling.
5. Check the opening, important interactions, and ending. Reject prolonged blank/loading states,
   unreadable results, accidental overlays, stutter, frantic motion, or long dead periods.
6. Confirm the output contains no secrets or personal information.

Rerecord material presentation defects only when repeating the scenario is safe and authorized. Do
not duplicate consequential mutations to obtain a better recording. If repetition is unsafe, report
the limitation.

If no available tool can produce MP4, report the missing prerequisite rather than presenting the
native file as the requested result. If visual review cannot be performed, state that limitation;
file existence alone does not establish presentation quality.
