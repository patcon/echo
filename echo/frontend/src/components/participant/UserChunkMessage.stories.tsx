import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import {
	withConversationOutlet,
	withParticipantLayout,
} from "../../../.storybook/decorators";
import UserChunkMessage from "./UserChunkMessage";

const PROJECT_ID = "project-chunk-story";
const CONVERSATION_ID = "conversation-chunk-story";

const chunk = (overrides: Partial<TConversationChunk>) =>
	({
		id: "chunk-1",
		timestamp: new Date("2024-01-01T00:00:00Z"),
		transcript: "I think the river needs cleanup near the old bridge.",
		...overrides,
	}) as unknown as TConversationChunk;

const deleteHandler = (status: number) =>
	http.delete(
		`/api/participant/projects/${PROJECT_ID}/conversations/${CONVERSATION_ID}/chunks/:chunkId`,
		() =>
			status === 200
				? HttpResponse.json({})
				: new HttpResponse(null, { status }),
	);

/**
 * One of the participant's own transcribed responses, right-aligned in the
 * conversation with a delete menu beside it.
 *
 * `projectId` and `conversationId` come off the route, not props, so the
 * router parameters below are what make the delete request resolve to a real
 * path.
 *
 * The delete is optimistic against the
 * `["participant", "conversation_chunks", id]` cache, which this component
 * doesn't read — its parent `ParticipantBody` does. So on failure the rollback
 * happens but is invisible here; the toast is the only feedback either way.
 */
const meta = {
	args: {
		chunk: chunk({}),
	},
	component: UserChunkMessage,
	decorators: [withConversationOutlet, withParticipantLayout],
	parameters: {
		layout: "fullscreen",
		msw: { handlers: [deleteHandler(200)] },
		router: {
			path: `/en-US/${PROJECT_ID}/conversation/${CONVERSATION_ID}`,
			pattern: "/:language/:projectId/conversation/:conversationId",
		},
	},
	title: "Participant/UserChunkMessage",
} satisfies Meta<typeof UserChunkMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A chunk that has arrived but carries no text yet. The bubble holds an italic
 * placeholder instead of collapsing or showing a spinner. */
export const AwaitingText: Story = {
	args: {
		chunk: chunk({ transcript: undefined }),
	},
};

/** A short answer. The text goes through `Markdown`, so whatever the chunk
 * carries is rendered as markdown rather than as plain text. */
export const ShortText: Story = {};

/** A long uninterrupted answer. The bubble has no width of its own, so the
 * conversation column is what wraps it. */
export const LongText: Story = {
	args: {
		chunk: chunk({
			transcript:
				"We started meeting at the bridge on Saturdays about two years ago, mostly neighbours, and at first it was just picking up what had washed against the pilings. Then the city put in the new storm drain upstream and the volume changed completely, so now we're pulling out things that clearly came from the industrial park rather than from the park itself.",
		}),
	},
};

/** Open the menu and delete. The request succeeds, so the chunk is removed from
 * the cache and a success toast appears. The bubble itself stays on screen:
 * only its parent list reads the cache this write clears. */
export const Playground: Story = {};

/** The delete request fails. The optimistic removal is rolled back and an error
 * toast appears. */
export const DeleteFails: Story = {
	parameters: {
		msw: { handlers: [deleteHandler(500)] },
	},
};

/** `hide` renders nothing at all. No caller passes it. */
export const Hidden: Story = {
	args: {
		hide: true,
	},
	tags: ["unused"],
};
