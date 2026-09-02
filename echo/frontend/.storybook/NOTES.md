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
  is being heard". Correction after looking properly: only two of the three are
  prop-shaped. `SystemMessage` (39) and `SpikeMessage` (46) are pure props, but
  `UserChunkMessage` (117) holds a delete `useMutation` (`:23`), so it is the
  MSW tier and does not belong in the same file as the other two.
- `participant/StopRecordingConfirmationModal.tsx` (182) — **done**, and the
  right first pick for this loop. See **The capture loop starts at the exit**
  below.

The recording interface *proper*, `participant/ParticipantConversationAudio.tsx`
(1108), is a skip-the-giants case: `useParams`, five queries, a mutation,
`useChunkedAudioRecorder`, two wake locks, no injection seam. Story its leaves.
`ParticipantConversationAudioContent.tsx` (191) is small but no better — it is
all hooks and an outlet context.

Ordering note for the rest of the loop. `MicrophoneTest` is the one with the
most to teach and it needs a **fifth seam**: it drives
`navigator.mediaDevices.getUserMedia` / `enumerateDevices`, an `AudioContext`
analyser loop, and `js-cookie`. None of args, `parameters.query`, `play` or MSW
touch any of that; it wants a `parameters.media` decorator stubbing
`navigator.mediaDevices`. Worth building deliberately rather than as a side
effect of one story. `ParticipantOnboardingCards` is blocked behind the same
seam because it renders `MicrophoneTest` inline (`:104-113`).

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
- `participant/StopRecordingConfirmationModal.stories.tsx`

`GoalSuggestionCard` and `CustomVerificationTopicSuggestionCard` are the first
stories to use `parameters.query`. `StopRecordingConfirmationModal` is the first
outside the chat/host half of the product, and the first with no server state at
all — args plus one `play`, no seeding and no handlers.

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

## The capture loop starts at the exit

First story outside the host-facing half of the product, and the pick was made
on tractability rather than importance: `ParticipantConversationAudio.tsx` holds
the recording experience, and nothing in it can be mounted. Its most
consequential leaf is fully prop-driven, so that is where the loop starts —
`StopRecordingConfirmationModal`, ten props, no queries, no mutations, one piece
of local state.

Cheapest story on the branch so far. No `parameters.query`, no MSW, no new
seams; six stories on args plus two `play` clicks. Worth recording as a
data point against the assumption that the participant subtree needs
infrastructure before anything there can be storied. One component in it
needed none.

### Portaled components query `document.body`, not `canvasElement`

New mechanic, and the first thing that would have cost time. Mantine renders
`Modal` into a portal at the document root, so the modal is not inside
Storybook's `canvasElement`. Every existing `play` on this branch uses
`within(canvasElement)`, which in this file finds nothing and fails with a
timeout that does not explain itself. `within(document.body)` is the fix.

Applies to `PermissionErrorModal`, `ParticipantSettingsModal`, `ArtefactModal`
and anything built on `ConfirmModal` / `InputModal`, so it is worth knowing
before the next modal story rather than after it.

### What the states turned out to be

Three of the five are sub-second windows in the real app, which is the argument
for the story: uploading, stopping, and the verification prompt are all
reachable only by finishing a real recording at exactly the right instant.

**Two reasons the same button is dead, and they look alike.**
`isFinishDisabled` is `isStopping || isUploading` (`:40`), but `loading` is
wired to `isStopping` alone (`:150`), and the uploading case gets its own
spinner in a copy row above the buttons instead (`:126-135`). So the two states
do read differently — the difference is *where* the spinner sits, which is a lot
to ask of a glance on a phone.

**Dismissing the modal resumes recording, and nothing says so.** The one that
would not have surfaced from reading the component alone, because it needs the
call site. `handleModalClose` (backdrop, Escape, X) calls `handleClose`, which
calls `handleResume()` before `close()` (`:43-47`, `:57-61`) — the same handler
the Resume button runs (`:139`). At the call site that restarts the recorder
from the captured timestamp and re-obtains the wake lock
(`ParticipantConversationAudio.tsx:539-549`). There is no neutral exit: every
way out of this modal is a decision, and one of them is unlabelled.

