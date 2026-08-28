import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { ChatHistoryMessage } from "./ChatHistoryMessage";

// The route the preview decorator mounts every story on. Several branches only
// render when the id in the content matches the one in the URL.
const projectId = "project-story";

/** `ChatHistory[number]` is a global ambient type, so nothing is imported for
 * it. Two fields are supplied that the type does not declare:
 *
 *  - `createdAt`, which the component reads behind a `@ts-expect-error` and
 *    every real caller passes anyway.
 *  - `conversation_title` on metadata, which `References` reads to label a
 *    citation and which is likewise absent from `ProjectChatMessageMetadata`.
 *
 * Hence the cast. Both are noted in the PR as things to reconcile in the types.
 */
const makeMessage = (overrides: Record<string, unknown>): ChatHistory[number] =>
	({
		_original: { added_conversations: [] },
		content: "",
		createdAt: "2026-07-08T12:00:00Z",
		id: "message-story",
		metadata: [],
		role: "assistant",
		...overrides,
	}) as unknown as ChatHistory[number];

const meta = {
	component: ChatHistoryMessage,
	title: "Chat/ChatHistoryMessage",
} satisfies Meta<typeof ChatHistoryMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// The two ordinary bubbles
// ---------------------------------------------------------------------------

export const UserMessage: Story = {
	args: {
		message: makeMessage({
			content: "What did people say about the new bike lanes?",
			role: "user",
		}),
	},
	name: "User message",
};

export const AssistantMessage: Story = {
	args: {
		message: makeMessage({
			content:
				"Residents split roughly two to one in favour. The objections clustered on **parking loss** rather than on the lanes themselves.\n\n- Three people raised deliveries\n- Two raised accessible parking",
		}),
	},
	name: "Assistant message",
};

/** The bookmark only appears on a user message, and only when the caller can
 * do something with it. */
export const SaveAsTemplate: Story = {
	args: {
		message: makeMessage({
			content: "Summarise every conversation by neighbourhood.",
			role: "user",
		}),
		onSaveAsTemplate: fn(),
	},
	name: "User message — save as template",
};

// ---------------------------------------------------------------------------
// The two that deliberately render nothing
// ---------------------------------------------------------------------------

/** System messages are dropped outright: an empty canvas is correct here. */
export const SystemRendersNothing: Story = {
	args: {
		message: makeMessage({ content: "You are a helpful…", role: "system" }),
	},
	name: "System — renders nothing",
};

/** So is an assistant turn that arrived with no text. */
export const EmptyContentRendersNothing: Story = {
	args: { message: makeMessage({ content: "" }) },
	name: "Empty content — renders nothing",
};

// ---------------------------------------------------------------------------
// Sources and citations
// ---------------------------------------------------------------------------

/** Metadata of type `reference` puts a banner above the bubble naming the
 * conversations that were pulled into context without anyone asking. */
export const AutoAddedSources: Story = {
	args: {
		message: makeMessage({
			content: "Two conversations mention the market square directly.",
			metadata: [
				{
					conversation: { id: "conversation-1", participant_name: "Rosa" },
					conversation_title: "Market square, Tuesday",
					type: "reference",
				},
				{
					conversation: { id: "conversation-2", participant_name: "Sam" },
					conversation_title: "Cyclists, Thursday",
					type: "reference",
				},
			],
		}),
	},
	name: "Auto-added sources",
};

const citationMessage = makeMessage({
	content: "People asked for benches before they asked for anything else.",
	id: "message-citations",
	metadata: [
		{
			conversation: { id: "conversation-1", participant_name: "Rosa" },
			conversation_title: "Market square, Tuesday",
			reference_text: "I would sit there if there were somewhere to sit.",
			type: "citation",
		},
		{
			conversation: { id: "conversation-2", participant_name: "Sam" },
			conversation_title: "Cyclists, Thursday",
			reference_text: "Benches, honestly. That is the whole ask.",
			type: "citation",
		},
	],
});

/** `referenceIds` / `setReferenceIds` are a controlled pair owned by the parent
 * chat. Both stories below need the setter, not just the value: the toggle
 * handler is wrapped in `if (setReferenceIds)`, so a story that passes only
 * the array renders the button and then silently swallows every click. */
const CitationsHarness = ({ open }: { open: boolean }) => {
	const [referenceIds, setReferenceIds] = useState(
		open ? [citationMessage.id] : [],
	);
	return (
		<ChatHistoryMessage
			message={citationMessage}
			referenceIds={referenceIds}
			setReferenceIds={setReferenceIds}
		/>
	);
};

