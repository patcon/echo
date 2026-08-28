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

Scope note on the cards, revised. The original note here said only
`InsightNoteCard` and `NavigationSuggestionCard` were prop-driven and that
storying the rest meant MSW. That was too pessimistic. Seeding the query cache
turned out to be ~15 lines in `preview.tsx` (see **The `parameters.query`
seam**), and it reaches the *read* half of `GoalSuggestionCard` and
`CustomVerificationTopicSuggestionCard` cleanly.

The write half it does not reach, and I first wrote this section as though it
did. Corrected: **the cache seam covers reads only.** Every apply button in this
family calls its endpoint directly rather than through the query client, so
nothing in `parameters.query` can intercept it, and the applied state was only
ever *seeded*, never *reached*.

That gap is now closed by MSW rather than by widening the seam: see **MSW, and
why writes needed it** below. Clicking Apply completes for real on both
`GoalSuggestionCard` and `CustomVerificationTopicSuggestionCard`. The two seams
divide cleanly and both are worth keeping: seeding for the initial read (instant
and deterministic), handlers for anything the host actually clicks.

The real dividing line is not hooks-vs-props, it is how guessable the query key
is:

- `useProjectGoal` exports `projectGoalQueryKeys.detail`
  (`goal/hooks/index.ts:25`). Typed, cannot drift. Ideal.
- `useVerificationTopicsQuery` keys on an inline `["verify", "topics",
  projectId]` (`project/hooks/index.ts:647`). Hand-copied into the story; will
  drift silently if that line changes.
- `useProjectById` keys on the whole query object including `deep`/`fields`
  (`project/hooks/index.ts:638`). Seeding means reproducing that object exactly.
  This is what still blocks `TagsUpdateSuggestionCard` and
  `ProjectUpdateSuggestionCard` — not the hooks, the key.

If more of these get storied, exporting key factories from the hooks (as goal
already does) is the change that pays for itself.

## The `parameters.query` seam

`preview.tsx` builds one `QueryClient` per story. A story can now declare cache
rows that are written with `setQueryData` before the tree mounts:

```ts
parameters: {
  query: { seed: [[projectGoalQueryKeys.detail(PROJECT_ID), goalResponse]] },
}
```

Two things worth knowing:

- Seeding happens in the `useState` initialiser, not an effect. These cards read
  the cache during their first render, so an effect would land a frame late and
  the story would flash the un-applied state.
- The client now sets `staleTime: Infinity`. React Query treats even fresh
  seeded data as stale and refetches on mount, which against no backend means
  every seeded story fires a doomed request on load. Stories are static, so
  nothing wants refetching. No existing story depended on a query firing.

Why this matters beyond convenience: the whole card family derives "already
applied" by comparing its proposal to live project state rather than storing a
flag. Without a cache seam, every one of those cards can only ever be storied in
half its states, and the half that is missing is the interesting one.

## Practical constraints

- **Skip the giants.** `AgenticChatPanel.tsx` (2315),
  `ProjectPortalEditor.tsx` (1736), `ConversationAccordion.tsx` (1581),
  `BillingManager.tsx` (1546) hold the behaviour but call `useQuery` /
  `useMutation` directly with no injection seam. MSW is now available, so this
  is no longer a hard block, but a 2000-line component needs a great many
  handlers before it renders anything. Read them; story their leaves.
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
- `chat/ChatModeBanner.stories.tsx`
- `goal/GoalSuggestionCard.stories.tsx`
- `chat/CustomVerificationTopicSuggestionCard.stories.tsx`

The last two are the first stories to use `parameters.query`.

## What the card family reads like once three of them are storied

Worth recording, because it only became visible with `InsightNoteCard`,
`GoalSuggestionCard` and `CustomVerificationTopicSuggestionCard` side by side.
All three are the assistant proposing a mutation the host has to accept, and all
three derive applied-ness from live state rather than storing a flag — that is a
house convention, not three coincidences.

Where they differ is instructive, and two of the differences look unintended:

- **Direction.** The insight note leaves the project (it goes to the dembrane
  team); the goal and the verification topic are written back into the project.
- **Editability.** The insight note gives the host a textarea, the verification
  topic gives two fields, the goal gives none — take the wording or leave it.
