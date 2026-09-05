import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import { userEvent, within } from "storybook/test";
import type {
	VerificationArtifact,
	VerificationTopicMetadata,
	VerificationTopicsResponse,
} from "@/lib/api";
import { withParticipantLayout } from "../../../../.storybook/decorators";
import { VerifiedArtefactsList } from "./VerifiedArtefactsList";

const PROJECT_ID = "project-story";
const CONVERSATION_ID = "conversation-story";

/** Reproduces the audio route's `<Outlet />` wrapper. The items right-align
 * themselves, so they only read correctly at the conversation's width. */
const withConversationOutlet: Decorator = (Story) => (
	<div className="container mx-auto flex h-full max-w-2xl flex-col justify-end">
		<div className="relative flex-grow p-4">
			<Story />
		</div>
	</div>
);

const artefact = (
	overrides: Partial<VerificationArtifact> &
		Pick<VerificationArtifact, "id" | "key">,
): VerificationArtifact => ({
	approved_at: "2026-09-04T14:32:00.000Z",
	content: "Placeholder outcome content.",
	conversation_id: CONVERSATION_ID,
	date_created: "2026-09-04T14:28:00.000Z",
	read_aloud_stream_url: "",
	topic_label: null,
	...overrides,
});

const ARTEFACTS: VerificationArtifact[] = [
	artefact({
		approved_at: "2026-09-04T14:05:00.000Z",
		content: "The pilot should start in one neighbourhood, not city-wide.",
		id: "artefact-1",
		key: "agreements",
	}),
	artefact({
		approved_at: "2026-09-04T14:19:00.000Z",
		content: "Nobody could say who owns the review after the pilot ends.",
		id: "artefact-2",
		key: "disagreements",
	}),
	artefact({
		approved_at: "2026-09-04T14:32:00.000Z",
		content: "Publish what did not work, not only what did.",
		id: "artefact-3",
		key: "actions",
	}),
	artefact({
		approved_at: "2026-09-04T14:41:00.000Z",
		content: "The six week review window is tighter than it sounds.",
		id: "artefact-4",
		key: "what-surprised-us-3f9a2c1b",
	}),
];

/** Default topics are seeded server-side with Slack shortcode icons, never
 * emoji, so `icon` here is deliberately `":white_check_mark:"` and not "✅".
 * Custom topics take whatever the host typed. */
const topic = (
	key: string,
	icon: string | null,
	labels: Record<string, string>,
	overrides: Partial<VerificationTopicMetadata> = {},
): VerificationTopicMetadata => ({
	icon,
	key,
	translations: Object.fromEntries(
		Object.entries(labels).map(([locale, label]) => [locale, { label }]),
	),
	...overrides,
});

/** Labels and shortcodes quoted from the seeded defaults, plus one custom topic
 * of the shape `create_custom_topic` produces (slug plus eight hex chars). */
const TOPICS: VerificationTopicsResponse = {
	available_topics: [
		topic(
			"agreements",
			":white_check_mark:",
			{
				"en-US": "What we actually agreed on",
				"nl-NL": "Waar we het over eens werden",
			},
			{ sort: 1 },
		),
		topic(
			"disagreements",
			":warning:",
			{
				"en-US": "Moments we agreed to disagree",
				"nl-NL": "Waar we het oneens bleven",
			},
			{ sort: 6 },
		),
		topic(
			"actions",
			":arrow_upper_right:",
			{
				"en-US": "What we think should happen",
				"nl-NL": "Wat we denken dat moet gebeuren",
			},
			{ sort: 5 },
		),
		topic(
			"what-surprised-us-3f9a2c1b",
			"🤔",
			{ "en-US": "What surprised us about the timeline" },
			{ is_custom: true },
		),
	],
	selected_topics: [
		"agreements",
		"disagreements",
		"actions",
		"what-surprised-us-3f9a2c1b",
	],
};

/** Seeds both queries and answers both requests, so a refetch cannot leave the
 * two disagreeing. */
const withData = (
	artefacts: VerificationArtifact[],
	topics: VerificationTopicsResponse,
) => ({
	msw: {
		handlers: [
			http.get(`/api/verify/artifacts/${CONVERSATION_ID}`, () =>
				HttpResponse.json(artefacts),
			),
			http.get(`/api/verify/topics/${PROJECT_ID}`, () =>
				HttpResponse.json(topics),
			),
		],
	},
	query: {
		seed: [
			[["verify", "conversation_artifacts", CONVERSATION_ID], artefacts],
			[["verify", "topics", PROJECT_ID], topics],
		],
	},
});

/** The approved outcomes that accumulate in a participant's conversation, each
 * one tappable to reopen its `ArtefactModal`.
 *
 * It joins two queries: the conversation's artefacts, and the project's
 * verification topics, which supply the label and the icon.
 *
 * Icons take two different routes depending on the topic. Seeded defaults ship
 * Slack shortcodes, which the component rejects with a `startsWith(":")` guard
 * and replaces from `TOPIC_ICON_MAP` keyed on the topic key. Custom topics have
 * no map entry, so their stored icon is the one that renders. Both routes are
 * exercised below.
 *
 * Not storied: an empty artefact list renders null. */
const meta = {
	args: {
		conversationId: CONVERSATION_ID,
		projectId: PROJECT_ID,
		projectLanguage: "en",
	},
	component: VerifiedArtefactsList,
	decorators: [withConversationOutlet, withParticipantLayout],
	parameters: {
		layout: "fullscreen",
		...withData(ARTEFACTS, TOPICS),
	},
	title: "Participant/VerifiedArtefactsList",
} satisfies Meta<typeof VerifiedArtefactsList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Three seeded topics, whose shortcodes are discarded for mapped emoji, plus
 * one custom topic rendering its own stored emoji. */
export const Default: Story = {};

/** Dutch project, so labels come from the `nl-NL` translations. The custom topic
 * has no Dutch translation and falls back to its `en-US` label, which is what a
 * host sees after adding a topic without translating it. */
export const LocalizedLabels: Story = {
	args: {
		projectLanguage: "nl",
	},
};

/** With no topic metadata the label falls back twice: first to the artefact's
 * own `topic_label`, then to the bare key, which for a custom topic exposes the
 * generated slug. Neither resolves an icon. */
export const FallbackLabels: Story = {
	parameters: {
		layout: "fullscreen",
		...withData(
			[
				artefact({
					id: "artefact-1",
					key: "agreements",
					topic_label: "What we actually agreed on",
				}),
				artefact({ id: "artefact-2", key: "what-surprised-us-3f9a2c1b" }),
			],
			{ available_topics: [], selected_topics: [] },
		),
	},
};

/** Artefacts still in flight. Only the artefacts query gates this, and the
 * skeleton is right-aligned to match the bubbles it stands in for. */
export const Loading: Story = {
	parameters: {
		layout: "fullscreen",
		msw: {
			handlers: [
				http.get(
					`/api/verify/artifacts/${CONVERSATION_ID}`,
					() => new Promise(() => {}),
				),
				http.get(`/api/verify/topics/${PROJECT_ID}`, () =>
					HttpResponse.json(TOPICS),
				),
			],
		},
		query: { seed: [] },
	},
};

/** The only way to see the list-to-modal wiring, since nothing else opens it:
 * tapping a bubble stores its id and hands the matching artefact to
 * `ArtefactModal`. Driven by test id because the labels are translated. */
export const WithModalOpen: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByTestId("portal-verified-artefact-item-1"),
		);
		await within(document.body).findByTestId("portal-verified-artefact-modal");
	},
};
