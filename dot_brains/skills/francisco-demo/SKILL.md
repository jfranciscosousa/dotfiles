---
name: francisco-demo
description:
  Validate web application flows and produce exactly the screenshots, polished videos, or
  interactive demonstrations requested by the user. Use for background browser testing, visual
  evidence, and human-paced application demos.
---

# Playwright demo

Use headless Playwright for browser automation that should run without opening a visible browser or
interrupting the user’s workflow.

Adapt to the current repository’s framework, package manager, scripts, authentication model, test
infrastructure, and conventions.

Do not assume specific routes, entities, credentials, ports, databases, package commands, or
application behavior.

## Requested modes

Treat these as independent, composable capabilities:

- Functional validation
- Screenshots
- Saved video
- Live interactive session

Enable exactly the capabilities requested by the user.

Examples:

- “Test this flow” means validation without retained visual artifacts.
- “Take a screenshot” means validation and screenshots, without video.
- “Record a demo” means validation and saved video, without screenshots.
- “Show me a live demo” means an interactive session, without saved video.
- “Show me a live demo and take screenshots” means an interactive session and screenshots, without
  saved video.
- “Record a video and capture the final state” means video and screenshots.
- “Take a photo of the web app” means a screenshot when the browser context makes that intent clear.

Do not produce additional artifact types merely because they might be useful.

The word “demo” alone may mean live or recorded. Infer the intended mode from context. Ask only when
the distinction remains materially unresolved.

## Understand the repository

Before execution:

1. Read applicable repository instructions.
2. Inspect existing scripts, documentation, browser tests, helpers, and configuration.
3. Identify the established startup and readiness mechanisms.
4. Identify relevant test-environment, authentication, mock-service, and seed mechanisms.
5. Reuse existing project tooling instead of introducing a parallel test architecture.

Do not modify product code or configuration merely to facilitate the run unless the user asks.

## Browser execution

Run browser automation entirely in the background so it does not disrupt the user’s workflow.

Use direct headless Playwright for validation, screenshots, and saved video. Do not open a visible
browser window, browser UI, test-runner UI, or developer tools.

If the user explicitly requests a live or interactive demonstration, use an available interactive
browser surface. Otherwise, keep all browser activity hidden.

## Environment safety

Use an explicitly non-production environment whose data is safe for the requested scenario.

Do not assume that a remote preview, staging deployment, or development database is disposable.

Never use:

- Production data
- Personal accounts
- Personal credentials
- An environment whose mutation boundaries are unclear

If a safe environment cannot be identified, stop and report what is missing.

## Playwright prerequisites

Use the repository’s installed Playwright dependency, browser binary, and established configuration
when available.

Do not silently:

- Install Playwright
- Download browser binaries
- Invoke package runners that download missing packages
- Install another browser framework
- Modify package manifests or lockfiles

If the repository lacks a usable Playwright setup, report the missing prerequisite and ask before
modifying the repository.

## Seed and authentication policy

Do not assume every repository has authentication or requires seed data.

When authentication or established records are required, use the repository’s existing documented
default seed, demo identity, or test identity.

Resolve seeded credentials only from:

- Repository documentation
- Existing seed definitions
- Established test helpers
- Documented test-only configuration

Do not dump entire environment or configuration files, print credentials, echo commands containing
credentials, or expose credentials in artifacts or reports.

If seeded credentials cannot be resolved safely, stop and report the problem.

Finding a seed file does not authorize running it. Run an existing seed command only when repository
documentation establishes that the command is safe and idempotent for the selected isolated
environment.

Do not:

- Create accounts to prepare the scenario
- Invent credentials
- Modify seed definitions
- Reset or reseed a database
- Directly manipulate stored data
- Manufacture prerequisite records

If the required seed does not exist, stop and report what is missing.

Create or modify a reusable demo seed only when the user explicitly authorizes self-generating one.
When authorized:

- Follow the repository’s existing seed architecture.
- Use deterministic, clearly non-production values.
- Place documentation in the repository’s established location.
- Validate it through the normal seed workflow.
- Avoid unrelated schema, account, or fixture changes.

## Data mutation boundaries

Mutations intrinsic to the explicitly requested browser scenario are allowed.

Do not perform unrelated setup or cleanup mutations.

Preserve scenario-created test data unless:

- The user requests cleanup.
- The repository’s established isolated-test lifecycle performs cleanup automatically.

Do not reset existing state merely to make the demonstration easier. If existing state conflicts
with the scenario, report the conflict.

## Application preparation

Complete nonvisual preparation before starting retained capture:

- Establish the safe environment.
- Run authorized migrations or safe seed commands.
- Start required mock services.
- Start the application.
- Wait for readiness.

Use an available isolated port when practical.

For recorded video, create the recorded browser context only after the application and its
dependencies are ready. Avoid capturing server startup, migrations, seed activity, blank pages, or
unrelated setup.

## Browser configuration

For screenshots, saved video, and nonvisual validation, run Playwright headlessly.

Use:

- A fresh isolated browser context
- A viewport appropriate to the requested scenario
- Repository- or user-defined mobile settings when applicable
- Deterministic presentation settings when relevant

When no stronger requirement exists, use a desktop viewport of `1440 × 900`.

Keep locale, timezone, appearance, reduced-motion behavior, and other presentation-affecting
settings deterministic when they affect the scenario.

