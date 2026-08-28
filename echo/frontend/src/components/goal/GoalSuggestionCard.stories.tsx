import { Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import { fn, userEvent, within } from "storybook/test";
import { GoalSuggestionCard } from "./GoalSuggestionCard";
import {
	type ProjectGoalResponse,
	type ProjectGoalRevision,
	projectGoalQueryKeys,
} from "./hooks";

/** The goal this fake project currently holds. Mutable on purpose: the POST
 * handler writes it and the GET handler reads it, so a save and the refetch
 * that follows it agree. Reset per story by `withGoal`. */
let goalState: ProjectGoalRevision | null = null;

const revisionFor = (content: string): ProjectGoalRevision => ({
	content,
	created_at: new Date("2026-03-04T10:12:00Z").toISOString(),
	id: "goal-revision-applied",
	set_by: "interview",
});

/** Handlers for the two endpoints this card touches. Paths are written against
 * `API_BASE_URL`, which is the relative `/api` locally (`config.ts:90-93`) and
 * is resolved by `bff.ts` against the page origin — so in Storybook these are
 * same-origin paths, not a backend host. */
const goalHandlers = [
	http.get("/api/v2/bff/projects/:projectId/goal", () =>
		HttpResponse.json({
			current: goalState,
			revisions: goalState ? [goalState] : [],
		} satisfies ProjectGoalResponse),
	),
	http.post("/api/v2/bff/projects/:projectId/goal", async ({ request }) => {
		const body = (await request.json()) as { content: string };
		goalState = revisionFor(body.content);
		return HttpResponse.json(goalState);
	}),
];

/** The other half of the idea `InsightNoteCard` shows.
 *
 * Both cards are the assistant proposing rather than answering, but they point
 * in opposite directions: an insight note is drafted to leave the project and
 * reach the dembrane team, while a goal proposal is drafted to be written back
 * into the project itself. This is the card where the assistant says "here is
 * what I think you are actually trying to do" and the host either agrees or
 * does not.
 *
 * The agent never writes the goal. The host applies it, through the normal
 * save-goal mutation under their own session (`GoalSuggestionCard.tsx:51-55`),
 * and the saved revision keeps `set_by: "interview"` plus the chat id it came
 * from — so the goal history records that this wording was the assistant's
 * suggestion and not something the host typed.
 *
 * **Apply works here.** The save mutation posts to the real BFF endpoint
 * (`goal/hooks/index.ts:74-77`), which MSW answers, so clicking Apply on
 * `Proposed` runs the genuine path: request, `onSuccess` writes the new
 * revision into the query cache (`:81-91`), the card re-derives `applied` and
 * switches to the saved state. Nothing is faked past the network boundary.
 *
 * The handlers are backed by one mutable `goalState` below, so the invalidation
 * that follows the save (`:92`) refetches and gets the goal that was just
 * written rather than contradicting it. Each story resets that state in
 * `beforeEach`, which is what keeps applying in one story out of the next.
 *
 * Provenance convention for this file: any claim that carries a `file:line` ref
 * was read out of that source. Anything without one is my own reading of the
 * code and should be checked before you rely on it. Every goal text below is
 * written by me as plausible sample content; none of it comes from the app or
 * from real usage.
 */
const meta = {
	component: GoalSuggestionCard,
	parameters: {
		msw: { handlers: goalHandlers },
		// The applied state renders a View button that navigates
		// (`GoalSuggestionCard.tsx:79-83`), and `useI18nNavigate` prefixes the
		// language. Without a matching route the memory router has nowhere to
		// land and react-router renders its own "404 Not Found" dev page over
		// the canvas, which reads like a broken story rather than a working
		// button. Same fix `NavigationSuggestionCard.stories.tsx` uses.
		router: {
			routes: [
				{
					element: <Text p="lg">Project overview reached.</Text>,
					path: "/:language/w/:workspaceId/projects/:projectId/overview",
				},
			],
		},
	},
	title: "Chat/GoalSuggestionCard",
} satisfies Meta<typeof GoalSuggestionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const PROJECT_ID = "project-story";

const SUGGESTED_GOAL =
	"Understand what stops people cycling to the market on weekdays, in enough detail that the transport team can act on it before the spring budget.";

/** The card reads server state through `useProjectGoal`
 * (`GoalSuggestionCard.tsx:32`), so these stories seed that one query rather
 * than run a backend. The key comes from the hook's own exported factory
 * (`goal/hooks/index.ts:25`), so it cannot drift out of step with the hook.
 *
 * See `parameters.query` in `.storybook/preview.tsx` for the seam. */
const goalQuery = (content: string | null): ProjectGoalResponse => ({
	current: content
		? {
				content,
				created_at: "2026-03-04T10:12:00Z",
				id: "goal-revision-1",
				set_by: "you",
			}
		: null,
	revisions: [],
});

const seedGoal = (content: string | null) => ({
	query: {
		seed: [[projectGoalQueryKeys.detail(PROJECT_ID), goalQuery(content)]],
	},
});

/** Everything a story needs to start from a given goal: the seeded cache row so
 * the first paint is instant and deterministic, and the reset of the server-side
 * state the handlers read. */
const withGoal = (
	content: string | null,
	extraParameters: Record<string, unknown> = {},
) => ({
	beforeEach: () => {
		goalState = content ? revisionFor(content) : null;
	},
	parameters: { ...seedGoal(content), ...extraParameters },
});

// ---------------------------------------------------------------------------
// The proposal
// ---------------------------------------------------------------------------

/** A project with no goal set yet. The suggestion renders in quotes
 * (`GoalSuggestionCard.tsx:108`) — the wording is attributed to the assistant,
 * not presented as already yours.
 *
 * Dismiss and Apply are both live. Dismissal is local state (`:35`) with a
 * "Review again" way back (`:127-134`), so nothing is lost by clicking it;
 * there is no persisted "the host said no" anywhere.
 *
 * A project that already *has* a goal renders this card identically, which is
 * worth knowing and is why there is no separate story for it: the card never
 * names the goal it would displace, never shows the two side by side, and
 * offers the same unqualified Apply either way. Its only comparison with
 * existing state is the equality check deciding whether to show the applied
 * state at all (`:36-41`). Not necessarily wrong — applying adds a revision
 * rather than overwriting, so the old wording survives in `revisions`
 * (`goal/hooks/index.ts:19`) — but the host cannot see that from here. */
export const Proposed: Story = {
	args: {
		chatId: "chat-story",
		onApplied: fn(),
		suggestion: { content: SUGGESTED_GOAL, projectId: PROJECT_ID },
	},
	...withGoal(null),
};

/** Dismissal is the one state with no seam at all: `dismissed` is local
 * `useState` (`GoalSuggestionCard.tsx:34`) with no prop and nothing persisted,
 * so it cannot be reached by args or by seeding. This story clicks the button
 * instead, in a `play` function.
 *
 * The state is worth showing because it is more than a hidden card. Dismissing
 * takes the goal text away (`:109`), swaps Dismiss for "Review again"
 * (`:126-131`) and removes Apply entirely (`:133`), leaving a "Dismissed" badge
 * (`:102-104`). So the host is left holding a card that no longer says what it
 * was proposing — you have to click back in to read it again.
 *
 * Nothing leaves the browser: there is no persisted "the host said no" anywhere,
 * so a reload brings the proposal straight back. My reading, not sourced: that
 * is why the copy says "Review again" rather than anything more final.
 *
 * `play` runs on core Storybook without the interactions addon; `.storybook/
 * main.ts` still has `addons: []`, so there is no step-through panel, the click
 * just happens on load. */
export const Dismissed: Story = {
	args: {
		chatId: "chat-story",
		onApplied: fn(),
		suggestion: { content: SUGGESTED_GOAL, projectId: PROJECT_ID },
	},
	...withGoal(null),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole("button", { name: "Dismiss" }),
		);
	},
};

