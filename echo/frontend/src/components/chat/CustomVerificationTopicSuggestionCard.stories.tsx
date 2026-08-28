import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import type {
	VerificationTopicMetadata,
	VerificationTopicsResponse,
} from "@/lib/api";
import { CustomVerificationTopicSuggestionCard } from "./CustomVerificationTopicSuggestionCard";

/** Topics this fake project holds. Mutable so the POST handler's response, which
 * the mutation writes straight into the cache, includes what was just added.
 * Reset per story by `withTopics`. */
let topicsState: VerificationTopicMetadata[] = [];

const topicsResponse = (): VerificationTopicsResponse => ({
	available_topics: topicsState,
	selected_topics: [],
});

/** `lib/api` is axios with `baseURL: API_BASE_URL` (`api.ts:16`), the relative
 * `/api` locally, so this is a same-origin path like the bff ones. */
const topicHandlers = [
	http.post("/api/verify/topics/:projectId/custom", async ({ request }) => {
		const body = (await request.json()) as {
			label: string;
			prompt: string;
		};
		topicsState = [
			...topicsState,
			{
				is_custom: true,
				key: "custom_added_by_story",
				prompt: body.prompt,
				translations: { "en-US": { label: body.label } },
			},
		];
		return HttpResponse.json(topicsResponse());
	}),
];

/** The most editable card in the family, and the one whose proposal is a
 * standing instruction rather than a one-off change.
 *
 * A verification topic is a check the platform runs against every conversation
 * in the project. So when the assistant notices a question hosts keep asking by
 * hand, what it proposes here is not an answer — it is a prompt that will keep
 * being asked, of conversations that have not happened yet. That is a bigger
 * thing to accept than a tag or a goal, which is why this card is the only one
 * that hands the host both fields to rewrite before applying
 * (`CustomVerificationTopicSuggestionCard.tsx:130-145`) and spells out, in the
 * card, that nothing runs until verification is switched on (`:117-123`).
 *
 * As everywhere in this family, the agent does not write. The host applies,
 * through the normal custom-topic endpoint under their own session (`:74-77`).
 *
 * **Add works here.** The mutation posts through `lib/api`
 * (`api.ts:1740-1748`), which is axios and therefore XHR rather than fetch —
 * MSW intercepts both, so the handler below answers it. Clicking "Add
 * verification prompt" runs the real path: the response is written straight
 * into the topics cache by the mutation's `onSuccess`
 * (`project/hooks/index.ts:666-673`), the card re-derives `applied`, and it
 * switches to the added state.
 *
 * Because applied-ness is computed from the *edited* fields, editing the label
 * or prompt first and then adding also works, and the card recognises what it
 * just wrote. `Added` below still seeds the state directly, for the case where
 * you want to look at it without clicking.
 *
 * Provenance convention for this file: any claim that carries a `file:line` ref
 * was read out of that source. Anything without one is my own reading of the
 * code and should be checked before you rely on it. Every label, prompt and
 * reason below is written by me as plausible sample content; none of it comes
 * from the app or from real usage.
 */
const meta = {
	component: CustomVerificationTopicSuggestionCard,
	parameters: { msw: { handlers: topicHandlers } },
	title: "Chat/CustomVerificationTopicSuggestionCard",
} satisfies Meta<typeof CustomVerificationTopicSuggestionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const PROJECT_ID = "project-story";

const SUGGESTION = {
	label: "Named a specific street",
	projectId: PROJECT_ID,
	prompt:
		"Does the speaker name a specific street, junction or landmark, rather than talking about the town centre in general?",
	reason:
		"Eleven conversations mention problems 'in the centre' without saying where, and the transport team cannot act on those.",
};

/** The card reads live topics through `useVerificationTopicsQuery`
 * (`CustomVerificationTopicSuggestionCard.tsx:43`), so these stories seed that
 * query rather than run a backend. See `parameters.query` in
 * `.storybook/preview.tsx`.
 *
 * Unlike the goal card, this hook exports no key factory — the key is an inline
 * literal at `project/hooks/index.ts:647`, so the array below is a hand copy
 * and has to be kept in step with the hook by hand. If these stories ever start
 * rendering as un-applied for no reason, check that line first. */
const topicsKey = ["verify", "topics", PROJECT_ID] as const;

const customTopic = (
	label: string,
	prompt: string,
): VerificationTopicMetadata => ({
	is_custom: true,
	key: "custom_named_street",
	prompt,
	translations: { "en-US": { label } },
});

const seedTopics = (topics: VerificationTopicMetadata[]) => ({
	query: {
		seed: [
			[
				topicsKey,
				{
					available_topics: topics,
					selected_topics: [],
				} satisfies VerificationTopicsResponse,
			],
		],
	},
});

/** Seeded cache row for an instant first paint, plus a reset of the state the
 * POST handler appends to, so adding in one story does not leak into the next. */
const withTopics = (topics: VerificationTopicMetadata[]) => ({
	beforeEach: () => {
		topicsState = topics;
	},
	parameters: seedTopics(topics),
});

// ---------------------------------------------------------------------------
// The proposal
// ---------------------------------------------------------------------------