Record only the application viewport, never the desktop.

## Artifact storage

Store only requested artifacts.

Use the repository’s established artifact directory when one exists. Otherwise use:

```text
.artifacts/demos/<scenario>-<timestamp>/
```

Do not commit artifacts unless requested.

## Human-paced video

Apply this section only when saved video is requested.

A demo video is a presentation, not a test run with uniform delays.

Do not use global `slowMo` as the primary pacing mechanism. Pace meaningful events deliberately.

Suggested presentation timing:

- Initial meaningful state: approximately 1.5 seconds
- Before an important interaction: 0.4–0.7 seconds
- After completing a field: 0.3–0.5 seconds
- Before consequential submission: 0.7–1 second
- After navigation or a major state change: wait for readiness, then 1.2–1.8 seconds
- Visible success state: 1.5–2 seconds
- Final verified result: 2–3 seconds

These are presentation defaults, not strict timers. Adjust them based on how long a viewer needs to
understand the content.

### Cursor movement

Do not teleport the cursor between visible controls.

Move using distance-aware, eased interpolation:

1. Resolve the target’s visible center.
2. Choose a movement duration proportional to distance, normally 250–600 ms.
3. Interpolate with easing rather than constant-speed linear movement.
4. Emit movement points approximately every 16–25 ms.
5. Pause briefly over the target.
6. Click and allow visible feedback to settle.

Avoid frantic movement, unnecessary hovering, and cursor paths that cross important readable content
when a cleaner route is available.

### Typing

Type visible, non-secret text progressively at a readable human cadence.

Vary the cadence deterministically rather than using one delay for every character:

- Ordinary characters: approximately 45–85 ms
- Spaces and word boundaries: slightly longer
- Punctuation: an additional short pause
- Long pasted or generated content: a faster but still readable cadence

Do not introduce uncontrolled randomness that makes runs difficult to reproduce.

For masked credentials, prioritize privacy and reliability over presentation rhythm.

### Scrolling

Scroll using small, smooth increments over visible time.

Pause when content should be read. Do not scroll continuously through important information.

Avoid abrupt jumps unless the target is outside the practical scroll path and the jump will not harm
comprehension.

### Presentation quality

- Start on the first meaningful state.
- Wait for loading indicators and layout movement to settle.
- Keep the cursor away from content during reading pauses.
- Let confirmations and success messages remain visible long enough to read.
- Do not show developer tools, test reporters, unrelated tabs, or setup activity.
- Prefer one coherent scenario over unnecessary interactions.
- End on the final verified state.

## Screenshots

Apply this section only when screenshots are requested.

Capture only states relevant to the request.

Choose full-page, viewport, or element capture according to what communicates the state most
clearly.

Use descriptive ordered filenames such as:

```text
01-initial-state.png
02-action-ready.png
03-result.png
04-persisted-result.png
```

Do not capture:

- Secrets
- Unmasked credentials
- Personal information
- Unrelated application content
- Desktop content

Do not also record video unless the user requested it.

## Validation

Derive success criteria from the requested scenario and observable application behavior.

Use the least invasive evidence sufficient to verify the claim, such as:

- Expected navigation
- Visible state changes
- Confirmation feedback
- Persisted state after reload
- Relevant API results
- Absence of material console errors
- Repository-provided assertions or data-access helpers

A recording of clicks is not proof of success.

If persistence is part of the claim, verify it after reload or through an established repository
helper.

Do not directly manipulate data to manufacture a successful result.

## Failure handling

If the scenario fails:

1. Stop the run cleanly.
2. Report the precise failed step and available evidence.
3. Do not modify product behavior unless the user also requested a fix.
4. Do not present a failed recording as a successful demo.

Keep video, screenshot, and trace capture disabled unless requested.

When additional diagnostics are genuinely required, prefer logs, DOM state, and request evidence
first. Temporary diagnostic artifacts may be created only when needed for diagnosis and must not be
presented as requested deliverables.

## Video finalization and quality review

Apply this section only when saved video is requested.

Before reporting success:

1. Close the recorded page and browser context so Playwright finalizes the video.
2. Confirm the video file exists and is non-empty.
3. Confirm its duration is plausible for the scenario.
4. Inspect representative frames or play the video when local tooling permits.
5. Confirm it does not begin with a prolonged blank or loading state.
6. Confirm it does not end before the final result is readable.
7. Check for obvious stutter, frantic cursor motion, accidental overlays, or long dead periods.

Rerun the recording when a material presentation defect makes it difficult to follow.

Do not install media-inspection or conversion tools without permission.

Keep Playwright’s native video format unless the user requests another format. Convert only with
already available tooling, and preserve the original until conversion succeeds.

## Teardown

After execution:

- Close browser resources.
- Stop only processes started for this run.
- Leave unrelated services untouched.
- Preserve requested artifacts.
- Avoid unrelated data cleanup.

## Communication

Before execution, briefly state:

- The application or project being tested
- The safe environment being used
- The requested modes
- The scenario being validated

Do not narrate routine shell commands or browser actions individually.

## Handoff

Report:

- Whether the scenario passed
- What was verified
- Links to exactly the requested deliverables
- Relevant limitations or failures
- Whether scenario-created test data remains
- One concise reproduction command when the repository exposes a stable one

Do not report passwords, secrets, or resolved credential values.

Do not mention unrequested artifact types as missing.
