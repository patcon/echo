import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import MARKDOWN_TEST from "@/../.storybook/markdown_test.md?raw";
import type { VerificationArtifact } from "@/lib/api";
import { ArtefactModal } from "./ArtefactModal";

const SAMPLE_CONTENT = `
## What we agreed
The pilot should start in one neighbourhood rather than city-wide, so the
team can adjust before the cost of a mistake gets large.

- Start with the east district
- Review after six weeks
- Publish whatever we learn, including the parts that did not work

There was less agreement on who should chair the review, and that was left
open on purpose.
`;

const ARTEFACT: VerificationArtifact = {
	approved_at: "2026-09-04T14:32:00.000Z",
	content: SAMPLE_CONTENT,
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
	parameters: {
		// Storybook's default `layout: "padded"` pads the canvas root on the
		// left only in this modal's case (Mantine centers the modal in that
		// padded box, not the real viewport), so it reads off-center.
		layout: "fullscreen",
	},
	title: "Participant/ArtefactModal",
} satisfies Meta<typeof ArtefactModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MarkdownTest: Story = {
	args: {
		artefact: {
			...ARTEFACT,
			content: MARKDOWN_TEST,
		},
	},
};

/** The overlay covers the content rather than replacing it. Note the list
 * currently hardcodes `isLoading={false}`, so this state is only reachable if a
 * future caller passes it. */
export const Loading: Story = {
	args: {
		isLoading: true,
	},
	tags: ["unused"],
};

/** No artefact selected. `onExited` only clears the selected id after the modal
 * has finished closing, so this isn't reachable by closing the modal. It can
 * happen if the list refetches (e.g. on window refocus) while the modal is
 * open and the selected artefact is no longer in the result. */
export const NoArtefact: Story = {
	args: {
		artefact: null,
	},
	tags: ["edge-case"],
};
