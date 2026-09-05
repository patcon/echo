import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { VerificationArtifact } from "@/lib/api";
import { ArtefactModal } from "./ArtefactModal";

const ARTEFACT: VerificationArtifact = {
	approved_at: "2026-09-04T14:32:00.000Z",
	content: [
		"## What we agreed",
		"",
		"The pilot should start in one neighbourhood rather than city-wide, so the",
		"team can adjust before the cost of a mistake gets large.",
		"",
		"- Start with the east district",
		"- Review after six weeks",
		"- Publish whatever we learn, including the parts that did not work",
		"",
		"There was less agreement on who should chair the review, and that was left",
		"open on purpose.",
	].join("\n"),
	conversation_id: "conversation-story",
	date_created: "2026-09-04T14:28:00.000Z",
	id: "artefact-1",
	key: "agreements",
	read_aloud_stream_url: "",
	topic_label: "What we actually agreed on",
};

/** Read-only viewer for an approved outcome, opened by tapping a
 * `VerifiedArtefactItem`. It renders nothing but the artefact's markdown, so
 * its states come from `isLoading` and from whether an artefact is present.
 *
 * Mantine portals this into `document.body`, so it sits outside the story
 * canvas element. */
const meta = {
	args: {
		artefact: ARTEFACT,
		isLoading: false,
		onClose: fn(),
		onExited: fn(),
		opened: true,
	},
	component: ArtefactModal,
	title: "Participant/ArtefactModal",
} satisfies Meta<typeof ArtefactModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The overlay covers the content rather than replacing it. Note the list
 * currently hardcodes `isLoading={false}`, so this state is only reachable if a
 * future caller passes it. */
export const Loading: Story = {
	args: {
		isLoading: true,
	},
};

/** No artefact selected. The list passes null for a beat after the modal closes,
 * while `onExited` clears the selected id, and the modal renders empty rather
 * than unmounting. */
export const NoArtefact: Story = {
	args: {
		artefact: null,
	},
};
