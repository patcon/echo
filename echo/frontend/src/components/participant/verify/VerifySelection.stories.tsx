import { Text } from "@mantine/core";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { delay, HttpResponse, http } from "msw";
import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
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

const NO_TOPICS: VerificationTopicsResponse = {
	available_topics: SEEDED_TOPICS,
	selected_topics: [],
};

const SINGLE_TOPIC: VerificationTopicsResponse = {
	available_topics: SEEDED_TOPICS,
	selected_topics: ["gems"],
};

/** The same seven topics, with the first label swapped for a 99 character worst
 * case. The length is not arbitrary: `CustomTopicModal` caps a host-written
 * label at 100 characters and the server enforces the same, so this is the
 * widest card the picker can ever be asked to lay out. Shared with
 * `VerifiedArtefactItem`'s own max-length story.
 *
 * Synthetic in that no seeded translation runs this long, and a real host would
 * hit the limit on a custom topic rather than on `agreements`. Overriding in
 * place keeps the set identical to `MultiTopic` apart from the one label. */
const LONG_LABEL_TOPICS: VerificationTopicsResponse = {
	...ALL_TOPICS,
	available_topics: ALL_TOPICS.available_topics.map((topic, index) =>
		index === 0
			? {
					...topic,
					translations: {
						...topic.translations,
						"en-US": {
							label:
								"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas iaculis felis et urna massa nunc.",
						},
					},
				}
			: topic,
	),
};

/** How many topics the host selected, which is the one input that decides
 * whether this screen shows a picker, skips itself, or dead-ends. */
type TopicSet = "multi" | "none" | "single";

const TOPIC_SETS: Record<TopicSet, VerificationTopicsResponse> = {
	multi: ALL_TOPICS,
	none: NO_TOPICS,
	single: SINGLE_TOPIC,
};

/** Which request fails. `VerifySelection` renders no error UI of its own, so
 * each of these surfaces somewhere different, or nowhere at all. */
type Failing = "generate-empty" | "generate" | "none" | "project" | "topics";

/** Read at request time by the Playground's handlers, so switching a radio
 * changes the response without rebuilding the handler (which `parameters.msw`
 * fixes for the life of the story). */
let activeTopicSet: TopicSet = "multi";
let activeFailing: Failing = "none";

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
 * way to hold `VerifyInstructions` in its loading half long enough to see.
 *
 * `loadMs` delays the two reads instead, and drops the seed along with it:
 * seeded data renders before any response lands, so a story cannot both seed
 * and show the loading gate. */
