import { Text } from "@mantine/core";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { delay, HttpResponse, http } from "msw";
import { userEvent, within } from "storybook/test";
import type {
	VerificationArtifact,
	VerificationTopicsResponse,
} from "@/lib/api";
import { withParticipantLayout } from "../../../../.storybook/decorators";
import {
	CUSTOM_TOPIC,
	SEEDED_TOPICS,
} from "../../../../.storybook/fixtures/verificationTopics";
import { VerifySelection } from "./VerifySelection";

const PROJECT_ID = "project-story";
const CONVERSATION_ID = "conversation-story";
const BASE_PATH = `/en-US/${PROJECT_ID}/conversation/${CONVERSATION_ID}`;

/** Reproduces the audio route's `<Outlet />` wrapper, which is what constrains
 * this screen's height so the Next button sits at the bottom rather than under
 * the topic cards. */
const withConversationOutlet: Decorator = (Story) => (
	<div className="container mx-auto flex h-full max-w-2xl flex-col justify-end">
		<div className="relative flex-grow p-4">
			<Story />
		</div>
	</div>
);

const ALL_TOPICS: VerificationTopicsResponse = {
	available_topics: [...SEEDED_TOPICS, CUSTOM_TOPIC],
	selected_topics: [
		...SEEDED_TOPICS.map((topic) => topic.key),
		CUSTOM_TOPIC.key,
	],
};

const GENERATED_ARTEFACT: VerificationArtifact = {
	approved_at: null,
	content:
		"### Placeholder markdown content\n- something **bold**\n- something _italics_",
	conversation_id: CONVERSATION_ID,
	date_created: "2026-09-04T14:28:00.000Z",
	id: "artefact-1",
	key: "gems",
	read_aloud_stream_url: "",
	topic_label: null,
};

const project = {
	id: PROJECT_ID,
	is_get_reply_enabled: true,
	is_verify_enabled: true,
	language: "en",
} as unknown as ParticipantProject;

/** Seeds both queries and answers both requests, so a refetch cannot leave the
 * two disagreeing. `generateMs` delays the generate response, which is the only
 * way to hold `VerifyInstructions` in its loading half long enough to see. */
const withData = (
	topics: VerificationTopicsResponse,
	{ generateMs = 0 }: { generateMs?: number } = {},
) => ({
	msw: {
		handlers: [
			http.get(`/api/participant/projects/${PROJECT_ID}`, () =>
				HttpResponse.json(project),
			),
			http.get(`/api/verify/topics/${PROJECT_ID}`, () =>
				HttpResponse.json(topics),
			),
			http.post("/api/verify/generate", async () => {
				if (generateMs) await delay(generateMs);
				return HttpResponse.json({ artifact_list: [GENERATED_ARTEFACT] });
			}),
		],
	},
	query: {
		seed: [
			[["participantProject", PROJECT_ID], project],
			[["verify", "topics", PROJECT_ID], topics],
		],
	},
});

/** Somewhere to land, since proceeding past the instructions navigates to the
 * approve screen. */
const ROUTER = {
	path: `${BASE_PATH}/verify`,
	pattern: "/:language?/:projectId/conversation/:conversationId/verify",
	routes: [
		{
			element: <Text p="lg">Approve screen (storied separately).</Text>,
			path: `${BASE_PATH}/verify/approve`,
		},
	],
};

/** The head of the verify flow: pick one topic, then generate an outcome for it.
 * Only topics the host both configured and selected appear, and the label is
 * resolved per locale, so the toolbar language switch changes the cards rather
 * than just the surrounding chrome.
 *
 * Picking is not the whole screen. Choosing a topic swaps in `VerifyInstructions`
 * behind `?instructions=true` while the artefact generates, and a project with
 * exactly one topic skips the picker entirely.
 *
 * Generating writes a two minute cooldown to localStorage under
 * `cooldown_<conversationId>_verify`, which `RefineSelection` reads, so it is
 * cleared before every story below. */
const meta = {
	beforeEach: () => {
		localStorage.removeItem(`cooldown_${CONVERSATION_ID}_verify`);
	},
	component: VerifySelection,
	decorators: [withConversationOutlet, withParticipantLayout],
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(ALL_TOPICS),
	},
	title: "Participant/VerifySelection",
} satisfies Meta<typeof VerifySelection>;

export default meta;

type Story = StoryObj<typeof meta>;

/** All seven topics, wrapping as needed, with Next disabled until one is picked.
 * The six seeded shortcodes are all discarded for mapped emoji; only the custom
 * topic renders its own stored icon. */
export const Default: Story = {};

/** One card in the selected treatment, which is the only thing that enables
 * Next. Driven by test id because the labels are translated. */
export const Selected: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByTestId("portal-verify-topic-gems"));
	},
};

/** The host selected no topics. Next is permanently disabled, so the screen is
 * a dead end for the participant. */
export const NoTopics: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData({ available_topics: SEEDED_TOPICS, selected_topics: [] }),
	},
};

/** Either query still in flight. The spinner covers the whole screen, and is
 * the same one the single-topic skip below shows. */
export const Loading: Story = {
	parameters: {
		layout: "fullscreen",
		msw: {
			handlers: [
				http.get(
					`/api/participant/projects/${PROJECT_ID}`,
					() => new Promise(() => {}),
				),
				http.get(
					`/api/verify/topics/${PROJECT_ID}`,
					() => new Promise(() => {}),
				),
			],
		},
		query: { seed: [] },
		router: ROUTER,
	},
};

/** With a single topic there is nothing to choose, so the picker never renders:
 * generation starts on mount and the participant sees the instructions instead.
 * The auto-skip fires once per mount, guarded by `hasAutoTriedSingle`. */
export const SingleTopic: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData({
			available_topics: SEEDED_TOPICS,
			selected_topics: ["gems"],
		}),
	},
};

/** Reloading on `?instructions=true` restores the query param but not the
 * component state behind it, so the topic label falls back to "Hidden gem" and
 * Next stays disabled with no generation running to enable it. Recoverable only
 * by navigating back. */
export const InstructionsAfterReload: Story = {
	parameters: {
		layout: "fullscreen",
		router: { ...ROUTER, path: `${BASE_PATH}/verify?instructions=true` },
		...withData(ALL_TOPICS),
	},
	tags: ["edge-case"],
};

/** Generation failed. The instructions screen is torn back down, the selection
 * is cleared, and the failure is reported only through a toast naming the topic. */
export const GenerateFails: Story = {
	parameters: {
		layout: "fullscreen",
		msw: {
			handlers: [
				http.get(`/api/participant/projects/${PROJECT_ID}`, () =>
					HttpResponse.json(project),
				),
				http.get(`/api/verify/topics/${PROJECT_ID}`, () =>
					HttpResponse.json(ALL_TOPICS),
				),
				http.post(
					"/api/verify/generate",
					() => new HttpResponse(null, { status: 500 }),
				),
			],
		},
		query: {
			seed: [
				[["participantProject", PROJECT_ID], project],
				[["verify", "topics", PROJECT_ID], ALL_TOPICS],
			],
		},
		router: ROUTER,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByTestId("portal-verify-topic-gems"));
		await userEvent.click(
			canvas.getByTestId("portal-verify-selection-next-button"),
		);
	},
};

/** The whole flow wired end to end: pick a topic, generate against a slow
 * endpoint, watch the instructions fill in, then proceed to the approve
 * screen. */
export const Playground: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(ALL_TOPICS, { generateMs: 2000 }),
	},
};
