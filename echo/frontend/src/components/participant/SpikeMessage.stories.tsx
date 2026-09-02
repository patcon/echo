import type { Meta, StoryObj } from "@storybook/react-vite";
import SpikeMessage from "./SpikeMessage";

/** `ConversationReply` is a global ambient type (`src/lib/typesDirectus.d.ts`),
 * so nothing is imported for it. */
const makeMessage = (
	overrides: Partial<ConversationReply>,
): ConversationReply =>
	({
		content_text: "",
		conversation_id: "conversation-story",
		date_created: "2026-07-08T12:00:00Z",
		id: "reply-story",
		reply: null,
		sort: 0,
		type: "assistant_reply",
		...overrides,
	}) as ConversationReply;

/** Renders `SystemMessage` with the Dembrane `Logo` as its title, spinning
 * while `loading` is true (`:23`) — but only when `message.type ===
 * "assistant_reply"` (`:17`); any other type renders nothing at all (`:43`). */
const meta = {
	component: SpikeMessage,
	title: "Participant/SpikeMessage",
} satisfies Meta<typeof SpikeMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		loading: false,
		message: makeMessage({ content_text: "Here is a synthesized insight." }),
	},
};

/** `loading` wraps the logo in `animate-spin` (`:23`), with no other visual
 * change. */
export const Loading: Story = {
	args: {
		loading: true,
		message: makeMessage({ content_text: "Thinking…" }),
	},
};

/** `message.type` is anything other than `"assistant_reply"` — the component
 * returns `null` (`:43`), matching the `...RendersNothing` naming used for the
 * same shape of state in `ChatHistoryMessage.stories.tsx`. */
export const NonAssistantReplyRendersNothing: Story = {
	args: {
		message: makeMessage({
			content_text: "This message doesn't render.",
			type: "not_assistant_reply",
		}),
	},
};
