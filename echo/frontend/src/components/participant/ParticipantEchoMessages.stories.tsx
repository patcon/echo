import type { Message } from "@ai-sdk/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	withConversationOutlet,
	withParticipantLayout,
} from "../../../.storybook/decorators";
import { ParticipantEchoMessages } from "./ParticipantEchoMessages";

const assistant = (id: string, content: string): Message => ({
	content,
	id,
	role: "assistant",
});

const user = (id: string, content: string): Message => ({
	content,
	id,
	role: "user",
});

const FIRST_REPLY = assistant(
	"reply-1",
	"You've described two separate problem areas: the old bridge and the docks. The plastic waste at the docks sounds like it may have a different cause than the debris upstream.",
);

/**
 * The echo ("Explore") thread below the conversation, driven entirely by
 * `useChat` state passed down from `ParticipantConversationAudioContent`. Pure
 * props, no queries.
 *
 * Two things worth knowing when reading these:
 *
 * - Every message is handed to `SpikeMessage`, which renders nothing unless
 *   its type is `assistant_reply`. User-role entries are therefore invisible,
 *   and the real flow always has at least one: requesting an echo submits an
 *   empty user message. So `echoMessages.length` overstates what is on screen.
 * - The "Thinking..." placeholder is gated on `echoMessages.length > 0`, which
 *   that same invisible user message satisfies.
 */
const meta = {
	args: {
		error: undefined,
		isLoading: false,
		status: "ready",
	},
	component: ParticipantEchoMessages,
	decorators: [withConversationOutlet, withParticipantLayout],
	parameters: {
		layout: "fullscreen",
	},
	title: "Participant/ParticipantEchoMessages",
} satisfies Meta<typeof ParticipantEchoMessages>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Before the participant has asked for an echo. The whole block collapses to
 * an empty `Stack`, taking no vertical space in the conversation. */
export const NoMessages: Story = {
	args: {
		echoMessages: [],
	},
};

/** The first echo request in flight: the submitted user message is present but
 * invisible, so the only thing on screen is the "Thinking..." placeholder it
 * unlocks. `status` is anything other than `streaming` or `ready`. */
export const Thinking: Story = {
	args: {
		echoMessages: [user("submit-1", "")],
		isLoading: true,
		status: "submitted",
	},
};

/** Tokens arriving. The last message renders with `loading`, so the spinner sits
 * on a partially written reply rather than on a placeholder. */
export const Streaming: Story = {
	args: {
		echoMessages: [
			user("submit-1", ""),
			assistant("reply-1", "You've described two separate problem areas: the"),
		],
		isLoading: true,
		status: "streaming",
	},
};

/** One finished reply. Each message carries a `min-h-[180px]` floor, so a short
 * reply still occupies a full card. */
export const Reply: Story = {
	args: {
		echoMessages: [user("submit-1", ""), FIRST_REPLY],
	},
};

/** A second echo on the same conversation. Every message but the last gets a
 * `border-b`, which is the only separator between them. */
export const MultipleReplies: Story = {
	args: {
		echoMessages: [
			user("submit-1", ""),
			FIRST_REPLY,
			user("submit-2", ""),
			assistant(
				"reply-2",
				"Since then you've added the cost question. That connects the two areas: whoever pays for the dock cleanup would likely also own the bridge stretch.",
			),
		],
	},
};

/** `error` renders `EchoErrorAlert` below the thread, and suppresses the
 * "Thinking..." placeholder even while `status` is still pending. Earlier
 * replies stay on screen. */
export const Failed: Story = {
	args: {
		echoMessages: [user("submit-1", ""), FIRST_REPLY, user("submit-2", "")],
		error: new Error("Network request failed"),
		isLoading: true,
		status: "submitted",
	},
};