const withData = (
	topics: VerificationTopicsResponse | (() => VerificationTopicsResponse),
	{
		failing = () => "none" as Failing,
		generateMs = 0,
		loadMs = 0,
	}: {
		failing?: () => Failing;
		generateMs?: number;
		loadMs?: number;
	} = {},
) => ({
	msw: {
		handlers: [
			http.get(`/api/participant/projects/${PROJECT_ID}`, async () => {
				if (loadMs) await delay(loadMs);
				if (failing() === "project")
					return new HttpResponse(null, { status: 500 });
				return HttpResponse.json(project);
			}),
			http.get(`/api/verify/topics/${PROJECT_ID}`, async () => {
				if (loadMs) await delay(loadMs);
				if (failing() === "topics")
					return new HttpResponse(null, { status: 500 });
				return HttpResponse.json(
					typeof topics === "function" ? topics() : topics,
				);
			}),
			http.post("/api/verify/generate", async () => {
				if (generateMs) await delay(generateMs);
				if (failing() === "generate")
					return new HttpResponse(null, { status: 500 });
				// An empty list is a 200, so the failure surfaces from the hook's own
				// throw rather than from axios.
				if (failing() === "generate-empty")
					return HttpResponse.json({ artifact_list: [] });
				return HttpResponse.json({ artifact_list: [GENERATED_ARTEFACT] });
			}),
		],
	},
	query: {
		seed:
			loadMs || typeof topics === "function"
				? []
				: [
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

/** `VerifySelection` takes no props, so the Playground's radios are story args
 * rather than component ones: they choose what the mocked endpoints answer
 * with.
 *
 * Swapping the response is not enough on its own. The story's QueryClient
 * holds the previous one at `staleTime: Infinity`, and the component latches
 * both `hasAutoTriedSingle` and the `instructions` search param, so an arg only
 * takes effect once the cached reads are dropped, a run through the flow is
 * wound back, and the component is remounted. */
const withPlaygroundArgs: Decorator = (Story, context) => {
	const { failing = "none", topicSet = "multi" } = context.args as StoryArgs;
	const queryClient = useQueryClient();
	const [, setSearchParams] = useSearchParams();
	const renderedArgs = useRef(`${topicSet}:${failing}`);
	const argKey = `${topicSet}:${failing}`;

	// During render rather than in an effect: the story's queries fire from
	// child effects, which React runs before this decorator's own effects.
	useMemo(() => {
		activeTopicSet = topicSet;
		activeFailing = failing;
		queryClient.removeQueries({ queryKey: ["verify", "topics", PROJECT_ID] });
		queryClient.removeQueries({ queryKey: ["participantProject", PROJECT_ID] });
	}, [topicSet, failing, queryClient]);

	// A run through the flow leaves ?instructions=true behind, which would
	// otherwise greet the next combination with the instructions screen. Guarded
	// on the value, not just the dependency list: `setSearchParams` changes
	// identity whenever the params do, so an unguarded effect would wipe the
	// param the moment the component set it.
	useEffect(() => {
		if (renderedArgs.current === argKey) return;
		renderedArgs.current = argKey;
		setSearchParams({}, { replace: true });
	}, [argKey, setSearchParams]);

	return <Story key={argKey} />;
};

/** Args are the story's own; `VerifySelection` itself takes none. */
type StoryArgs = { failing?: Failing; topicSet?: TopicSet };

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
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The whole flow wired end to end, starting from a cold cache: a second of
 * loading, then pick a topic, generate against a slow endpoint, watch the
 * instructions fill in, and proceed to the approve screen.
 *
 * The topic-type radio switches between the three shapes a host can leave
 * behind, each sending the screen somewhere different: `multi` shows the
 * picker, `single` skips it and generates on arrival, and `none` dead-ends on
 * the empty message.
 *
 * The failing-request radio is the more revealing one, because this screen has
 * no error UI at all:
 *
 * - `topics` renders the same "No verification topics are configured" message
 *   as a project with none selected. A participant cannot tell a broken backend
 *   from a host who configured nothing, and there is no retry.
 * - `project` is invisible. Only the label locale is read from the project, and
 *   it already falls back to the UI language, so the picker looks untouched.
 * - `generate` and `generate-empty` are the only failures the participant is
 *   told about: both tear the instructions screen down, clear the selection,
 *   and report through a toast naming the topic. They differ only in origin,
 *   an axios 500 versus the hook's own throw on an empty `artifact_list`.
 *
 * Each switch replays the load. */
export const Playground: Story = {
	args: { failing: "none", topicSet: "multi" },
	argTypes: {
		failing: {
			control: { type: "radio" },
			name: "Failing request",
			options: [
				"none",
				"project",
				"topics",
				"generate",
				"generate-empty",
			] satisfies Failing[],
		},
		topicSet: {
			control: { type: "radio" },
			name: "Topic type",
			options: ["none", "single", "multi"] satisfies TopicSet[],
		},
	},
	decorators: [withPlaygroundArgs],
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(() => TOPIC_SETS[activeTopicSet], {
			failing: () => activeFailing,
			generateMs: 2000,
			loadMs: 1000,
		}),
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

/** All seven topics, wrapping as needed, with Next disabled until one is picked.
 * The six seeded shortcodes are all discarded for mapped emoji; only the custom
 * topic renders its own stored icon. */
export const MultiTopic: Story = {};

/** The first topic carrying a 99 character label, the longest a host can save.
 * The cards are `Group` children with no max width of their own, so the
 * conversation container is all that bounds them: the long card takes a row to
 * itself and wraps inside it, pushing the rest down. Pinned rather than
 * trusting the longest real translation to be long enough. */
export const MultiTopicLong: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(LONG_LABEL_TOPICS),
	},
	tags: ["edge-case"],
};

/** One card in the selected treatment, which is the only thing that enables
 * Next. Driven by test id because the labels are translated. */
export const MultiTopicSelected: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByTestId("portal-verify-topic-gems"));
	},
};

/** With a single topic there is nothing to choose, so the picker never renders:
 * generation starts on mount and the participant sees the instructions instead.
 * The auto-skip fires once per mount, guarded by `hasAutoTriedSingle`. */
export const SingleTopic: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(SINGLE_TOPIC),
	},
};

/** The host selected no topics. Next is permanently disabled, so the screen is
 * a dead end for the participant. */
export const NoTopics: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(NO_TOPICS),
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
		router: ROUTER,
		...withData(ALL_TOPICS, { failing: () => "generate" }),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByTestId("portal-verify-topic-gems"));
		await userEvent.click(
			canvas.getByTestId("portal-verify-selection-next-button"),
		);
	},
};
