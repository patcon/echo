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

/** The six default verification topics, transcribed from the server seed that
 * `reconcile_default_verification_topics` applies at startup: real keys, real
 * sort order, the eight locales the seed ships, and the Slack shortcode icons
 * it stores. Shortcodes rather than emoji is the point. The component rejects
 * any icon starting with ":" and substitutes one from `TOPIC_ICON_MAP`, so a
 * fixture carrying emoji here would skip that path entirely.
 *
 * Transcribed, so it can drift if the seed changes. Re-read `seed.py` rather
 * than trusting this if a label looks wrong. */
const SEEDED_TOPICS: VerificationTopicMetadata[] = [
	{
		icon: ":white_check_mark:",
		key: "agreements",
		sort: 1,
		translations: {
			"cs-CZ": { label: "Na čem jsme se shodli" },
			"de-DE": { label: "Worauf wir uns wirklich geeinigt haben" },
			"en-US": { label: "What we actually agreed on" },
			"es-ES": { label: "En qué estuvimos de acuerdo" },
			"fr-FR": { label: "Ce qu'on a décidé ensemble" },
			"it-IT": { label: "Su cosa ci siamo accordati" },
			"nl-NL": { label: "Waar we het over eens werden" },
			"uk-UA": { label: "Про що ми домовились" },
		},
	},
	{
		icon: ":mag:",
		key: "gems",
		sort: 2,
		translations: {
			"cs-CZ": { label: "Skryté klenoty" },
			"de-DE": { label: "Verborgene Schätze" },
			"en-US": { label: "Hidden gems" },
			"es-ES": { label: "Joyas ocultas" },
			"fr-FR": { label: "Pépites cachées" },
			"it-IT": { label: "Perle nascoste" },
			"nl-NL": { label: "Verborgen parels" },
			"uk-UA": { label: "Приховані перлини" },
		},
	},
	{
		icon: ":eyes:",
		key: "truths",
		sort: 3,
		translations: {
			"cs-CZ": { label: "Bolestivé pravdy" },
			"de-DE": { label: "Unbequeme Wahrheiten" },
			"en-US": { label: "Painful truths" },
			"es-ES": { label: "Verdades incómodas" },
			"fr-FR": { label: "Vérités difficiles" },
			"it-IT": { label: "Verità scomode" },
			"nl-NL": { label: "Pijnlijke waarheden" },
			"uk-UA": { label: "Болючі істини" },
		},
	},
	{
		icon: ":rocket:",
		key: "moments",
		sort: 4,
		translations: {
			"cs-CZ": { label: "Průlomové okamžiky" },
			"de-DE": { label: "Durchbrüche" },
			"en-US": { label: "Breakthrough moments" },
			"es-ES": { label: "Momentos decisivos" },
			"fr-FR": { label: "Moments décisifs" },
			"it-IT": { label: "Momenti di svolta" },
			"nl-NL": { label: "Doorbraken" },
			"uk-UA": { label: "Моменти прориву" },
		},
	},
	{
		icon: ":arrow_upper_right:",
		key: "actions",
		sort: 5,
		translations: {
			"cs-CZ": { label: "Co by se podle nás mělo stát" },
			"de-DE": { label: "Was wir denken, das passieren sollte" },
			"en-US": { label: "What we think should happen" },
			"es-ES": { label: "Lo que creemos que debe pasar" },
			"fr-FR": { label: "Ce qu'on pense qu'il faut faire" },
			"it-IT": { label: "Cosa pensiamo debba succedere" },
			"nl-NL": { label: "Wat we denken dat moet gebeuren" },
			"uk-UA": { label: "Що, на нашу думку, має статися" },
		},
	},
	{
		icon: ":warning:",
		key: "disagreements",
		sort: 6,
		translations: {
			"cs-CZ": { label: "Kdy jsme se shodli, že se neshodneme" },
			"de-DE": { label: "Worüber wir uns nicht einig wurden" },
			"en-US": { label: "Moments we agreed to disagree" },
			"es-ES": { label: "Donde no coincidimos" },
			"fr-FR": { label: "Là où on n'était pas d'accord" },
			"it-IT": { label: "Dove non eravamo d'accordo" },
			"nl-NL": { label: "Waar we het oneens bleven" },
			"uk-UA": { label: "Де ми погодились не погоджуватись" },
		},
	},
];

/** Custom topics are created per project with a `<slug>-<8 hex>` key, an
 * `en-US` translation plus whatever the host translated, and a free-text icon.
 * Having no `TOPIC_ICON_MAP` entry, this is the only kind whose stored icon
 * actually reaches the UI. */
const CUSTOM_TOPIC: VerificationTopicMetadata = {
	icon: "🤔",
	is_custom: true,
	key: "what-surprised-us-3f9a2c1b",
	translations: {
		"en-US": { label: "What surprised us about the timeline" },
	},
};

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
	content: "Placeholder outcome content.",
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
				artefact({ id: "artefact-2", key: CUSTOM_TOPIC.key }),
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
