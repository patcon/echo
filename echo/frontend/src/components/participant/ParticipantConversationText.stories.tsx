import { Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import { userEvent, within } from "storybook/test";
import { withParticipantLayout } from "../../../.storybook/decorators";
import { healthStreamHandler } from "../../../.storybook/mocks/healthStream";
import { ParticipantConversationText } from "./ParticipantConversationText";

const PROJECT_ID = "project-text-story";
const CONVERSATION_ID = "conversation-text-story";
const BASE_PATH = `/en-US/${PROJECT_ID}/conversation/${CONVERSATION_ID}/text`;

const PROJECT = {
	default_conversation_title: "Tell us about your river cleanup experience",
	id: PROJECT_ID,
	language: "en",
	tags: [],
} as unknown as ParticipantProject;

const CONVERSATION = {
	id: CONVERSATION_ID,
	is_anonymized: false,
	project_id: PROJECT_ID,
} as unknown as Conversation;

const FIRST_CHUNK: TConversationChunk = {
	id: "chunk-1",
	timestamp: new Date("2024-01-01T00:00:00Z"),
	transcript: "I think the river needs cleanup near the old bridge.",
} as unknown as TConversationChunk;

/** Rows every story starts from: project, conversation and an empty replies
 * list (`ParticipantBody`, rendered inside, reads that key on its own).
 * Chunks are seeded per-story since the Finish button's visibility and the
 * page's overall narrative both hinge on whether any exist yet. */
const baseSeed = (
	chunks: TConversationChunk[],
): [readonly unknown[], unknown][] => [
	[["participantProject", PROJECT_ID], PROJECT],
	[["participant", "conversation", PROJECT_ID, CONVERSATION_ID], CONVERSATION],
	[["participant", "conversation_chunks", CONVERSATION_ID], chunks],
	[["participant", "conversation_replies", CONVERSATION_ID], []],
];

/** `useConversationQuery` and `useConversationChunksQuery` both carry a
 * `refetchInterval: 60000` baked into the hooks, independent of the query
 * client's `staleTime` — so a story left open for a minute polls these for
 * real, and `useConversationChunksQuery` also runs unconditionally on mount
 * (hooks can't be gated on another query's result). With no handler that
 * poll 404s, which flips the query to an error state and clears the seeded
 * data, landing on the "something went wrong" page. These answer the poll
 * with the same chunks the story seeded, so it re-affirms rather than
 * erroring. */
const conversationPollHandler = http.get(
	`/api/participant/projects/${PROJECT_ID}/conversations/${CONVERSATION_ID}`,
	() => HttpResponse.json(CONVERSATION),
);

const chunksPollHandler = (chunks: TConversationChunk[]) =>
	http.get(
		`/api/participant/projects/${PROJECT_ID}/conversations/${CONVERSATION_ID}/chunks`,
		() => HttpResponse.json(chunks),
	);

/** Bundles a chunk list's seed and poll handlers together, so a story
 * seeding N chunks can't drift from what its background poll answers with —
 * see the comment above for why that poll needs a real answer at all. */
const withChunks = (chunks: TConversationChunk[]) => ({
	msw: {
		handlers: [
			healthStreamHandler([{ event: "ping" }]),
			uploadTextHandler,
			conversationPollHandler,
			chunksPollHandler(chunks),
		],
	},
	query: { seed: baseSeed(chunks) },
});

/** Real endpoint `useUploadConversationTextChunk` posts to. The mutation
 * already updates the chunks cache optimistically on `onMutate`, so this
 * handler only needs to keep the retry (`retry: 10`) from firing against a
 * 404 in the background after every submit. */
const uploadTextHandler = http.post(
	"/api/participant/conversations/:conversationId/upload-text",
	async ({ request, params }) => {
		const body = (await request.json()) as { content: string };
		return HttpResponse.json({
			conversation_id: params.conversationId as string,
			id: `chunk-${Date.now()}`,
			timestamp: new Date(),
			transcript: body.content,
		} satisfies Partial<TConversationChunk>);
	},
);

const meta = {
	component: ParticipantConversationText,
	decorators: [withParticipantLayout],
	parameters: {
		layout: "fullscreen",
		...withChunks([]),
		router: {
			path: BASE_PATH,
			pattern: "/:language?/:projectId/conversation/:conversationId/text",
			// Pressing "Yes" in the finish modal navigates here for real
			// (`ParticipantConversationText.tsx`'s `handleConfirmFinishButton`).
			// A placeholder stands in for the actual next screen
			// (`ParticipantPostConversation`), which isn't storied yet — link to
			// its story here once it is.
			routes: [
				{
					element: <Text p="lg">Conversation finished (not storied yet).</Text>,
					path: `/en-US/${PROJECT_ID}/conversation/${CONVERSATION_ID}/finish`,
				},
			],
		},
	},
	title: "Participant/ParticipantConversationText",
} satisfies Meta<typeof ParticipantConversationText>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The very first thing a participant sees: no chunks submitted yet, empty
 * textarea. The Finish button has nothing to gate on yet, so it's absent. */
export const FreshArrival: Story = {
	name: "Fresh Arrival",
};

/** Typed into the textarea but not yet submitted — still no chunks, so
 * Finish stays absent even though there's now text on screen. */
export const TypedFirstText: Story = {
	name: "Typed First Text",
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(
			await canvas.findByTestId("portal-text-input-textarea"),
			"There's also a lot of plastic waste by the docks.",
		);
	},
};

