import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { VerificationArtifact } from "@/lib/api";
import { withParticipantLayout } from "../../../../.storybook/decorators";
import { VerifiedArtefactItem } from "./VerifiedArtefactItem";

/** Reproduces the audio route's `<Outlet />` wrapper. This item right-aligns
 * itself inside its container, so it only reads correctly at the conversation's
 * width. */
const withConversationOutlet: Decorator = (Story) => (
	<div className="container mx-auto flex h-full max-w-2xl flex-col justify-end">
		<div className="relative flex-grow p-4">
			<Story />
		</div>
	</div>
);

const ARTEFACT: VerificationArtifact = {
	approved_at: "2026-09-04T14:32:00.000Z",
	content:
		"### Placeholder markdown content\n- something **bold**\n- something _italics_",
	conversation_id: "conversation-story",
	date_created: "2026-09-04T14:28:00.000Z",
	id: "artefact-1",
	key: "agreements",
	read_aloud_stream_url: "",
	topic_label: "What we actually agreed on",
};

/** One approved outcome, rendered as a right-aligned bubble in the participant's
 * conversation. Pure props, no queries. Its parent `VerifiedArtefactsList`
 * resolves `label` and `icon` from the verification topics before passing them
 * down, so both arrive here as plain strings.
 *
 * Labels are quoted from the seeded default topics, which are full phrases
 * rather than single nouns. Bubble width is driven entirely by that label, so a
 * short placeholder would understate how wide these actually run.
 *
 * Two things can independently be absent: the icon, and the `approved_at`
 * timestamp that `formatArtefactTime` renders as `h:mm a`. */
const meta = {
	args: {
		artefact: ARTEFACT,
		icon: "✅",
		label: "Lorem ipsum dolor",
		onViewArtefact: fn(),
	},
	component: VerifiedArtefactItem,
	decorators: [withConversationOutlet, withParticipantLayout],
	parameters: {
		layout: "fullscreen",
	},
	title: "Participant/VerifiedArtefactItem",
} satisfies Meta<typeof VerifiedArtefactItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The longest of the six seeded defaults, and the widest bubble the built-in
 * topics can produce. */
export const Long: Story = {
	args: {
		artefact: ARTEFACT,
		icon: "✅",
		label: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	},
};

/**
 * A realistically-spaced 99-character max label.
 */
export const MaxChars: Story = {
	args: {
		label:
			"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas iaculis felis et urna massa nunc.",
	},
	tags: ["edge-case"],
};

/** A worst-case label, longer than any real topic. The bubble has no max width
 * of its own, so this is what bounds it: the right-aligned `Box` and the
 * conversation container. Included to pin the wrap rather than trusting that
 * the longest seeded label happens to be long enough. */
export const MaxCharsNoSpaces: Story = {
	args: {
		label:
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
	},
	tags: ["edge-case"],
};

/** A custom topic whose host left the icon blank. Customs have no entry in
 * `TOPIC_ICON_MAP`, so nothing backfills one and the label carries the bubble
 * alone. */
export const NoIcon: Story = {
	args: {
		artefact: ARTEFACT,
		icon: undefined,
		label: "Lorem ipsum dolor",
	},
};

/** `approved_at` is null, so the timestamp is dropped entirely rather than
 * rendering a placeholder. */
export const NoTimestamp: Story = {
	args: {
		artefact: { ...ARTEFACT, approved_at: null },
	},
	tags: ["unused"],
};