- **Empty input.** `InsightNoteCard` disables its button
  (`InsightNoteCard.tsx:88,143`). The other two leave it live and toast from the
  handler (`GoalSuggestionCard.tsx:45-48`,
  `CustomVerificationTopicSuggestionCard.tsx:65-70`). Same question, two
  answers; each story calls this out so nobody copies the wrong one.
- **A way back.** Only `GoalSuggestionCard` gives the host somewhere to go once
  applied — a View button, gated on `workspaceId` being in the route
  (`GoalSuggestionCard.tsx:76-88`). The verification and tags cards end on a
  sentence (`CustomVerificationTopicSuggestionCard.tsx:84-102`). Backwards, if
  anything: applying a goal is terminal, while a verification topic still needs
  verification switched on elsewhere before it runs — the card says so in its
  own draft state (`:117-123`) and then offers no route there. Spotted from the
  stories, not from the code.
- **Match strictness.** The verification card matches labels
  case-insensitively but prompts exactly
  (`CustomVerificationTopicSuggestionCard.tsx:52-61`). Defensible — a prompt is
  the thing that actually runs — but it is not written down anywhere in the app.

Neither of the last two is a bug worth filing on this branch. They are the kind
of thing stories are for: the inconsistency is invisible reading one file and
obvious reading three.

## Lesson: do not story both sides of a boolean

Caught in review, worth not repeating. `CustomVerificationTopicSuggestionCard`
has two visual states, draft and added, and I first wrote four stories that all
sat on the draft side — one per reason the applied check returns false. Each was
captioned "worth reading beside X" as though something differed. Nothing did.
They rendered pixel-identical, so the sidebar promised four things and the
canvas showed one thing four times.

The rule that came out of it: **a story that renders identically to another is
justified only when the identity itself is the finding, and the prose has to say
so outright.** Two survive on those terms — `Not added — three near misses`
(three topics are in the project and the card still offers to add one) and
`Applied — whitespace ignored` (the match holds across padding, and the failure
it rules out is silent). The rest were folded into one story or into the prose
of the state they actually describe.

The near-miss collapse has a second benefit: seeding all three failing topics
into one story makes it a checklist. If you seed a topic and the card still says
"Suggested", that story is the list of reasons why.

This is a general trap for the `parameters.query` seam specifically. Seeding
makes it cheap to produce many *inputs*, which is not the same as many
*renders*, and the sidebar counts stories rather than states.

Third instance, same review: a card with a navigation affordance needs the
router given somewhere to land. `GoalSuggestionCard`'s applied state renders a
View button, `useI18nNavigate` prefixes the language, and the memory router had
no matching route, so clicking it replaced the canvas with react-router's own
"Unexpected Application Error! 404 Not Found" dev page. Reads as a broken story;
is actually a working button with nowhere to go. `parameters.router.routes`
exists for exactly this and `NavigationSuggestionCard.stories.tsx` was already
using it — I just did not look before writing a second card that navigates.
**If a story renders a button that navigates, give it a destination route.**

Related, same review: two stories were called "— apply toasts". Every apply in
this Storybook toasts, because every apply hits no backend, so the name
described the ambient condition rather than the story. They are now "— button
stays enabled", which is the actual finding (the guard is in the handler, not on
the button). **A story name has to name what is true here and not next door.**

Worth keeping in mind that the empty-input stories are the only ones where
clicking Apply means anything, since they are the only place the toast comes
from the card's own guard rather than from the missing server. Two error toasts
that look alike and mean opposite things; both stories say which is which.

## A latent defect the stories turned up

`GoalSuggestionCard` decides it has been applied by comparing trimmed strings,
with "no goal" folded into the empty string (`GoalSuggestionCard.tsx:37-42`):

```ts
(goalQuery.data?.current?.content ?? "").trim() === normalizedSuggestion
```

An empty or whitespace-only proposal on a project with no goal compares
`"" === ""`, so the card renders "Saved as this project's goal." for something
never saved. On a project that does have a goal, the same input renders an empty
pair of quotation marks over an Apply button that refuses the click. One gap
with two faces: the card has no handling for an empty suggestion.

**Reachability, checked after the fact.** It cannot happen today. The card is
constructed in one place (`AgenticChatPanel.tsx:1947-1950`), always through
`parseGoalSuggestion`, which trims and returns null on empty
(`agenticToolActivity.ts:528-529`). Worth recording that I labelled the first
story "(defect)" before checking this, and had to walk it back to "(latent
defect)" once I did. **Check reachability before naming something a defect** —
the constructor is as much a part of the behaviour as the component.

