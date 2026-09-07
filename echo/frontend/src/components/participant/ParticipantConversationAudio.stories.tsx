import { Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { VerificationTopicsResponse } from "@/lib/api";
import { withParticipantLayout } from "../../../.storybook/decorators";
import {
	CUSTOM_TOPIC,
	SEEDED_TOPICS,
} from "../../../.storybook/fixtures/verificationTopics";
import { healthStreamHandler } from "../../../.storybook/mocks/healthStream";
import { ParticipantConversationAudio } from "./ParticipantConversationAudio";
import { ParticipantConversationAudioContent } from "./ParticipantConversationAudioContent";

const PROJECT_ID = "project-audio-container-story";
const CONVERSATION_ID = "conversation-audio-container-story";
const BASE_PATH = `/en-US/${PROJECT_ID}/conversation/${CONVERSATION_ID}`;

/** Presigned-upload stand-ins the chunk upload walks through: the API hands
 * back an upload URL, the browser posts the blob there, then the API confirms.
 * Same-origin so MSW answers them. */
const UPLOAD_URL = "/story-s3-upload";
const PROBE_URL = "/story-s3-probe";

const PROJECT = {
	default_conversation_title: "Tell us about your river cleanup experience",
	id: PROJECT_ID,
	is_get_reply_enabled: true,
	is_verify_enabled: true,
	is_verify_on_finish_enabled: true,
	language: "en",
} as unknown as ParticipantProject;

const CONVERSATION = {
	id: CONVERSATION_ID,
	is_anonymized: false,
	project_id: PROJECT_ID,
} as unknown as Conversation;

const CHUNK: TConversationChunk = {
	id: "chunk-1",
	timestamp: new Date("2024-01-01T00:00:00Z"),
	transcript: "I think the river needs cleanup near the old bridge.",
} as unknown as TConversationChunk;

const TOPICS: VerificationTopicsResponse = {
	available_topics: [...SEEDED_TOPICS, CUSTOM_TOPIC],
	selected_topics: [
		...SEEDED_TOPICS.map((topic) => topic.key),
		CUSTOM_TOPIC.key,
	],
};

/** Chunks the handlers serve. A chunk uploaded mid-story is appended here, so
 * it survives the refetch its own confirmation kicks off. Reset per story. */
let storyChunks: TConversationChunk[] = [];

/** Everything behind the screen except the S3 reachability check, which each
 * story sets separately since a failed check is a state of its own.
 *
 * The conversation and chunk queries both carry `refetchInterval: 60000` from
 * their hooks, so a story left open for a minute polls for real and an
 * unanswered poll 404s the query onto the error view. The liveness beacon
 * posts every 3 seconds while `ENABLE_MONITOR` is on. */
const baseHandlers = [
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
		() => HttpResponse.json(storyChunks),
	),
	http.get(`/api/verify/artifacts/${CONVERSATION_ID}`, () =>
		HttpResponse.json([]),
	),
	http.get(`/api/verify/topics/${PROJECT_ID}`, () => HttpResponse.json(TOPICS)),
	// Replies come through the Directus SDK, which unwraps `{ data }`; every
	// `/api/...` handler here returns its payload bare.
	http.get("*/directus/items/conversation_reply", () =>
		HttpResponse.json({ data: [] }),
	),
	http.post(
		`/api/participant/conversations/${CONVERSATION_ID}/ping`,
		() => new HttpResponse(null, { status: 204 }),
	),
	http.post(`/api/participant/conversations/${CONVERSATION_ID}/finish`, () =>
		HttpResponse.json({ status: "ok" }),
	),
	http.post(
		`/api/participant/conversations/${CONVERSATION_ID}/get-upload-url`,
		() =>
			HttpResponse.json({
				chunk_id: `chunk-${storyChunks.length + 1}`,
				fields: {},
				file_url: "https://example.invalid/story-chunk.webm",
				upload_url: UPLOAD_URL,
			}),
	),
	http.post(UPLOAD_URL, () => new HttpResponse(null, { status: 204 })),
	http.post(
		`/api/participant/conversations/${CONVERSATION_ID}/confirm-upload`,
		async ({ request }) => {
			const body = (await request.json()) as {
				chunk_id: string;
				timestamp: string;
			};
			const chunk = {
				conversation_id: CONVERSATION_ID,
				id: body.chunk_id,
				timestamp: body.timestamp,
				transcript: "This is a transcript of the audio just recorded.",
			} as unknown as TConversationChunk;
			storyChunks = [...storyChunks, chunk];
			return HttpResponse.json(chunk);
		},
	),
];

/** A reachable bucket: the API hands out a probe URL and the probe succeeds,
 * which is what releases the Record button from its loading state. */
