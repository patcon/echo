import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConversationErrorView } from "./ConversationErrorView";

/** A 2x2 matrix of two booleans-ish props: `conversationDeletedDuringRecording`
 * swaps both headline and body copy (`:18-26`, `:29-40`), and
 * `newConversationLink` toggles a second button (`:51-63`). All four
 * combinations are genuinely distinct copy, so all four get a story.
 *
 * "Reload Page" hardcodes `window.location.reload()` in its own `onClick`
 * (`:46`) rather than taking a prop — there is no seam to swap in a spy, so
 * these stories render only and none of them click it. */
const meta = {
	component: ConversationErrorView,
	title: "Participant/ConversationErrorView",
} satisfies Meta<typeof ConversationErrorView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GenericError: Story = {
	args: {
		conversationDeletedDuringRecording: false,
		newConversationLink: null,
	},
};

export const GenericErrorWithNewConversationLink: Story = {
	args: {
		conversationDeletedDuringRecording: false,
		newConversationLink: "/en-US/w/workspace-story/projects/project-story",
	},
};

export const DeletedDuringRecording: Story = {
	args: {
		conversationDeletedDuringRecording: true,
		newConversationLink: null,
	},
};

export const DeletedDuringRecordingWithNewConversationLink: Story = {
	args: {
		conversationDeletedDuringRecording: true,
		newConversationLink: "/en-US/w/workspace-story/projects/project-story",
	},
};
