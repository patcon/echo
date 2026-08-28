# Storybook conversion — working notes

Personal scratch notes for the `feat/storybook` branch. Not part of `docs/`, not
written for the team. Delete or rewrite before this branch goes anywhere near a
merge.

## Why this file exists

Working out *which* components are worth storybooking, and what each one teaches
about the platform. The frontend is ~58k lines across ~250 components; the
question is which handful of them, read as stories, explain what dembrane is
trying to be.

## The four loops

Reading the component tree, the product is four loops plus a commercial layer.
One or two stories per loop covers most of the domain.

### 1. Capture — what a participant experiences

- `participant/ParticipantOnboardingCards.tsx` (598) — slide deck gating
  consent, mic test, initiation. The "ease of use for non-technical people in a
  room" thesis in one file. Its `Slide` type is already a data structure a story
  can drive.
- `participant/MicrophoneTest.tsx` (456) — the reliability aspiration made
  concrete. Permission-denied / no-device / working are states you cannot reach
  by clicking around.
- `participant/UserChunkMessage.tsx`, `SystemMessage.tsx`, `SpikeMessage.tsx` —
  small, prop-shaped, define the participant's mental model of "my conversation
  is being heard".

### 2. Monitor — the host watching a live room

- `conversation/StatePill.tsx` (93, pure function of one enum). Highest
  value-per-line in the repo. Its `ParticipantState` union — `recording`,
  `paused`, `verifying`, `refining`, `text`, `finishing`, `finished`, `waiting`,
  `initiated`, `offline`, `left`, `backgrounded` — *is* the platform's model of
  a live conversation. One story enumerating every state documents the domain
  vocabulary on a single screen.
- `conversation/LiveMonitorSection.tsx` (847), `FunnelCanvas.tsx` (394) — how
  those states aggregate to room level.

### 3. Sense-make — evidence and provenance

- `quote/Quote.tsx` (192) — verbatim excerpt, `relevant_index` slicing,
  `RedactedText`, deep-link back to the conversation. The citation primitive the
  entire "cites where it found things" claim rests on.
- `aspect/AspectCard.tsx`, `insight/Insight.tsx` — the layer above quotes.
- `canvas/CanvasFrame.tsx` — sandboxed-iframe HTML renderer with a
  `dembrane:canvas:height` postMessage protocol. Already has `fixtures.ts` with
  a full sample canvas and generation states, so near-zero effort.

### 4. Converse — the agentic chat

- `chat/References.tsx`, `chat/Sources.tsx`, `chat/SourcesSearched.tsx` (60–82
  each) — small, and they close the loop from answer back to `Quote`.
- `chat/ChatContextProgress.tsx` (76) — makes context-window economics visible.
- The `*SuggestionCard` family — `CanvasSuggestionCard`,
  `ProjectUpdateSuggestionCard`, `TagsUpdateSuggestionCard`,
  `GoalSuggestionCard`, `InsightNoteCard`, plus the already-storied
  `NavigationSuggestionCard` — all share `common/SuggestionCardFrame.tsx`.
  Storying the frame plus a card shows the most distinctive architectural idea
  in the codebase: the assistant doesn't just answer, it proposes *mutations to
  the project*.

### 5. Commercial layer

- `workspace/FeatureGate.tsx` (282) — fully prop-driven (`currentTier`,
  `requiredTier`, `wallKey`, `canRequestUpgrade`), so it stories trivially.
  `gateWalls.ts` enumerates every paywall in the product.
- `workspace/TierBadge.tsx`, `TierCapacityMatrix.tsx` — the tier model in ~90
  lines.

## Starting three (done)

`StatePill` (domain vocabulary) → `SuggestionCardFrame` + `InsightNoteCard` (the
agentic aspiration) → `CanvasFrame` (the output artifact). Covers monitor →
converse → deliver.

Scope note on the cards: only `InsightNoteCard` and the already-storied
`NavigationSuggestionCard` are fully prop-driven. Every other `*SuggestionCard`
calls React Query hooks with no injection seam, so without a backend it renders
a degraded "not yet applied" state. Storying those means MSW or seeding the
query cache, and is a separate decision.

## Practical constraints

- **Skip the giants.** `AgenticChatPanel.tsx` (2315),
  `ProjectPortalEditor.tsx` (1736), `ConversationAccordion.tsx` (1581),
  `BillingManager.tsx` (1546) hold the behaviour but call `useQuery` /
  `useMutation` directly with no injection seam. Storying them means MSW or a
  refactor. Read them; story their leaves.
