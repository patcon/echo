import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
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

const ALL_TOPICS: VerificationTopicsResponse = {
	available_topics: [...SEEDED_TOPICS, CUSTOM_TOPIC],
	selected_topics: [
		...SEEDED_TOPICS.map((topic) => topic.key),
		CUSTOM_TOPIC.key,
	],
};

const artefact = (
	overrides: Partial<VerificationArtifact> &
		Pick<VerificationArtifact, "id" | "key">,
): VerificationArtifact => ({
	approved_at: "2026-09-04T14:32:00.000Z",
	content:
		"### Placeholder markdown content\n- something **bold**\n- something _italics_",
	conversation_id: CONVERSATION_ID,
	date_created: "2026-09-04T14:28:00.000Z",
	read_aloud_stream_url: "",
	topic_label: null,
	...overrides,
});

/** One approved outcome per topic, so every label and icon in the fixture is
 * on screen at once. */
const ARTEFACTS: VerificationArtifact[] = [
	artefact({
		approved_at: "2026-09-04T14:05:00.000Z",
		id: "artefact-1",
		key: "agreements",
	}),
	artefact({
		approved_at: "2026-09-04T14:11:00.000Z",
		id: "artefact-2",
		key: "gems",
	}),
	artefact({
		approved_at: "2026-09-04T14:17:00.000Z",
		id: "artefact-3",
		key: "truths",
	}),
	artefact({
		approved_at: "2026-09-04T14:23:00.000Z",
		id: "artefact-4",
		key: "moments",
	}),
	artefact({
		approved_at: "2026-09-04T14:29:00.000Z",
		id: "artefact-5",
		key: "actions",
	}),
	artefact({
		approved_at: "2026-09-04T14:35:00.000Z",
		id: "artefact-6",
		key: "disagreements",
	}),
	artefact({
		approved_at: "2026-09-04T14:41:00.000Z",
		id: "artefact-7",
		key: CUSTOM_TOPIC.key,
	}),
];

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
 * Labels are resolved per locale, mapped from the project's two-letter
 * language. `SEEDED_TOPICS` carries all eight shipped translations so the
 * fixture matches the server, but only English is storied. Note the locale
 * comes from the project, not from the Storybook language toolbar, which only
 * switches Lingui's UI strings.
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
		...withData(ARTEFACTS, ALL_TOPICS),
	},
	title: "Participant/VerifiedArtefactsList",
} satisfies Meta<typeof VerifiedArtefactsList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The six seeded topics, whose shortcodes are all discarded for mapped emoji,
 * plus the custom topic rendering its own stored emoji. */
export const Default: Story = {};

/** With no topic metadata the label falls back twice: first to the artefact's
 * own `topic_label`, then to the bare key, which for a custom topic exposes the
 * generated slug. Neither resolves an icon. */
export const FallbackTopicLabel: Story = {
	parameters: {
		layout: "fullscreen",
		...withData(
			[
				artefact({
					id: "artefact-1",
					key: CUSTOM_TOPIC.key,
					topic_label: "What surprised us about the timeline",
				}),
			],
			{ available_topics: [], selected_topics: [] },
		),
	},
};

export const FallbackKeyLabel: Story = {
	parameters: {
		layout: "fullscreen",
		...withData(
			[
				artefact({
					id: "artefact-1",
					key: CUSTOM_TOPIC.key,
				}),
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
					HttpResponse.json(ALL_TOPICS),
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