const s3PassHandlers = [
	http.post(`/api/participant/conversations/${CONVERSATION_ID}/check-s3`, () =>
		HttpResponse.json({ probe_url: PROBE_URL }),
	),
	http.put(PROBE_URL, () => new HttpResponse(null, { status: 200 })),
];

/** Rows the screen would otherwise open on a spinner for. Chunks are declared
 * per story: whether any exist is what shows the Finish button. */
const seed = (chunks: TConversationChunk[]) =>
	[
		[["participantProject", PROJECT_ID], PROJECT],
		[
			["participant", "conversation", PROJECT_ID, CONVERSATION_ID],
			CONVERSATION,
		],
		[["participant", "conversation_chunks", CONVERSATION_ID], chunks],
		[["participant", "conversation_replies", CONVERSATION_ID], []],
		[["verify", "conversation_artifacts", CONVERSATION_ID], []],
		[["verify", "topics", PROJECT_ID], TOPICS],
	] as [readonly unknown[], unknown][];

/** Starts a story from the chunks it declares, keeping the cache and the
 * handlers in step so the first refetch can't contradict the story.
 *
 * `useS3ConnectivityCheck` caches a pass in session storage under the
 * conversation id, which would otherwise let the first story that passes skip
 * the check for every story opened after it. */
const fromChunks = (chunks: TConversationChunk[]) => ({
	beforeEach: () => {
		storyChunks = chunks;
		sessionStorage.removeItem(`s3-check-${CONVERSATION_ID}`);
	},
	parameters: { query: { seed: seed(chunks) } },
});

/** Presses Record and waits for the timer, the way into every recording state
 * below.
 *
 * The button exists before it works: it renders disabled and loading until the
 * S3 reachability check answers, and a click landing in that window is
 * silently dropped, leaving the story on its idle state with no error. */
const startRecording = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	const recordButton = await canvas.findByTestId("portal-audio-record-button");
	await waitFor(() => expect(recordButton).toBeEnabled());
	await userEvent.click(recordButton);
	await canvas.findByTestId("portal-audio-recording-timer");
};

/**
 * The recorder container: everything around the conversation column, plus the
 * whole recording lifecycle. `ParticipantConversationAudioContent` (storied
 * separately) is what its `<Outlet />` renders, included here so the screen
 * reads whole.
 *
 * Recording runs for real. `parameters.media` supplies a fake microphone and
 * `parameters.recorder` a fake `MediaRecorder`, so the hook, the timer, the
 * chunking and the presigned upload chain all behave as they do on a device,
 * only at a cadence a story can show. The timer starts at zero and ticks in
 * real time, so the ECHO button's 60-second threshold can only be reached by
 * waiting: `EchoTooEarly` covers the near side, and the far side (a filled
 * ECHO button that navigates to the refine screen) has no story.
 *
 * Not storied: the denied-microphone lockout, which is `PermissionErrorModal`'s
 * own story, and the `errored` branch that hides the footer entirely —
 * `useChunkedAudioRecorder` returns `errored: false` unconditionally, so
 * nothing reaches it.
 */
const meta = {
	...fromChunks([]),
	component: ParticipantConversationAudio,
	decorators: [withParticipantLayout],
	parameters: {
		...fromChunks([]).parameters,
		layout: "fullscreen",
		media: { permission: "granted" as const },
		msw: { handlers: [...s3PassHandlers, ...baseHandlers] },
		// Slow enough that a pinned state isn't disturbed by an upload it wasn't
		// about; the stories that care about chunking set their own cadence.
		recorder: { chunkEveryMs: 60_000 },
		router: {
			// The real route's children, so the outlet isn't empty. Refine and
			// verify are storied separately; here they only have to be reachable.
			childRoutes: [
				{ element: <ParticipantConversationAudioContent />, index: true },
				{
					element: <Text p="lg">Refine screen (storied separately).</Text>,
					path: "refine",
				},
				{
					element: <Text p="lg">Verify screen (storied separately).</Text>,
					path: "verify",
				},
			],
			path: BASE_PATH,
			pattern: "/:language?/:projectId/conversation/:conversationId",
			// Siblings the footer leaves for, both real destinations.
			routes: [
				{
					element: <Text p="lg">Text mode (storied separately).</Text>,
					path: `${BASE_PATH}/text`,
				},
				{
					element: <Text p="lg">Conversation finished (not storied yet).</Text>,
					path: `${BASE_PATH}/finish`,
				},
			],
		},
	},
	title: "Participant/ParticipantConversationAudio",
} satisfies Meta<typeof ParticipantConversationAudio>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Fully wired, from an empty conversation. Record, stop, resume, finish and
 * ECHO all run their real handlers: a chunk is cut every three seconds,
 * uploaded through the presigned chain, and joins the transcript above once
 * its confirmation lands. */