Safe by construction rather than by design, and worth noting *why* it is safe:
the single moment resuming would be wrong is `isStopping`, which is also the
only state where dismissal is blocked (`:67-68`, `:58`). The invariant holds; it
is not written down.

**An 18px icon is the only warning that Finish will not finish.** With
`showVerifyOnFinish` true, `handleFinishClick` sets local state and returns
without calling `handleConfirmFinish` (`:49-53`). The button keeps its word, its
position and its emphasis; the only change is a check rosette in `rightSection`
(`:154-158`). This is a legitimate case of the "story both sides only when the
identity is the finding" exception from the lesson below — two stories that
render near-identically, where that is the point.

**The verify prompt removes the exits the participant just had.** The second
screen replaces the modal body rather than extending it (`:87-123`): Resume and
switch-to-text are gone, and there is no back. A participant who pressed Finish,
got asked a question, and wants out has only the unlabelled dismiss — which
resumes recording. Ends up in the odd position of asking to finish and being
returned to recording.

Also worth pairing with the call site, because the copy and the behaviour
disagree: Skip closes and finishes
(`ParticipantConversationAudio.tsx:528-531`), but Verify closes, **resumes
recording**, and navigates (`:551-555`). So Verify is "keep recording while you
verify", not "verify before finishing" as the modal's own text says
(`:90-93`).

### One latent defect, checked before naming

`showVerifyOnFinish`, `handleVerify` and `handleSkipVerification` are
independently optional (`:23-25`), so the type permits switching the branch on
without the handlers it needs. Both buttons call through optional chaining
(`:100`, `:111`), so each clears `showVerifyPrompt` and does nothing — the modal
answers the question by dropping back to the screen that asks it. A loop whose
only exit is the dismiss-resumes one.

Not reachable: the component has exactly one construction site
(`ParticipantConversationAudio.tsx:808-819`) and it passes all three props every
time. Checked before writing the story name, per the lesson recorded above —
`(latent defect)`, not `(defect)`.

Same shape as the `GoalSuggestionCard` finding, which is now twice, so it is
worth naming as a pattern rather than two incidents: **a component is correct
only because its single call site is complete, and the type does not carry
that.** Both fixes are in the type or an early return rather than in the render.
Here a discriminated union making the two handlers required when
`showVerifyOnFinish` is true would let the compiler hold the invariant.

### Viewport, considered and not needed

Everything in this loop ships on a phone held by someone standing in a room, and
`preview.tsx` has no viewport handling at all, so a desktop-width story could
misrepresent the real thing. Not here: the modal pins `size="sm"` (`:81`), a
fixed width rather than a proportion, so the canvas width does not change what
it looks like. The question comes back for `MicrophoneTest` and
`ParticipantOnboardingCards`, which are full-screen and fluid.

### Unverified

`node_modules` was empty on this checkout, so none of these stories have been
rendered and nothing was formatted or typechecked. Two specific claims to
confirm on first run:

- The switch-to-text `Anchor component="button"` takes `disabled` (`:170`).
  Mantine spreads unknown props onto the element, so this should reach the DOM
  as `<button disabled>` and genuinely not fire — but `Anchor` has no disabled
  styling, so it stays a blue link that looks clickable. Click it in `Stopping`;
  if `handleSwitchToText` appears in the actions panel, the lockdown has a hole.
- `within(document.body)` reaches the portaled modal in `play` as expected.

### Two tiers per file: pinned stories plus one `Playground`

Came out of wanting the modal's handlers actually wired — clicking Resume, the
X or the backdrop should toggle `opened`, and Finish should run a delay and
close. Converting the six pinned stories to do that would have wrecked them:
every exit from this modal leads to `opened: false`, which renders nothing, so
one stray click leaves a blank canvas with no reset but a page reload. A story
you can click your way out of does not hold a state still, which is the whole
job of the pinned ones.