/** Citations start folded away behind the icon in the footer. Click it. */
export const CitationsCollapsed: Story = {
	args: { message: citationMessage },
	name: "Citations — collapsed",
	render: () => <CitationsHarness open={false} />,
};

/** The same message with the citations already showing. */
export const CitationsExpanded: Story = {
	args: { message: citationMessage },
	name: "Citations — expanded",
	render: () => <CitationsHarness open />,
};

// ---------------------------------------------------------------------------
// The portal QR code
// ---------------------------------------------------------------------------

/** An assistant message whose text contains a link to this project's own
 * participant portal grows a QR code under it, so a host can hold the screen
 * up in a room. The match is strict: same origin as PARTICIPANT_BASE_URL, and
 * the project id in the path has to be the one in the route. A link to any
 * other project renders as an ordinary link. */
export const PortalStartQrCode: Story = {
	args: {
		message: makeMessage({
			content: `Share this with the room: http://localhost:5174/en-US/${projectId}/start`,
		}),
	},
	name: "Portal start link — QR code",
};

// ---------------------------------------------------------------------------
// Agentic link handling (only when chatMode is "agentic")
// ---------------------------------------------------------------------------

/** Footnote hops stay inside the message: clicking the superscript scrolls to
 * the definition and flashes it, rather than rewriting the URL and stacking a
 * history entry the way a plain fragment link would. The ↩ back-references are
 * stripped, since the superscript that brought you down is still on screen. */
export const AgenticFootnotes: Story = {
	args: {
		chatMode: "agentic",
		message: makeMessage({
			content:
				"Parking came up more than cycling did.[^1] Deliveries came up twice.[^2]\n\n[^1]: Market square, Tuesday\n[^2]: Cyclists, Thursday",
			id: "message-footnotes",
		}),
	},
	name: "Agentic — footnote hop",
};

/** A docs.dembrane.com link opens a chooser rather than navigating away, so a
 * reader mid-answer is not thrown out of the chat. */
export const AgenticDocsLink: Story = {
	args: {
		chatMode: "agentic",
		message: makeMessage({
			content:
				"You can narrow this by tag. [How Ask works](https://docs.dembrane.com/users/host/chat-and-ask.html) covers it.",
		}),
	},
	name: "Agentic — docs link",
};

/** Any href containing `/conversations/` or `/transcript` is treated as a
 * transcript link: tooltip, arrow icon, and its own testid. */
export const AgenticTranscriptLink: Story = {
	args: {
		chatMode: "agentic",
		message: makeMessage({
			content: `Rosa said it plainly in [her conversation](/en-US/w/workspace-story/projects/${projectId}/conversations/conversation-1).`,
		}),
	},
	name: "Agentic — transcript link",
};

/** Everything else stays an ordinary anchor. Worth having beside the two above
 * to see that the special-casing is actually narrow. */
export const AgenticPlainLink: Story = {
	args: {
		chatMode: "agentic",
		message: makeMessage({
			content:
				"The council report is at [example.org](https://example.org/report).",
		}),
	},
	name: "Agentic — plain link",
};

// ---------------------------------------------------------------------------
// The dembrane role
// ---------------------------------------------------------------------------

/** The searching notice, shown while the agent is looking through sources. */
export const SearchedSources: Story = {
	args: { message: makeMessage({ content: "searched", role: "dembrane" }) },
	name: "Searched through sources",
};

/** "Context added:" plus the conversations the person attached themselves.
 *
 * The labels come out blank, and that is a real defect rather than a thin
 * fixture. The component maps `added_conversations` down to whatever sits in
 * `conversation_id` and casts the result to `Conversation[]`; when the API
 * sends ids as plain strings, `ConversationLinks` then reads `.id` and
 * `.participant_name` off a string and gets `undefined` for both. Populated
 * objects render correctly, which is what the second story shows. */
export const ContextAddedUnlabelled: Story = {
	args: {
		message: makeMessage({
			_original: {
				added_conversations: [
					{ conversation_id: "conversation-1" },
					{ conversation_id: "conversation-2" },
				],
			},
			role: "dembrane",
		}),
	},
	name: "Context added — blank labels (defect)",
};

/** The same branch when `conversation_id` arrives expanded. */
export const ContextAdded: Story = {
	args: {
		message: makeMessage({
			_original: {
				added_conversations: [
					{
						conversation_id: { id: "conversation-1", participant_name: "Rosa" },
					},
					{
						conversation_id: { id: "conversation-2", participant_name: "Sam" },
					},
				],
			},
			role: "dembrane",
		}),
	},
	name: "Context added",
};