// ---------------------------------------------------------------------------
// Applied is derived, not stored
// ---------------------------------------------------------------------------

/** The card holds no "I applied this" flag on the server. It compares its own
 * suggestion to the project's live goal (`GoalSuggestionCard.tsx:36-41`), so a
 * reload of an old chat still tells the truth and the host cannot apply the
 * same goal twice. Same stateless-applied pattern `InsightNoteCard` uses for
 * sent insights (`InsightNoteCard.tsx:75-81`) and `TagsUpdateSuggestionCard`
 * for tags — a house convention across the card family, not a one-off.
 *
 * The suggestion here is deliberately padded with leading spaces and a trailing
 * newline while the seeded goal is clean, so this story also stands on the
 * comparison being trimmed on both sides (`:38-40`). Untrimmed, it would fall
 * back to the proposal — which is the visible way to notice if that trim ever
 * goes away.
 *
 * View is live: it navigates to the project overview, which the meta gives the
 * router a landing route for. */
export const Applied: Story = {
	args: {
		chatId: "chat-story",
		onApplied: fn(),
		suggestion: { content: `  ${SUGGESTED_GOAL}\n`, projectId: PROJECT_ID },
	},
	...withGoal(SUGGESTED_GOAL),
};

/** The applied card offers a way to go look at the goal, but only when there is
 * a workspace in the URL to build the link from (`GoalSuggestionCard.tsx:83`).
 * This story mounts at a route with no `:workspaceId`, and the View button
 * drops out.
 *
 * My reading, not sourced: the guard exists because `workspaceId` comes from
 * `useParams` rather than from the suggestion, so any surface rendering this
 * card outside a workspace route would otherwise build `/w/undefined/...`. */
