# Storybook conversion — working notes

Personal scratch notes for `feat/storybook`. Not `docs/`, not team-facing.
Delete or rewrite before merge.

## Goal

Frontend is ~58k lines / ~250 components. Pick a handful of stories that teach
the product, organized around four loops + a commercial layer:

1. **Capture** (participant recording) — `ParticipantOnboardingCards`,
   `MicrophoneTest`, `UserChunkMessage`/`SystemMessage`/`SpikeMessage`,
   `StopRecordingConfirmationModal` (**done**). `ParticipantConversationAudio`
   is unmountable — no injection seam, skip it and story its leaves.
2. **Monitor** (host watching a room) — `StatePill` (**done**),
   `LiveMonitorSection`, `FunnelCanvas`.
3. **Sense-make** (evidence/provenance) — `Quote`, `AspectCard`, `Insight`,
   `CanvasFrame` (**done**, has fixtures already).
4. **Converse** (agentic chat) — `References`/`Sources`/`SourcesSearched`,
   `ChatContextProgress`, `SuggestionCardFrame` (**done**) + card family
   (`InsightNoteCard` **done**, `GoalSuggestionCard` **done**,
   `CustomVerificationTopicSuggestionCard` **done**; `TagsUpdateSuggestionCard`/
   `ProjectUpdateSuggestionCard` blocked on query-key seeding, see below).
5. **Commercial** — `FeatureGate`, `TierBadge`, `TierCapacityMatrix` (all
   prop-driven, easy).

Skip giants with no injection seam: `AgenticChatPanel`, `ProjectPortalEditor`,
`ConversationAccordion`, `BillingManager`. MSW makes them possible in
principle, not worth it yet.

## Existing stories on this branch

- `chat/ChatHistoryMessage.stories.tsx`
- `chat/NavigationSuggestionCard.stories.tsx`
- `pricing/PricingBookingStep.stories.tsx`
- `pricing/PricingConfigurator.stories.tsx`
- `conversation/StatePill.stories.tsx`
- `common/SuggestionCardFrame.stories.tsx`
- `chat/InsightNoteCard.stories.tsx`
- `canvas/CanvasFrame.stories.tsx`
- `chat/ChatModeBanner.stories.tsx`
- `goal/GoalSuggestionCard.stories.tsx`
- `chat/CustomVerificationTopicSuggestionCard.stories.tsx`
- `participant/StopRecordingConfirmationModal.stories.tsx`

## Seams / infrastructure

- **`parameters.query`** (in `preview.tsx`): seeds `QueryClient` cache via
  `setQueryData` in `useState` init (not an effect — cards read cache on first
  render). `staleTime: Infinity` so seeded stories don't fire doomed refetches.
  Reads only — cannot intercept writes (apply buttons call endpoints directly).
- **Query-key guessability** gates which cards can be seeded: `useProjectGoal`
  exports a typed key factory (ideal). `useVerificationTopicsQuery` hand-copies
  an inline key (drift risk). `useProjectById` keys on the whole query object
  incl. `deep`/`fields` — blocks `TagsUpdateSuggestionCard`/
  `ProjectUpdateSuggestionCard` until hooks export key factories.
- **MSW** (`msw` + `msw-storybook-addon`, now devDeps) covers writes for the two
  cards with apply buttons. v3 import is `msw-storybook-addon/csf3`,
  `loaders: [mswLoader()]` — not the v2 `initialize()` API. Needed because
  `bff.ts` uses fetch but `lib/api.ts` uses axios/XHR; a fetch-only stub
  wouldn't cover both. Required `staticDirs: ["../public"]` in `main.ts` (else
  `mockServiceWorker.js` 404s). Handlers are same-origin relative paths
  (`/api/v2/bff/...`) backed by mutable module state, reset per-story via
  `beforeEach` (`withGoal`/`withTopics`).
- **`preview.tsx`** already handles router params (`:language`/`:workspaceId`/
  `:projectId`) and mounts `I18nProvider` inside+outside the router.
- **Portaled components** (Mantine `Modal`) render outside `canvasElement` —
  `play` functions need `within(document.body)`, not `within(canvasElement)`.
  Applies to `PermissionErrorModal`, `ParticipantSettingsModal`, `ArtefactModal`,
  anything on `ConfirmModal`/`InputModal`.