So the file has two tiers, and they are for different readers:

- **One story named `Playground`** is the sandbox. A stateful `render` wrapper
  owns the parent's state machine so every affordance does something real.
- **Pinned stories** are the documentation. One state each, `args`-driven,
  handlers are `fn()` spies, nothing self-driving. Safe to link someone to.

`Playground` goes **first in the file**, since Storybook orders the sidebar by
export order and the flow is what someone wants on arrival — the pinned states
read better once you have felt the sequence they are cut out of.

Worth generalising to the rest of the branch: any component whose state is
owned by a parent gets this shape. Do not retrofit interactivity into a story
that exists to pin one state; add a `Playground` above it.

Five things learned building this one:

- **A harness needs a surface behind the component.** Without one, Resume,
  dismiss, Finish and Switch-to-text all look identical — a blank canvas — and
  the story reads as broken. The stand-in panel here shows the *host's*
  `StatePill` label for whatever the participant just did, reusing the app's own
  colour vocabulary (`conversation/StatePill.tsx:16-51`) rather than inventing
  one. Unplanned benefit: it is the only place on the branch where both loops
  are visible at once, since the capture stories and the monitor stories
  otherwise never meet.
- **Put every Playground control in one place, and label the kinds.** This one
  took two passes and the first answer was wrong in an instructive way.

  Pass one: the "Simulate failure on finish" toggle started out as an arg, and
  needed a cast to smuggle a non-prop through `StoryObj<typeof meta>`. Moving it
  into the rendered panel dropped the cast and stopped it implying the
  component has a failure mode of its own — the failure is the parent's
  (`ParticipantConversationAudio.tsx:521-525`). From that I generalised
  "harness-only flags in the harness, real props in `args`", which sounds
  principled.

  Pass two showed why it is not. `showVerifyOnFinish` is a real prop, so by that
  rule it stayed in the controls panel — which meant exercising one flow needed
  clicks in two different control surfaces, the canvas and the panel. Both
  switches now sit together in the canvas, each with a Mantine `description`
  saying which kind it is ("Real prop" / "Harness only"). The prop-versus-fiction
  distinction was worth keeping; encoding it in *location* was not, because
  location is also what determines how many places you have to click.

  So: one control surface, and carry the taxonomy in the labels. Corollary
  unchanged — every arg the wrapper owns gets `table: { disable: true }`, since
  a visible `opened: true` control that does nothing is worse than no control.
  For this story that now means the Storybook controls panel is empty, which is
  the honest rendering of a story you click rather than dial.
- **Invented timing gets a named constant, and the constant records what is
  sourced.** Two of them here, and they are not equally grounded.
  `SIMULATED_FINISH_MS = 3000` sits inside a real envelope: a 100ms floor
  (`:490`), a 30s upload-race ceiling (`:494-496`), plus a network call
  (`:514`). `SIMULATED_UPLOAD_MS = 1500` has no bound in the code at all — what
  is sourced is only that the upload exists and what it carries (stopping the
  recorder triggers the final chunk immediately, `:473`, and a chunk is 30
  seconds of audio at the recorder's default timeslice,
  `hooks/useChunkedAudioRecorder.ts:63`). Saying which is which in the constant's
  own doc comment is the difference between a simulation and a story that
  quietly asserts timing the app does not guarantee.