What remains is a robustness cost, not a user-visible bug: the component is
correct only because a guard in another file holds, and nothing in the component
says so. A second construction site reintroduces it silently. The fix that covers
both faces is to refuse the input rather than patch the comparison — an early
`if (!normalizedSuggestion) return null;` would make the component agree with its
own parser.

One thing here *is* live regardless of reachability: Apply stays enabled on empty
content while `InsightNoteCard` disables (`InsightNoteCard.tsx:88,143`). That
inconsistency is real today.

Worth noting how it surfaced. Nothing about this was visible reading the
component; it showed up because a story seeded an empty project and a degenerate
input at the same time, which is a combination no one clicks their way into.
That is the argument for storying the degenerate cases — and the reachability
check is the discipline that keeps such a story honest about what it found.

## Two conventions worth keeping

**Mark defects in the story name, and say which kind.** Both empty-suggestion
stories carry "(latent defect)", so the sidebar itself says this is pinned
current behaviour rather than intended behaviour, and that it is gated upstream
rather than live. Anyone scanning the list sees there is something to come back
to without opening the file. Plain "(defect)" would have been the wrong label
here and was in fact my first one — see the section above. Drop the suffix when
the underlying gap is closed.

**`play` reaches states that have no seam.** `dismissed` is local `useState`
(`GoalSuggestionCard.tsx:34`) with no prop and nothing persisted, so args and
cache seeding both miss it entirely. A `play` function that clicks Dismiss gets
there. This runs on core Storybook 10 with `addons: []` — the interactions addon
only adds the step-through panel, not the execution — so the click just happens
on load with no UI affordance for replaying it.

That is now four tiers for getting a card into a state, worth choosing between
in order: args (cheapest), `parameters.query` seeding (server state), `play`
(local state), MSW handlers (writes). See **MSW** below.

## MSW, and why writes needed it

`parameters.query` seeds reads. It cannot touch writes, because every apply
button calls its endpoint directly rather than through the query client, so the
applied state was only ever reachable by declaring it, never by clicking.

`msw` + `msw-storybook-addon` are now devDependencies and both cards with apply
buttons complete for real. Clicking Apply on `GoalSuggestionCard`'s `Proposed`
runs the genuine path: request, `onSuccess` writes the revision into the cache,
`applied` re-derives, card switches. Nothing is faked past the network boundary.

Why MSW rather than ~25 hand-rolled lines patching `fetch`: `bff.ts` uses fetch,
but `lib/api.ts` is axios, which uses XHR in the browser. A fetch stub would
have fixed the goal card and left `CustomVerificationTopicSuggestionCard`
broken, and patching XHR as well is reimplementing MSW badly. This repo has
already paid for one hand-rolled mock layer (see the dev-fixture section above);
it did not need a second.

Setup notes, all of which cost time:

- **v3 is not v2.** `initialize()` is gone. For CSF 3 the import is
  `msw-storybook-addon/csf3` and `mswLoader` is a factory: `loaders:
  [mswLoader()]`. The package default export is for CSF Next, which this project
  does not use. No `addons` entry is needed, so `addons: []` still holds.
- **`staticDirs: ["../public"]`** had to be added to `main.ts`. Storybook does
  not inherit Vite's publicDir, so without it `mockServiceWorker.js` 404s and
  every handler silently falls through to the network.
- **Handler paths are same-origin.** `API_BASE_URL` is the relative `/api`
  locally (`config.ts:90-93`), resolved against the page origin, so handlers are
  written `/api/v2/bff/...` and `/api/verify/...`, never against a backend host.
  This is also why the writes used to fail so uniformly: they were landing on
  Storybook's own origin, which has never heard of those paths.
- **Handlers are backed by mutable module state**, so the invalidation that
  follows a save refetches and agrees with what was just written instead of
  contradicting it. Each story resets that state in `beforeEach` via `withGoal`
  / `withTopics`, which is what stops applying in one story leaking into the
  next. Seeding is kept alongside it for an instant, deterministic first paint.
- The default setup warns on unhandled requests it does not recognise as
  Storybook assets. Useful: a typo'd handler path shows up in the console rather
  than failing silently.
