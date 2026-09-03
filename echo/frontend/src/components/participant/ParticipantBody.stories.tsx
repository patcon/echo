import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import type { ServerSentEventMessage } from "msw";
import { http, sse } from "msw";
import { useEffect } from "react";
import { withParticipantLayout } from "../../../.storybook/decorators";
import { ParticipantBody } from "./ParticipantBody";

const PROJECT_ID = "project-body-story";
const CONVERSATION_ID = "conversation-body-story";

const PROJECT = {
	default_conversation_title: "Tell us about your river cleanup experience",
	id: PROJECT_ID,
} as unknown as ParticipantProject;

const CHUNKS: TConversationChunk[] = [
	{
		id: "chunk-1",
		timestamp: new Date("2024-01-01T00:00:00Z"),
		transcript: "I think the river needs cleanup near the old bridge.",
	},
	{
		id: "chunk-2",
		timestamp: new Date("2024-01-01T00:02:00Z"),
		transcript: "There's also a lot of plastic waste by the docks.",
	},
] as unknown as TConversationChunk[];

const REPLIES: ConversationReply[] = [
	{
		content_text: "Thanks for sharing that — can you say more about the docks?",
		conversation_id: CONVERSATION_ID,
		date_created: "2024-01-01T00:01:00Z",
		id: "reply-1",
		reply: null,
		sort: null,
		type: "assistant_reply",
	},
];

/** `parameters.query.seed` rows shared by every story that wants a loaded
 * project with messages already in the conversation. */
const SEED: [readonly unknown[], unknown][] = [
	[["participantProject", PROJECT_ID], PROJECT],
	[["participant", "conversation_chunks", CONVERSATION_ID], CHUNKS],
	[["participant", "conversation_replies", CONVERSATION_ID], REPLIES],
];

const HEALTH_STREAM_PATH = "/api/conversations/health/stream";

/**
 * `useConversationsHealthStream` (`hooks/useConversationsHealthStream.ts:19-52`)
 * opens a raw `EventSource` with no React Query seam, so it can't be driven
 * via `parameters.query.seed` like the rest of `ParticipantBody`'s data.
 * MSW's `sse()` handler intercepts `EventSource` directly (a plain
 * `http.get` returning a streamed body does *not* catch it — `EventSource`
 * doesn't go through `fetch`/XHR) and leaves the connection open across
 * `resolver` calls, which is what keeps `sseConnectionHealthy` at its
 * default `true`: an `EventSource` fires `error` whenever its connection
 * closes, clean or not, so a resolver that returns would immediately flip a
 * story back to "unhealthy".
 */
type HealthStreamEventMap = {
	ping: Record<string, unknown>;
	health_update: { conversation_issue: string };
};

const healthStreamHandler = (
	events: {
		[K in keyof HealthStreamEventMap]: {
			event: K;
			data?: HealthStreamEventMap[K];
		};
	}[keyof HealthStreamEventMap][],
) =>
	sse<HealthStreamEventMap>(HEALTH_STREAM_PATH, ({ client }) => {
		for (const { event, data } of events) {
			client.send({
				data: data ?? {},
				event,
			} as ServerSentEventMessage<HealthStreamEventMap>);
		}
	});

const HEALTHY_STREAM_HANDLERS = [healthStreamHandler([{ event: "ping" }])];

/** `client.error()` makes the `EventSource` fire its native `error` event,
 * which is what actually flips `sseConnectionHealthy` to `false`
 * (`useConversationsHealthStream.ts:43-46`). */
const UNHEALTHY_STREAM_HANDLERS = [
	sse(HEALTH_STREAM_PATH, ({ client }) => {
		client.error();
	}),
];

/**
 * The `container mx-auto max-w-2xl` column with `p-4` padding both real call
 * sites wrap directly around `ParticipantBody`
 * (`ParticipantConversationAudio.tsx:747,922` and
 * `ParticipantConversationText.tsx:141,188-190`) — narrower than
 * `withParticipantLayout`'s shared height shell, and specific to this
 * component. Without it `ParticipantBody` renders full-bleed instead of the
 * centered, width-capped, padded column it gets in the real app.
 */
const withConversationMargins: Decorator = (Story) => (
	<div className="container mx-auto flex h-full max-w-2xl flex-col">
		<div className="relative flex-grow p-4">
			<Story />
		</div>
	</div>
);

const meta = {
	component: ParticipantBody,
	// Listed innermost-first: `withConversationMargins` nests inside
	// `withParticipantLayout`'s height shell, matching the real DOM order.
	decorators: [withConversationMargins, withParticipantLayout],
	parameters: {
		layout: "fullscreen",
		msw: { handlers: HEALTHY_STREAM_HANDLERS },
		query: { seed: SEED },
	},
	title: "Participant/ParticipantBody",
} satisfies Meta<typeof ParticipantBody>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Mirrors `ParticipantConversationAudioContent.tsx:136-142` — recording mode,
 * `interleaveMessages={false}` — so responses live behind the "View your
 * responses" button (`ParticipantBody.tsx:248-260`) instead of inline.
 */
export const Playground: Story = {
	args: {
		conversationId: CONVERSATION_ID,
		interleaveMessages: false,
		isRecording: true,
		projectId: PROJECT_ID,
	},
};

/**
 * Mirrors `ParticipantConversationText.tsx:192-197` — text mode, default
 * `interleaveMessages`, which renders `combinedMessages` chronologically
 * (`ParticipantBody.tsx:209-225`): user chunks and assistant replies
 * interleaved by timestamp.
 */