/** A project with no matching topic yet. Both fields are live: edit the name or
 * the prompt and the card stays a draft, because applied-ness is computed from
 * the edited values rather than the original suggestion
 * (`CustomVerificationTopicSuggestionCard.tsx:49-64`).
 *
 * The reason sits above the fields (`:114`) and is not editable and not sent —
 * it explains why the assistant is asking, and stops there. */
export const Proposed: Story = {
	args: { suggestion: SUGGESTION },
	name: "Proposed — reason given",
	...withTopics([]),
};

/** `reason` is optional in practice — the card only renders it when non-empty
 * (`CustomVerificationTopicSuggestionCard.tsx:114`), so a proposal that arrives
 * without one loses that line and nothing else. Worth reading beside
 * `Proposed` for how much of the card's persuasion lives in that one sentence. */
export const ProposedWithoutReason: Story = {
	args: { suggestion: { ...SUGGESTION, reason: "" } },
	name: "Proposed — no reason given",
	...withTopics([]),
};

// ---------------------------------------------------------------------------
// Added is derived, not stored
// ---------------------------------------------------------------------------

/** Same stateless-applied pattern as the rest of the family: no "I added this"
 * flag, just a scan of the live topics for a custom one whose label and prompt
 * match (`CustomVerificationTopicSuggestionCard.tsx:49-64`). A reload of an old
 * chat still tells the truth.
 *
 * Same args as `Proposed`; the only difference is the seeded topic list.
 *
 * Note what this state does *not* offer: any way to go and look at the topic it
 * just confirmed. The applied branch is an icon and one sentence
 * (`CustomVerificationTopicSuggestionCard.tsx:84-102`) — no link, nothing gated
 * on `workspaceId`. `GoalSuggestionCard` in the same position renders a View
 * button (`GoalSuggestionCard.tsx:76-88`).
 *
 * My reading, not sourced: this is the card where a link would matter most, and
 * it is the one without it. Applying here is not sufficient — the draft state
 * says so itself, that verification has to be enabled separately for the check
 * to run (`:117-123`). So "This verification prompt is added to your project"
 * can be true of a check that will never execute, with nothing on screen
 * pointing at the setting that decides. The goal card, whose applied state
 * really is terminal, is the one that links. */
export const Added: Story = {
	args: { suggestion: SUGGESTION },
	...withTopics([customTopic(SUGGESTION.label, SUGGESTION.prompt)]),
};

/** Three topics that all look like the suggestion and none of which count. The
 * card renders exactly as `Proposed` does, and that identity is the whole
 * finding: these topics are in the project, the host can see them in project
 * settings, and the card still offers to add another one.
 *
 * Each fails for a different reason, all in the same predicate
 * (`CustomVerificationTopicSuggestionCard.tsx:49-64`):
 *
 * - Same label in a different case, but the prompt is reworded. Labels are
 *   compared case-insensitively and trimmed, prompts trimmed only (`:52-53`,
 *   `:59-61`), so one changed word is a different check.
 * - Label and prompt both exact, but `is_custom` is false (`:53`). Built-ins are
 *   skipped outright.
 * - Label and prompt both exact, but no `en-US` translation, so the comparison
 *   falls back to the raw key (`:56-58`), which never matches a human-written
 *   label.
 *
 * My reading, not sourced: the label/prompt asymmetry looks deliberate rather
 * than accidental. A label is a handle and near enough is the same handle, but
 * a prompt is the instruction that actually runs, so two prompts that differ at
 * all are two different checks.
 *
 * Practical use: if you seed a topic and the card still says "Suggested", this
 * story is the list of reasons why before you go looking for a bug. */
export const NotAddedNearMisses: Story = {
	args: { suggestion: SUGGESTION },
	name: "Not added — three near misses",
	...withTopics([
		customTopic(
			SUGGESTION.label.toUpperCase(),
			"Does the speaker name a specific street or junction?",
		),
		{ ...customTopic(SUGGESTION.label, SUGGESTION.prompt), is_custom: false },
		{
			is_custom: true,
			key: "custom_named_street",
			prompt: SUGGESTION.prompt,
			translations: {},
		},
	]),
};

// ---------------------------------------------------------------------------
// Degenerate input
// ---------------------------------------------------------------------------

/** Empty fields leave "Add verification prompt" fully enabled. The guard is in
 * the handler, which returns early after a toast
 * (`CustomVerificationTopicSuggestionCard.tsx:65-70`). Same choice the goal
 * card makes, and the opposite of `InsightNoteCard`, which disables its button
 * on empty content instead (`InsightNoteCard.tsx:88,143`).
 *
 * This is the one story where clicking the button tells you something, because
 * it is the one place the toast is the card's own rather than the missing
 * backend's. Empty gets "Add a name and a prompt before applying" from the
 * guard; anywhere else the request goes out and comes back "Failed to create
 * custom topic". Two error toasts that look alike and mean opposite things —
 * one is the card working, the other is Storybook having no server.
 *
 * Reachable by clearing the fields in `Proposed` too; this story just starts
 * there. */
export const EmptyFields: Story = {
	args: { suggestion: { ...SUGGESTION, label: "", prompt: "" } },
	name: "Empty fields — button stays enabled",
	...withTopics([]),
};
