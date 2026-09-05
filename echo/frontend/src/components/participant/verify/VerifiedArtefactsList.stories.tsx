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
];

const topic = (
	key: string,
	labels: Record<string, string>,
): VerificationTopicMetadata => ({
	key,
	translations: Object.fromEntries(
		Object.entries(labels).map(([locale, label]) => [locale, { label }]),
	),
});

const TOPICS: VerificationTopicsResponse = {
	available_topics: [
		topic("agreements", { "en-US": "Agreements", "nl-NL": "Afspraken" }),
		topic("disagreements", {
			"en-US": "Disagreements",
			"nl-NL": "Meningsverschillen",
		}),
		topic("actions", { "en-US": "Actions", "nl-NL": "Acties" }),
	],
	selected_topics: ["agreements", "disagreements", "actions"],
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
 * verification topics, which supply the human label and the emoji. Icons come
 * from `TOPIC_ICON_MAP` keyed on the topic key, not from the API.
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

/** Three outcomes across three topics, each resolving both a label and an icon. */
export const Default: Story = {};

/** Dutch project, so labels come from the `nl-NL` translations rather than the
 * `en-US` fallback. The icons are locale-independent. */
export const LocalizedLabels: Story = {
	args: {
		projectLanguage: "nl",
	},
};

/** With no topic metadata the label falls back twice: first to the artefact's
 * own `topic_label`, then to the bare key. One artefact of each here, and
 * neither resolves an icon. */
export const FallbackLabels: Story = {
	parameters: {
		layout: "fullscreen",
		...withData(
			[
				artefact({
					id: "artefact-1",
					key: "agreements",
					topic_label: "Agreements",
				}),
				artefact({ id: "artefact-2", key: "what_surprised_us" }),
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