- **`components/*/fixtures.ts` is not a test convention.** It looked like one.
  It is a local-dev fallback wired into the data layer. See the section below
  before building on it. Stories may import the data; do not extend the pattern.
- **`preview.tsx` already handles the router.** Its `router` parameter supplies
  the `:language` / `:workspaceId` / `:projectId` params that `Quote` and
  friends read through `useParams`, and mounts `I18nProvider` both inside and
  outside the router (Mantine's modal portal re-enters above it).

## Dev-fixture fallback (debt)

I assumed `components/{canvas,goal,methodology}/fixtures.ts` were test fixtures
and a convention worth following. They are neither. **No test file imports
them.** Their only consumers are the hooks:

- `components/goal/hooks/index.ts:29` — `isFixtureEligibleMiss()`
- `components/canvas/hooks/index.ts:93` — same guard
- `components/methodology/hooks/index.ts` — same shape

When `APP_ENVIRONMENT === "local"` **and** the BFF returns 404 or the fetch
fails, the query resolves with fixture data tagged `isDevFixture: true`. That
flag then leaks out of the data layer into shipping UI:

- `routes/project/canvas/CanvasRoute.tsx:417,421,456,527,538` — disables four
  controls and skips an invalidation effect
- `routes/project/library/LibraryRoute.tsx:68` — renders a badge
- `components/goal/ProjectGoalSection.tsx:86`
- `components/methodology/ProjectMethodologySection.tsx:83`

`APP_ENVIRONMENT` is computed at runtime from `window.location.hostname`
(`src/config.ts:27`), not at build time, so none of this is tree-shaken. The
5.7KB of canvas fixture HTML and every `isDevFixture` branch ship in the
production bundle.

In other words this is a hand-rolled, in-band Storybook: someone wanted to see
the canvas UI without a backend and solved it by putting a mock data path, plus
its downstream conditionals, into app code. That is the exact problem Storybook
solves, solved in the wrong layer.

**Direction:** the fixture *data* is good and stories may import it
(`CanvasFrame.stories.tsx` imports `fixtureCanvasGenerations` and nothing else).
The fixture *mechanism* becomes deletable once stories cover the same ground.
Not on this branch — it is a behaviour change, not a story.

A later removal would touch: the three `fixtures.ts` files, the three
`hooks/index.ts` guards and the `isDevFixture` fields on their types, and the
four UI files listed above.

## Provenance convention in stories

Story prose mixes two very different things, and a reader cannot tell them
apart: facts read out of the app, and my inferences about how a component is
meant to be used. The second kind is where a story can quietly mislead.

So: **any claim carrying a `file:line` ref was read out of that source. Anything
without one is my reading of the code**, and inferences about intent are
labelled "My reading, not sourced". Invented sample copy is called out too, per
file, since fixture text that looks app-authored implies usage that may not
exist. Each stories file restates the convention in its meta doc comment.

The refs are checkable, which is the point: `sed -n '19p' StatePill.tsx` either
says what the story claims or it does not. They do go stale when app code moves.
That is an accepted cost, and a stale ref is still better than an unsourced
assertion.

One error this caught, worth recording: I first wrote that `CanvasFrame`'s
`projectId` exists "so links inside the canvas can point back at this project's
participant portal". The real behaviour (`canvas/kit.ts:79-96`,
`isAllowedPortalQrUrl`) is narrower and more interesting: a link is swapped for a
rendered QR image (`kit.ts:99`) only when its origin matches the portal base URL
**and** its path is exactly this project's `/{lang}/{projectId}/start`.

### Not available yet: Docs pages

`.storybook/main.ts` has `addons: []`, so there are no autodocs pages. Adding
`@storybook/addon-docs` would give a provenance split enforced by tooling rather
than convention, because react-docgen renders the component's own JSDoc as the
Docs description, separate from story prose. The catch: `StatePill`,
`SuggestionCardFrame` and `CanvasFrame` have no JSDoc on the component itself.
Their good comments sit inline in the function body, where docgen will not see
them. Lifting those would mean editing app code.

## Existing stories on this branch

- `chat/ChatHistoryMessage.stories.tsx`
- `chat/NavigationSuggestionCard.stories.tsx`
- `pricing/PricingBookingStep.stories.tsx`
- `pricing/PricingConfigurator.stories.tsx`

Added here:

- `conversation/StatePill.stories.tsx`
- `common/SuggestionCardFrame.stories.tsx`
- `chat/InsightNoteCard.stories.tsx`
- `canvas/CanvasFrame.stories.tsx`
