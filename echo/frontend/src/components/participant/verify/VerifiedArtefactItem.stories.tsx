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
	content: "We agreed the pilot should start with one neighbourhood.",
	conversation_id: "conversation-story",
	date_created: "2026-09-04T14:28:00.000Z",
	id: "artefact-1",
	key: "agreements",
	read_aloud_stream_url: "",
	topic_label: "Agreements",
};

/** One approved outcome, rendered as a right-aligned bubble in the participant's
 * conversation. Pure props, no queries. Its parent `VerifiedArtefactsList`
 * resolves `label` and `icon` from the verification topics before passing them
 * down, so both are plain strings here.
 *
 * Two independent things can be absent: the icon, and the `approved_at`
 * timestamp that `formatArtefactTime` renders as `h:mm a`. */
const meta = {
	args: {
		artefact: ARTEFACT,
		icon: "✅",
		label: "Agreements",
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

/** A custom topic, which has no entry in `TOPIC_ICON_MAP` and no icon of its
 * own, so the label carries the bubble alone. */
export const NoIcon: Story = {
	args: {
		icon: undefined,
		label: "What surprised us",
	},
};

/** `approved_at` is null, so the timestamp is dropped entirely rather than
 * rendering a placeholder. */
export const NoTimestamp: Story = {
	args: {
		artefact: { ...ARTEFACT, approved_at: null },
	},
};
