import { Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import type {
	VerificationArtifact,
	VerificationTopicsResponse,
} from "@/lib/api";
import {
	withConversationOutlet,
	withParticipantLayout,
} from "../../../.storybook/decorators";
import {
	CUSTOM_TOPIC,
	SEEDED_TOPICS,
} from "../../../.storybook/fixtures/verificationTopics";
import {
	asSegments,
	echoReplyHandler,
} from "../../../.storybook/mocks/echoReplyStream";
import { healthStreamHandler } from "../../../.storybook/mocks/healthStream";
import { ParticipantConversationAudioContent } from "./ParticipantConversationAudioContent";

const PROJECT_ID = "project-audio-story";
const CONVERSATION_ID = "conversation-audio-story";
const BASE_PATH = `/en-US/${PROJECT_ID}/conversation/${CONVERSATION_ID}`;

/** Recording seconds the verification banner needs, mirroring
 * `VERIFICATION_BANNER_THRESHOLD_SECONDS` in the component. */
const BANNER_THRESHOLD_SECONDS = 60;

const PROJECT = {
	default_conversation_title: "Tell us about your river cleanup experience",
	id: PROJECT_ID,
	is_verify_enabled: true,
	is_verify_on_finish_enabled: true,
	language: "en",
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
	{
		id: "chunk-2",
		timestamp: new Date("2024-01-01T00:02:00Z"),
		transcript: "There's also a lot of plastic waste by the docks.",
	},
] as unknown as TConversationChunk[];

const REPLIES: ConversationReply[] = [
	{
		content_text:
			"You've described two separate problem areas: the old bridge and the docks.",
		conversation_id: CONVERSATION_ID,
		date_created: "2024-01-01T00:01:00Z",
		id: "reply-1",
		reply: null,
		sort: null,
		type: "assistant_reply",
	},
];

const TOPICS: VerificationTopicsResponse = {
	available_topics: [...SEEDED_TOPICS, CUSTOM_TOPIC],
	selected_topics: [
		...SEEDED_TOPICS.map((topic) => topic.key),
		CUSTOM_TOPIC.key,
	],
};

const APPROVED_ARTEFACT: VerificationArtifact = {
	approved_at: "2026-09-04T14:32:00.000Z",
	content:
		"### Placeholder markdown content\n- something **bold**\n- something _italics_",
	conversation_id: CONVERSATION_ID,
	date_created: "2026-09-04T14:28:00.000Z",
	id: "artefact-1",
	key: "agreements",
	read_aloud_stream_url: "",
	topic_label: null,
};

const ECHO_REPLY =
	"The plastic waste at the docks sounds like it may have a different cause than the debris upstream. What have you seen there yourself?";

/** Seeds every row and answers every request behind it, so a refetch cannot
 * leave the cache and the network disagreeing.
 *
 * The conversation and chunk queries each carry `refetchInterval: 60000` baked
 * into the hook, independent of the query client's `staleTime` — so a story
 * left open for a minute polls both for real, and an unanswered poll 404s the
 * query, clears the seeded row and drops the screen onto its error state.
 *
 * `ParticipantBody` only mounts once the project *and* the conversation have
 * resolved, so both are always seeded. Artefacts vary per story: they are what
 * suppresses the verification banner. */
const withData = (artefacts: VerificationArtifact[]) => ({
	msw: {
		handlers: [
			healthStreamHandler([{ event: "ping" }]),
			http.get(`/api/participant/projects/${PROJECT_ID}`, () =>
				HttpResponse.json(PROJECT),
			),
			http.get(
				`/api/participant/projects/${PROJECT_ID}/conversations/${CONVERSATION_ID}`,
				() => HttpResponse.json(CONVERSATION),
			),
			http.get(
				`/api/participant/projects/${PROJECT_ID}/conversations/${CONVERSATION_ID}/chunks`,
				() => HttpResponse.json(CHUNKS),
			),
			http.get(`/api/verify/artifacts/${CONVERSATION_ID}`, () =>
				HttpResponse.json(artefacts),
			),
			http.get(`/api/verify/topics/${PROJECT_ID}`, () =>
				HttpResponse.json(TOPICS),
			),
			// Replies come through the Directus SDK rather than the API client, so
			// this one answer is wrapped in `{ data }`; the SDK unwraps it, while
			// every `/api/...` handler above returns its payload bare.
			http.get("*/directus/items/conversation_reply", () =>
				HttpResponse.json({ data: REPLIES }),
			),
		],
	},
	query: {
		seed: [
			[["participantProject", PROJECT_ID], PROJECT],
			[
				["participant", "conversation", PROJECT_ID, CONVERSATION_ID],
				CONVERSATION,
			],
			[["participant", "conversation_chunks", CONVERSATION_ID], CHUNKS],
			[["participant", "conversation_replies", CONVERSATION_ID], REPLIES],
			[["verify", "conversation_artifacts", CONVERSATION_ID], artefacts],
			[["verify", "topics", PROJECT_ID], TOPICS],
		] as [readonly unknown[], unknown][],
	},
});

/** `isRecording` and `recordingTime` reach the component through
 * `useOutletContext`, supplied by the audio route's `<Outlet context>`. */
const recording = (recordingTime: number) => ({
	outletContext: { isRecording: true, recordingTime },
	path: BASE_PATH,
	pattern: "/:language?/:projectId/conversation/:conversationId",
	// Destination the verification banner links to. `VerifySelection` is storied
	// separately; this only has to exist so the link resolves.
	routes: [
		{
			element: <Text p="lg">Verify screen (storied separately).</Text>,
			path: `${BASE_PATH}/verify`,
		},
	],
});

/**
 * The column a participant looks at while recording: `ParticipantBody`, the
 * approved outcomes so far, the verification banner and the echo reply.
 *
 * Two things live only at this level, and both are what these stories are for.
 *
 * The verification banner needs four conditions at once: both project verify
 * flags on, no approved artefact yet, and at least 60 recorded seconds. The
 * banner and the artefacts list read the same query from opposite ends, so
 * they can never appear together.
 *
 * The echo reply is only ever triggered by arriving on `?echo=1`, which
 * `RefineSelection` navigates to after a participant picks a refinement.
 * Nothing in this component or its parent renders a reply button, so a story
 * without the param never reaches the reply path at all.
 */
const meta = {
	component: ParticipantConversationAudioContent,
	decorators: [withConversationOutlet, withParticipantLayout],
	parameters: {
		layout: "fullscreen",
		...withData([]),
		router: recording(BANNER_THRESHOLD_SECONDS),
	},
	title: "Participant/ParticipantConversationAudioContent",
} satisfies Meta<typeof ParticipantConversationAudioContent>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Fully wired. Arrives on `?echo=1` the way a return from `RefineSelection`
 * does, so the mount effect fires a real `useChat` request and the reply
 * streams in a segment at a time, then the param is stripped from the URL.
 * The only story that runs the reply path end to end. */
export const Playground: Story = {
	parameters: {
		layout: "fullscreen",
		...withData([]),
		msw: {
			handlers: [
				echoReplyHandler(CONVERSATION_ID, { segments: asSegments(ECHO_REPLY) }),
				...withData([]).msw.handlers,
			],
		},
		router: { ...recording(30), path: `${BASE_PATH}?echo=1` },
	},
};

/** The resting state for most of a conversation: recording, but under the
 * threshold, with nothing verified yet. Both the banner and the artefacts list
 * are absent, and the list renders nothing at all rather than an empty shell. */
export const Recording: Story = {
	parameters: {
		layout: "fullscreen",
		...withData([]),
		router: recording(30),
	},
};

/** Past 60 recorded seconds with both verify flags on and nothing approved
 * yet: the dashed banner appears, linking through to the verify screen. */
export const VerificationRequired: Story = {};

/** One outcome approved. The same query that populates the list is what
 * suppresses the banner, so verifying anything at all replaces the prompt with
 * the thing it was asking for. */
export const VerifiedOutcomes: Story = {
	parameters: {
		layout: "fullscreen",
		...withData([APPROVED_ARTEFACT]),
		router: recording(BANNER_THRESHOLD_SECONDS),
	},
};

/** Recording stopped after more than a minute, nothing verified.
 *
 * `stopRecording` resets `recordingTime` to 0, so this component's own
 * threshold check fails and the banner disappears at exactly the moment
 * verification is due. The parent route keeps its own copy of the same four
 * conditions but reads `stoppedRecordingTime ?? recordingTime`, so its finish
 * flow still requires verification. Only the banner is lost. */
export const Stopped: Story = {
	parameters: {
		layout: "fullscreen",
		...withData([]),
		router: {
			...recording(0),
			outletContext: { isRecording: false, recordingTime: 0 },
		},
	},
};

/** The backend waits 20 seconds for a first chunk and then emits a single
 * `high_load` status frame. `useLoadNotification` turns that into a toast; the
 * reply itself follows normally afterwards. Nothing else exercises that hook,
 * whose return value this component discards. */
export const HighLoad: Story = {
	parameters: {
		layout: "fullscreen",
		...withData([]),
		msw: {
			handlers: [
				echoReplyHandler(CONVERSATION_ID, {
					delayMs: 600,
					segments: asSegments(ECHO_REPLY),
					statusEvent: {
						message: "High demand. Still working on your request...",
						type: "high_load",
					},
				}),
				...withData([]).msw.handlers,
			],
		},
		router: { ...recording(30), path: `${BASE_PATH}?echo=1` },
	},
};
