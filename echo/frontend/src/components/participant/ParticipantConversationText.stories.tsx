import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ServerSentEventMessage } from "msw";
import { HttpResponse, http, sse } from "msw";
import { userEvent, within } from "storybook/test";
import { withParticipantLayout } from "../../../.storybook/decorators";
import { ParticipantConversationText } from "./ParticipantConversationText";

const PROJECT_ID = "project-text-story";
const CONVERSATION_ID = "conversation-text-story";

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

const CHUNKS: TConversationChunk[] = [
	{
		id: "chunk-1",
		timestamp: new Date("2024-01-01T00:00:00Z"),
		transcript: "I think the river needs cleanup near the old bridge.",
	},
] as unknown as TConversationChunk[];

/** Rows shared by every story that wants a loaded page: project, conversation
 * and chunks (`ParticipantConversationText` reads all three directly), plus
 * an empty replies list (`ParticipantBody`, rendered inside, reads that key
 * on its own). */
const SEED: [readonly unknown[], unknown][] = [
	[["participantProject", PROJECT_ID], PROJECT],
	[["participant", "conversation", PROJECT_ID, CONVERSATION_ID], CONVERSATION],
	[["participant", "conversation_chunks", CONVERSATION_ID], CHUNKS],
	[["participant", "conversation_replies", CONVERSATION_ID], []],
];

const HEALTH_STREAM_PATH = "/api/conversations/health/stream";

/** `useConversationsHealthStream` opens a raw `EventSource`, which MSW's
 * `sse()` handler intercepts directly. See `ParticipantBody.stories.tsx` for
 * the fuller explanation of why a plain `http.get` handler won't catch it. */
const healthyStreamHandler = sse<{ ping: Record<string, unknown> }>(
	HEALTH_STREAM_PATH,
	({ client }) => {
		client.send({
			data: {},
			event: "ping",
		} as ServerSentEventMessage<{ ping: Record<string, unknown> }>);
	},
);

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
		msw: { handlers: [healthyStreamHandler, uploadTextHandler] },
		query: { seed: SEED },
		router: {
			path: `/en-US/${PROJECT_ID}/conversation/${CONVERSATION_ID}/text`,
			pattern: "/:language?/:projectId/conversation/:conversationId/text",
		},
	},
	title: "Participant/ParticipantConversationText",
} satisfies Meta<typeof ParticipantConversationText>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Everything loaded: existing chunks, empty textarea, Finish button visible
 * (chunks non-empty and text empty). Typing and pressing Submit genuinely
 * appends a message, driven by the optimistic cache update plus
 * `uploadTextHandler` above. */
export const Default: Story = {};

/** `?general_feedback=` (or `?feedback=`) prefills the textarea from the URL
 * on first render — a different entry path than a participant typing their
 * own text. */
export const PrefilledFromQueryParam: Story = {
	parameters: {
		router: {
			path: `/en-US/${PROJECT_ID}/conversation/${CONVERSATION_ID}/text?general_feedback=Loved the river tour, but the docks need attention.`,
		},
	},
};

/** Clicks the Finish button to open the confirmation modal. Mantine renders
 * `Modal` into a portal at the document root, so the assertion queries
 * `document.body` rather than the story's own canvas element. */
export const FinishModalOpen: Story = {
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
				healthyStreamHandler,
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
	parameters: {
		msw: {
			handlers: [
				healthyStreamHandler,
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