export const AppliedWithoutWorkspaceRoute: Story = {
	args: {
		chatId: "chat-story",
		onApplied: fn(),
		suggestion: { content: SUGGESTED_GOAL, projectId: PROJECT_ID },
	},
	name: "Applied — no workspace in route",
	...withGoal(SUGGESTED_GOAL, {
		router: {
			path: "/en-US/chats/chat-story",
			pattern: "/:language/chats/:chatId",
		},
	}),
};

// ---------------------------------------------------------------------------
// Degenerate input
// ---------------------------------------------------------------------------

/** A whitespace-only suggestion against a project with no goal, which produces
 * a card claiming "Saved as this project's goal." Nothing was saved and there is
 * nothing to save.
 *
 * The applied check compares trimmed strings and folds "no goal" into the empty
 * string (`GoalSuggestionCard.tsx:37-42`):
 *
 *     (goalQuery.data?.current?.content ?? "").trim() === normalizedSuggestion
 *
 * `current` is null, so the left side is `""`. The suggestion trims to `""`.
 * They match, `applied` is true, and the card renders its success branch
 * (`:64-90`). Two conflations on that one line: "no goal" versus "empty
 * proposal", and "query not resolved yet" versus "no goal" — `data` is
 * undefined during load, so the same false applied state appears transiently
 * even on a project that does have a goal.
 *
 * **Latent, not live.** The card is constructed in one place
 * (`AgenticChatPanel.tsx:1947-1950`), always through `parseGoalSuggestion`,
 * which trims the content and returns null when it is empty
 * (`agenticToolActivity.ts:528-529`). So no empty proposal ever reaches this
 * component today and no host can see this state.
 *
 * What it costs is robustness rather than correctness: the component is only
 * safe because a guard in a different file happens to hold, and it does not
 * know that. A second construction site — another tool, a test, anything
 * rendering the card directly — reintroduces it with no warning. Together with
 * `EmptySuggestionOverExistingGoal` this is one gap, not two: the card has no
 * handling for an empty suggestion, and the two stories are the two shapes that
 * absence takes.
 *
 * The fix that covers both is to refuse the input rather than patch the
 * comparison: an early `if (!normalizedSuggestion) return null;` would make the
 * component agree with its own parser. Not changed on this branch — stories
 * branch, app behaviour. */
export const EmptySuggestion: Story = {
	args: {
		chatId: "chat-story",
		onApplied: fn(),
		suggestion: { content: "   ", projectId: PROJECT_ID },
	},
	name: "Empty suggestion — false applied state (latent defect)",
	...withGoal(null),
};

/** The same empty suggestion against a project that does have a goal — the
 * second face of the gap above, and just as unreachable
 * (`agenticToolActivity.ts:528-529`).
 *
 * Here the comparison fails, so the card renders as a proposal: an empty pair
 * of quotation marks where the goal text should be (`GoalSuggestionCard.tsx:108`)
 * over a fully enabled Apply button that will refuse the click. The guard is in
 * the handler, which returns early after a toast (`:44-48`).
 *
 * Two things worth separating. That the button is enabled at all is a live
 * inconsistency: `InsightNoteCard` disables its button on empty content
 * (`InsightNoteCard.tsx:88,143`), this one does not, and that difference is
 * real regardless of whether an empty proposal can arrive. That the card
 * renders empty quotes is the latent half.
 *
 * This is also the only story in the file where clicking Apply produces the
 * card's own message, "Add goal text before applying", rather than completing
 * against MSW. */
export const EmptySuggestionOverExistingGoal: Story = {
	args: {
		chatId: "chat-story",
		onApplied: fn(),
		suggestion: { content: "   ", projectId: PROJECT_ID },
	},
	name: "Empty suggestion — empty quotes, Apply refuses (latent defect)",
	...withGoal("Find out about cycling in the town centre."),
};