- **`components/*/fixtures.ts` is not a test convention** — it's a hand-rolled
  dev-only mock layer wired into the data hooks (`isFixtureEligibleMiss()` in
  `goal`/`canvas`/`methodology` hooks), gated on `APP_ENVIRONMENT === "local"`
  + BFF 404/fail. Ships an `isDevFixture` flag into production UI (branches in
  `CanvasRoute`, `LibraryRoute`, `ProjectGoalSection`,
  `ProjectMethodologySection`) and fixture HTML into the bundle. Stories may
  import the fixture *data* (`CanvasFrame.stories.tsx` does); do not extend the
  mechanism. Removing it is a separate, out-of-branch change.

## Conventions

- **Provenance in story prose**: any claim tied to a source reference was read
  from source; anything without one is inference, labelled "My reading, not
  sourced". Invented sample copy is called out too. No autodocs addon yet
  (`.storybook/main.ts` has `addons: []`), so this is enforced by convention,
  not tooling.
- **Story names disambiguate the state; the doc comment carries the finding.**
  Don't front-load the finding into the title (bad:
  `Uploading — Finish dead, every other exit live`; good: `Paused (pending
  upload)`). A shared stem for near-identical screens (`Paused`, `Paused (with
  verify)`) signals the relationship the old per-story titles hid.
- **Don't story both sides of a boolean** unless the identity itself (pixel-
  identical render) is the finding — and say so explicitly in the prose.
  Otherwise fold into one story or one prose note.
- **Mark defects in the story name** with the kind: `(latent defect)` when
  gated by an upstream guard that currently holds, plain `(defect)` only if
  actually live. Check reachability (trace to the construction site) before
  calling something a defect at all.
- **A story with a navigation affordance needs a destination** —
  `parameters.router.routes` (see `NavigationSuggestionCard.stories.tsx`) or the
  click 404s inside the story.
- **Two tiers per file for parent-owned state**: one `Playground` story
  (stateful wrapper, real interactivity, harness-only controls clearly labelled
  vs. real props) placed first in the file (sidebar follows export order);
  pinned single-state stories after it (args-driven, `fn()` spies, no
  self-driving). Don't retrofit interactivity into a pinned story.
- **Simulate causation, not just states** — e.g. in the
  `StopRecordingConfirmationModal` Playground, "pause" *causes* the upload
  state rather than upload being an independent toggle, matching the real
  component.
- Invented timing constants get a doc comment saying what's sourced vs. guessed
  (see `SIMULATED_FINISH_MS` vs. `SIMULATED_UPLOAD_MS` in the modal's stories).

## Latent defects found (not fixed on this branch)

- **`GoalSuggestionCard`**: applied-check folds "no goal" and empty proposal to
  the same `"" === ""`, so an empty suggestion would render as already-applied.
  Not reachable today — the only construction site goes through
  `parseGoalSuggestion`, which nulls out on empty. Real, live gap regardless:
  Apply stays enabled on empty content here, but `InsightNoteCard` disables it.
- **`StopRecordingConfirmationModal`**: `showVerifyOnFinish`/`handleVerify`/
  `handleSkipVerification` are independently-optional props, but the one
  construction site always passes all three — a discriminated union would make
  the compiler enforce that. Not storied (unreachable, not worth a sidebar row).
- **Live bug, not latent**: `handleSkipVerification` closes the modal *before*
  awaiting finish, so the Finish-button spinner never renders on that path —
  only surfaced via the Playground harness, since pinned stories hold
  `isStopping`/`opened` independently and can't express the transition where
  both differ.
- **Copy/behavior mismatch**: the verify prompt's own text says "verify before
  finishing," but Verify actually resumes recording and navigates away, while
  Skip closes and finishes.

## Cross-loop finding

`showVerifyOnFinish` is a plain host-set Directus boolean (portal settings),
not agentic — but the agentic chat can flip it via `ProjectUpdateSuggestionCard`
and can propose the verification topic itself via
`CustomVerificationTopicSuggestionCard`. So the assistant's "propose mutations
to the project" pattern reaches from the host's chat loop into a screen only
participants ever see.

## Open / unverified

None of this branch's stories have actually been rendered yet — nothing
typechecked or formatted.

- Confirm `within(document.body)` actually reaches the portaled modal in `play`.
- Confirm the disabled `Anchor component="button"` (switch-to-text in
  `StopRecordingConfirmationModal`) truly doesn't fire when clicked — Mantine
  has no disabled styling for `Anchor`, so it still looks clickable.