export const TextMode: Story = {
	args: {
		conversationId: CONVERSATION_ID,
		isAnonymized: false,
		projectId: PROJECT_ID,
		viewResponses: true,
	},
};

/**
 * `isAnonymized` swaps the instructional `SystemMessage` copy
 * (`ParticipantBody.tsx:193-205`) to mention the transcript being
 * anonymized.
 */
export const Anonymized: Story = {
	args: {
		conversationId: CONVERSATION_ID,
		isAnonymized: true,
		projectId: PROJECT_ID,
	},
};

/**
 * `default_conversation_description` is optional — when a host sets one it
 * renders as an extra `SystemMessage` above the instructions
 * (`ParticipantBody.tsx:183-191`).
 */
export const WithConversationDescription: Story = {
	args: {
		conversationId: CONVERSATION_ID,
		projectId: PROJECT_ID,
	},
	parameters: {
		query: {
			seed: [
				[
					["participantProject", PROJECT_ID],
					{
						...PROJECT,
						default_conversation_description:
							"We're gathering stories for the annual river cleanup report.",
					} as unknown as ParticipantProject,
				],
				...SEED.slice(1),
			],
		},
	},
};

/**
 * `interleaveMessages={false}` with no chunks yet — the "View your
 * responses" button only renders once `chunksQuery.data` is non-empty
 * (`ParticipantBody.tsx:250-260`), so nothing appears in its place.
 */
export const NoResponsesYet: Story = {
	args: {
		conversationId: CONVERSATION_ID,
		interleaveMessages: false,
		projectId: PROJECT_ID,
	},
	parameters: {
		query: {
			seed: [
				[["participantProject", PROJECT_ID], PROJECT],
				[["participant", "conversation_chunks", CONVERSATION_ID], []],
				[["participant", "conversation_replies", CONVERSATION_ID], []],
			],
		},
	},
};

/**
 * `interleaveMessages={false}` and `viewResponses` together render the
 * participant's own chunks inline, right-aligned, with no button or modal
 * (`ParticipantBody.tsx:226-247`) — distinct from the button+modal branch
 * `Playground` exercises.
 */
export const InlineResponses: Story = {
	args: {
		conversationId: CONVERSATION_ID,
		interleaveMessages: false,
		projectId: PROJECT_ID,
		viewResponses: true,
	},
};

/** Dispatches a synthetic `offline` event the way a real browser would
 * (`useOnlineStatus.ts:10`), which surfaces the "you seem to be offline"
 * `TipBanner` (`ParticipantBody.tsx:145-152`). */
const withOffline: Decorator = (Story) => {
	useEffect(() => {
		window.dispatchEvent(new Event("offline"));
		return () => {
			window.dispatchEvent(new Event("online"));
		};
	}, []);
	return <Story />;
};

export const Offline: Story = {
	args: {
		conversationId: CONVERSATION_ID,
		projectId: PROJECT_ID,
	},
	decorators: [withOffline],
};

/**
 * The health stream responds with a network error, so the `EventSource`
 * fires `error` and `sseConnectionHealthy` flips to `false`
 * (`useConversationsHealthStream.ts:43-46`) — both `ConnectionHealthStatus`
 * (only shown while `isRecording`, `ParticipantBody.tsx:134-143`) and the
 * "something went wrong" `TipBanner` (`ParticipantBody.tsx:154-160`) key off
 * this same value.
 */
export const ConnectionUnhealthy: Story = {
	args: {
		conversationId: CONVERSATION_ID,
		isRecording: true,
		projectId: PROJECT_ID,
	},
	parameters: {
		msw: { handlers: UNHEALTHY_STREAM_HANDLERS },
	},
};

/**
 * A `health_update` event with `conversation_issue: "HIGH_SILENCE"` drives
 * `useConversationIssueBanner` (`hooks/useConversationIssueBanner.ts`) to the
 * "picking up some silence" banner (`ParticipantBody.tsx:162-169`). The same
 * `healthStreamHandler` above accepts `"HIGH_CROSSTALK"` and `"HIGH_NOISE"`
 * for the other two banners — the icon/color/copy differ but the branch is
 * identical, so they're not given their own sidebar entries here.
 */
export const AudioIssueBanner: Story = {
	args: {
		conversationId: CONVERSATION_ID,
		projectId: PROJECT_ID,
	},
	parameters: {
		msw: {
			handlers: [
				healthStreamHandler([
					{
						data: { conversation_issue: "HIGH_SILENCE" },
						event: "health_update",
					},
				]),
			],
		},
	},
};

/**
 * The project fetch never resolves — `ParticipantBody` gates its entire chat
 * body on `projectQuery.data` (`ParticipantBody.tsx:177-296`), so only the
 * top banners and welcome image render, with a permanent gap where the
 * title/instructions/messages would be. Loading and error states look
 * identical here since neither is checked explicitly.
 */
export const ProjectLoading: Story = {
	args: {
		conversationId: CONVERSATION_ID,
		projectId: PROJECT_ID,
	},
	parameters: {
		msw: {
			handlers: [
				...HEALTHY_STREAM_HANDLERS,
				http.get(
					`/api/participant/projects/${PROJECT_ID}`,
					() => new Promise(() => {}),
				),
			],
		},
		query: { seed: [] },
	},
};
