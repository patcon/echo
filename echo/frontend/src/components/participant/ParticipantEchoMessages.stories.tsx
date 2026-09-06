import type { Message } from "@ai-sdk/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
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

/** Words per arriving segment. The spans Gemini hands back through LiteLLM are
 * chunky and uneven, so this is a stand-in for their rough size rather than a
 * measurement — raise it for a jumpier stream, drop it to 1 for word-by-word. */
const SEGMENT_WORDS = 3;
const SEGMENT_INTERVAL_MS = 250;
const REPLAY_PAUSE_MS = 2000;

const REPLY_WORDS = FIRST_REPLY.content.split(" ");

/** Appends `SEGMENT_WORDS` at a time, holds the finished reply, then starts
 * over. `status` stays `streaming` throughout, so the story never drifts into
 * the state `CompletedReply` already pins. */
const StreamingReplySegments = (
	args: React.ComponentProps<typeof ParticipantEchoMessages>,
) => {
	const [wordCount, setWordCount] = useState(SEGMENT_WORDS);

	useEffect(() => {
		const isComplete = wordCount >= REPLY_WORDS.length;
		const timer = setTimeout(
			() =>
				setWordCount(isComplete ? SEGMENT_WORDS : wordCount + SEGMENT_WORDS),
			isComplete ? REPLAY_PAUSE_MS : SEGMENT_INTERVAL_MS,
		);
		return () => clearTimeout(timer);
	}, [wordCount]);

	return (
		<ParticipantEchoMessages
			{...args}
			echoMessages={[
				user("submit-1", ""),
				assistant("reply-1", REPLY_WORDS.slice(0, wordCount).join(" ")),
			]}
		/>
	);
};

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

/** The first echo request in flight. Two separate mechanisms put the spinning
 * placeholder on screen, and neither is the user message being rendered:
 *
 * - The placeholder is its own synthetic message, built inline with
 *   `assistant_reply` and `loading` hardcoded. It renders whenever `status` is
 *   neither `streaming` nor `ready` and there is no error, which in practice
 *   means `submitted`.
 * - It is inside the `echoMessages.length > 0` gate, so on a conversation with
 *   no prior replies something has to be in the array for it to render at all.
 *   The empty user message that submitting appends is what satisfies that,
 *   while itself rendering nothing.
 */
export const SubmittedAwaitingReply: Story = {
	args: {
		echoMessages: [user("submit-1", "")],
		isLoading: true,
		status: "submitted",
	},
};

/** Segments arriving. The last message renders with `loading`, so the spinner
 * sits on a partially written reply rather than on a placeholder.
 *
 * The segmentation is deliberate: the reply comes from Gemini 2.5 Pro through
 * LiteLLM, which hands back chunky multi-word spans rather than one token at a
 * time, and the server forwards each `delta.content` as it lands. A
 * character-at-a-time fixture would understate how much the block jumps as it
 * grows.
 *
 * The loop is the story's own artifice, so the state stays watchable in the
 * sidebar. Nothing restarts a real stream; it ends in `CompletedReply`. */
export const StreamingReply: Story = {
	args: {
		echoMessages: [],
		isLoading: true,
		status: "streaming",
	},
	render: (args) => <StreamingReplySegments {...args} />,
};

/** One finished reply. Each message carries a `min-h-[180px]` floor, so a short
 * reply still occupies a full card. */
export const CompletedReply: Story = {
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