/** The resting state right after a submit: one chunk on the conversation,
 * textarea cleared, Finish now visible. */
export const SubmittedFirstText: Story = {
	name: "Submitted First Text",
	parameters: withChunks([FIRST_CHUNK]),
};

/** A chunk already exists, and the participant has started typing another —
 * Finish disappears again while there's unsent text, even though a finished
 * conversation (one chunk) already exists underneath. */
export const TypedMoreText: Story = {
	name: "Typed More Text",
	parameters: withChunks([FIRST_CHUNK]),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(
			await canvas.findByTestId("portal-text-input-textarea"),
			"There's also erosion near the boat launch.",
		);
	},
};

/** `?general_feedback=` (or `?feedback=`) prefills the textarea from the URL
 * on first render — a participant arriving via a feedback link rather than
 * typing their own opener. */
export const PrefilledFromQueryParam: Story = {
	name: "Prefilled From Query Param",
	parameters: {
		router: {
			path: `${BASE_PATH}?general_feedback=Loved the river tour, but the docks need attention.`,
		},
	},
};

/** Clicks the Finish button to open the confirmation modal. Mantine renders
 * `Modal` into a portal at the document root, so the assertion queries
 * `document.body` rather than the story's own canvas element. */
export const FinishConfirmModal: Story = {
	name: "Finish Confirm Modal",
	parameters: withChunks([FIRST_CHUNK]),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByTestId("portal-text-finish-button"),
		);
		await within(document.body).findByTestId("portal-text-finish-modal");
	},
};

/** Conversation and project queries never resolve, so the page sits on
 * `LoadingOverlay` rather than reaching either the loaded or error branch. */
export const Loading: Story = {
	parameters: {
		msw: {
			handlers: [
				healthStreamHandler([{ event: "ping" }]),
				chunksPollHandler([]),
				http.get(
					`/api/participant/projects/${PROJECT_ID}/conversations/${CONVERSATION_ID}`,
					() => new Promise(() => {}),
				),
			],
		},
		query: { seed: [] },
	},
};

/** The conversation fetch fails (404), which the page renders as a plain
 * "Something went wrong" panel with a reload button and, since a sharing
 * link is available for this project, a "Start New Conversation" button. */
export const LoadError: Story = {
	name: "Load Error",
	parameters: {
		msw: {
			handlers: [
				healthStreamHandler([{ event: "ping" }]),
				chunksPollHandler([]),
				http.get(
					`/api/participant/projects/${PROJECT_ID}/conversations/${CONVERSATION_ID}`,
					() => HttpResponse.json({ error: "not found" }, { status: 404 }),
				),
			],
		},
		query: {
			seed: [[["participantProject", PROJECT_ID], PROJECT]],
		},
	},
};
