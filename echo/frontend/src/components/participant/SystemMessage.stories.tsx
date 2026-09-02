import type { Meta, StoryObj } from "@storybook/react-vite";
import SystemMessage from "./SystemMessage";

/** Pure props, no hooks or state: an optional `title` slot laid out beside the
 * markdown body on md+ and stacked on mobile (`:28-33`), and `markdown`
 * rendered through `@/components/common/Markdown` (`:31`), defaulting to an
 * empty string when omitted. */
const meta = {
	component: SystemMessage,
	title: "Participant/SystemMessage",
} satisfies Meta<typeof SystemMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		markdown: "This is a system message.",
	},
};

/** `SpikeMessage` composes this component with a spinning/still `Logo` as
 * `title` (`SpikeMessage.tsx:21-33`); a plain text node stands in here to
 * show the slot on its own. */
export const WithTitle: Story = {
	args: {
		markdown: "This message has a title slot filled.",
		title: "Assistant",
	},
};

export const WithRichMarkdown: Story = {
	args: {
		markdown:
			"**Bold claim.** Some considerations:\n\n- First point\n- Second point\n- Third point",
	},
};

/** No `markdown` prop at all — falls through to `markdown ?? ""` (`:31`), so
 * the paper renders with an empty body rather than throwing. */
export const Empty: Story = {
	args: {},
};
