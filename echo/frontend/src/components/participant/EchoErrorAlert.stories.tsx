import type { Meta, StoryObj } from "@storybook/react-vite";
import { EchoErrorAlert } from "./EchoErrorAlert";

/** Pure function of one prop (`error: Error`), no state. The only branch is
 * `error?.message?.includes("CONTENT_POLICY_VIOLATION")` (`:15`), so there are
 * exactly two readable states. */
const meta = {
	component: EchoErrorAlert,
	title: "Participant/EchoErrorAlert",
} satisfies Meta<typeof EchoErrorAlert>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `error.message` contains the marker string, so the copy calls out an LLM
 * provider's content policy specifically (`:16-19`). */
export const ContentPolicyViolation: Story = {
	args: {
		error: new Error("CONTENT_POLICY_VIOLATION"),
	},
};

/** Any other message falls through to the generic "Something went wrong"
 * copy (`:21-25`), regardless of what the message actually says. */
export const GenericError: Story = {
	args: {
		error: new Error("Network request failed"),
	},
};