- **Simulate the states the component is *given*, not just the ones it owns.**
  `isUploading` began as a control, which was wrong twice over: it made an
  ambient condition look like a dial, and it missed that pausing *causes* the
  upload (`ParticipantConversationAudio.tsx:473`, and `isUploading` is that
  mutation's `isPending` at `:812`). Now the harness owns it and the pause
  starts it, so pressing "Simulate pause" gives you a modal whose Finish button
  is dead for a moment and then comes alive. Most useful thing in the story,
  and it was not designed — it fell out of making the simulation honest about
  causation. The pinned `Uploading` story describes the same moment but cannot
  show it resolving, which is the tier split working as intended.
- **Start the harness one step before the component.** First version opened
  with the modal already up, which quietly asserted that this modal is a screen
  you land on. It is not — it is something a pause produces (`:470-479`), and
  opening straight into it skips the upload window that the pause causes. The
  harness now starts on the recording surface with the modal closed and a
  "Simulate pause" button as the way in. Costs one click, buys the whole
  sequence. Generalises: a component that only ever appears as a *consequence*
  should be reached in its Playground, not mounted.

### What the Playground turned up that the pinned stories could not

The harness earned its place immediately, which was not the expected outcome —
it was built for feel, not for findings.

**Skipping verification loses the spinner that finishing directly has.**
`handleSkipVerification` calls `close()` *before* awaiting the finish
(`ParticipantConversationAudio.tsx:528-531`), so `isStopping` goes true on an
already-closed modal and the Finish button's `loading`
(`StopRecordingConfirmationModal.tsx:150`) has nothing to render into. Press
Finish directly and the modal spins for the duration; press Finish then Skip and
there is no feedback at all until the route changes. Same conversation, same
work, two different answers to "is anything happening".

Live, not latent — both paths are reachable whenever verify-on-finish is armed.
Cheap to fix (close after the await, or leave the modal up in its stopping
state), but it is a behaviour change, so not on this branch.

Why the pinned stories missed it: each one holds `isStopping` and `opened`
independently, so the pairing that matters here — `isStopping` true *while*
`opened` is false — is not a state either of them can express. It only exists as
a transition. That is the argument for the second tier in one line: **pinned
stories cover states, a Playground covers the transitions between them.**

### `showVerifyOnFinish` is not an agentic feature, but the agentic chat can turn it on

Asked directly, and the answer has three parts because the naming invites two
different confusions.

**It is a host setting.** `is_verify_enabled` and `is_verify_on_finish_enabled`
are plain Directus project booleans, set by a host with two switches in portal
settings (`project/ProjectPortalEditor.tsx:1007`, `:1232`), and the participant
modal derives `showVerifyOnFinish` from them plus two runtime conditions
(`ParticipantConversationAudio.tsx:463-467`). Nothing agentic gates it.

**Verify is still LLM work.** The backend generates an artefact from the
conversation, the participant reads it aloud, discusses it, hits revise to
regenerate against that discussion, and approves
(`participant/verify/hooks/index.ts:29-60`,
`participant/verify/VerifyInstructions.tsx:14-58`). So "not agentic" is not the
same as "not AI" — this is a generate-and-revise loop pointed at the
participant rather than the host.

**The agentic chat reaches into it from three directions**, which is the part
worth recording because it crosses two of the four loops. All three of
`is_verify_enabled`, `is_verify_on_finish_enabled` and
`selected_verification_key_list` are in `ProjectUpdateSuggestionCard`'s field
map (`chat/ProjectUpdateSuggestionCard.tsx:65-66`, `:69`), and that card is
constructed only by `AgenticChatPanel.tsx:1895`. The already-storied
`CustomVerificationTopicSuggestionCard` is the fourth, proposing a topic for
the artefact to be generated about (`AgenticChatPanel.tsx:1923`). So the
assistant can propose switching on a detour that only participants will ever
see, and propose what they will be asked to verify.

That is the clearest instance so far of the thing the suggestion-card stories
kept circling: the assistant does not just answer, it proposes mutations to the
project — and here the mutation lands in a different loop from the one the host
is looking at. Nobody reading either loop's stories alone would see it.

**Do not confuse "Agentation" with "agentic".** Despite the name, `Agentation`
is a dev-only overlay resolving DOM elements back to source paths
(`config.ts:194-197`, `vite.config.ts:128-143`) and has nothing to do with the
agentic chat or with verify. It cost a wrong grep before I noticed.