export const Playground: Story = {
	parameters: { recorder: { chunkEveryMs: 3000 } },
};

/** Project and conversation never resolve, so the container holds its
 * `LoadingOverlay` and no S3 check starts.
 *
 * Only those two hang: the chunk, artefact and liveness calls all fire from
 * hooks that can't be gated on another query, so they still need answering or
 * they 404 in the console behind the overlay. Listed first, since the first
 * matching handler wins. */
export const Loading: Story = {
	parameters: {
		msw: {
			handlers: [
				http.get(
					`/api/participant/projects/${PROJECT_ID}`,
					() => new Promise(() => {}),
				),
				http.get(
					`/api/participant/projects/${PROJECT_ID}/conversations/${CONVERSATION_ID}`,
					() => new Promise(() => {}),
				),
				...baseHandlers,
			],
		},
		query: { seed: [] },
	},
};

/** The conversation fetch 404s and the container swaps the whole screen,
 * footer included, for `ConversationErrorView`. The project is still seeded, so
 * the view can offer a link into a fresh conversation. */
export const Unavailable: Story = {
	parameters: {
		msw: {
			handlers: [
				http.get(
					`/api/participant/projects/${PROJECT_ID}/conversations/${CONVERSATION_ID}`,
					() => HttpResponse.json({ error: "not found" }, { status: 404 }),
				),
				...s3PassHandlers,
				...baseHandlers,
			],
		},
		query: { seed: [[["participantProject", PROJECT_ID], PROJECT]] },
	},
};

/** A fresh arrival: Record and the switch-to-text button, nothing else. Finish
 * needs at least one chunk, so it stays away. */
export const Ready: Story = {};

/** Something is already recorded, so Finish joins the footer and the
 * transcript above has content. */
export const Finishable: Story = fromChunks([CHUNK]);

/** Recording. The timer takes the Record button's place, Stop appears, and
 * ECHO sits beside it in its pre-threshold form: a light button filling left
 * to right as the first 60 seconds pass. */
export const Recording: Story = {
	play: ({ canvasElement }) => startRecording(canvasElement),
};

/** ECHO pressed inside the first 60 seconds. Rather than navigating it
 * explains itself and counts down the seconds left, then closes itself the
 * moment the threshold arrives, without a click. */
export const EchoTooEarly: Story = {
	play: async ({ canvasElement }) => {
		await startRecording(canvasElement);
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByTestId("portal-audio-echo-button"),
		);
		await within(document.body).findByTestId("portal-audio-echo-info-modal");
	},
};

/** Stop pressed. Recording really stops and the last chunk uploads, but the
 * conversation is not over: the timer freezes at the length reached and turns
 * into a pause icon while the confirmation modal asks what happens next.
 * Resuming continues from that same second. */
export const Paused: Story = {
	play: async ({ canvasElement }) => {
		await startRecording(canvasElement);
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByTestId("portal-audio-stop-button"),
		);
		await within(document.body).findByTestId("portal-audio-stop-modal");
	},
};

/** Two consecutive chunks under 1KB, which is how iOS reports that something
 * (a call, the lock screen) killed the microphone while the recorder kept
 * running. Recording stops, the wake lock is released, and the participant is
 * held at a modal until they reconnect, the timer showing the length that was
 * reached rather than zero. */
export const Interrupted: Story = {
	parameters: { recorder: { chunkBytes: 64, chunkEveryMs: 900 } },
	play: async ({ canvasElement }) => {
		await startRecording(canvasElement);
		await within(document.body).findByTestId(
			"portal-audio-interruption-modal",
			{},
			{ timeout: 10_000 },
		);
	},
};

/** The bucket probe fails, usually a VPN or a firewall. Nothing has been
 * recorded and nothing can be, so the modal has no way out but a retry that
 * runs the check again.
 *
 * The API still answers with a probe URL and it is the `PUT` to the bucket
 * that fails, which is the shape of a real blockage: what a firewall or VPN
 * cuts off is the storage host, not the API the page is already talking to.
 *
 * The other leg isn't storied because it can't look different: `check-s3` only
 * mints the presigned URL, and its own failures (404 conversation gone, 403
 * conversation closed to participation, 500 the server can't reach S3) are all
 * swallowed by `checkS3Connectivity` into the same `false`. So a server-side S3
 * outage and a closed conversation both reach this exact modal, telling the
 * participant to check their VPN. */
export const Blocked: Story = {
	parameters: {
		msw: {
			handlers: [
				http.put(PROBE_URL, () => HttpResponse.error()),
				...s3PassHandlers,
				...baseHandlers,
			],
		},
	},
};
