import { Stack } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { SentAgentInsight } from "@/lib/api";
import type { ParsedInsightNote } from "./agenticToolActivity";
import { InsightNoteCard } from "./InsightNoteCard";

/** The clearest example of what the agentic chat is reaching for: the assistant
 * does not only answer, it proposes.
 *
 * Specifically, the assistant never records an insight about the product. It
 * drafts one for the dembrane team, and this card is where the host reads it,
 * rewrites the wording, adds a note of their own, and sends it, or ignores it
 * outright. Nothing leaves the browser until the host clicks.
 *
 * Historical chats replay cards whose payload predates that consent step. Those
 * arrive with a mode of "noted", "edited" or "retracted" plus an insight id, and
 * keep their original read-only rendering.
 *
 * All of the above is a paraphrase of the component's own doc comment
 * (`InsightNoteCard.tsx:31-46`), which is worth reading in full.
 *
 * Provenance convention for this file: any claim that carries a `file:line` ref
 * was read out of that source. Anything without one is my own reading of the
 * code. The insight text in every story below is written by me as plausible
 * sample content; none of it comes from the app or from real usage.
 */
const meta = {
	component: InsightNoteCard,
	title: "Chat/InsightNoteCard",
} satisfies Meta<typeof InsightNoteCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const makeNote = (
	overrides: Partial<ParsedInsightNote> = {},
): ParsedInsightNote => ({
	content:
		"Hosts keep asking whether a conversation is still recording after they switch tabs, and the monitor does not say.",
	insightId: null,
	kind: "friction",
	mode: "proposed",
	reason: null,
	suggestedCapability: null,
	...overrides,
});

const makeSent = (
	overrides: Partial<SentAgentInsight> = {},
): SentAgentInsight => ({
	chat_id: "chat-story",
	content: makeNote().content,
	id: "insight-a1b2c3d4",
	kind: "friction",
	message_id: "message-story",
	status: "open",
	suggested_capability: null,
	...overrides,
});

// ---------------------------------------------------------------------------
// The draft, which is the whole point
// ---------------------------------------------------------------------------

/** The editable branch (`InsightNoteCard.tsx:87-156`). Two text areas: what
 * gets sent, which the host may rewrite (`:106`), and anything they want to add
 * (`:116`), which is appended under "From the host:" only when non-empty
 * (`:145-147`). */
export const Draft: Story = {
	args: { note: makeNote(), onSend: fn() },
};

/** When the assistant has a guess at what would fix the friction, it renders
 * under the text areas (`InsightNoteCard.tsx:125-129`) and is passed back to
 * `onSend` unchanged (`:148`). It is not editable, unlike the content. */
export const DraftWithCapability: Story = {
	args: {
		note: makeNote({
			suggestedCapability: "a persistent recording indicator in the tab title",
		}),
		onSend: fn(),
	},
	name: "Draft — with suggested capability",
};

/** Mid-send. */
export const Sending: Story = {
	args: { isSending: true, note: makeNote(), onSend: fn() },
};

/** A draft whose text is empty cannot be sent, so the button stays disabled
 * (`InsightNoteCard.tsx:88,143`). */
export const DraftEmpty: Story = {
	args: { note: makeNote({ content: "" }), onSend: fn() },
	name: "Draft — empty, send disabled",
};

// ---------------------------------------------------------------------------
// Sent state is derived, not stored
// ---------------------------------------------------------------------------

/** The card holds no "I sent this" flag. It matches its own (edited) content
 * against the insights this project has actually sent
 * (`InsightNoteCard.tsx:75-81`), so a reload still tells the truth and the host
 * cannot send the same note twice (`:73-74`).
 *
 * Same args as `Draft`, plus one matching row in `sentInsights`. */
export const AlreadySent: Story = {
	args: { note: makeNote(), onSend: fn(), sentInsights: [makeSent()] },
	name: "Already sent",
};

/** The match is narrow: archived rows are skipped (`InsightNoteCard.tsx:79`),
 * so identical content that was archived leaves the card a draft again. Worth
 * reading beside `AlreadySent`, where the only difference is `status`. */
export const ArchivedSentDoesNotCount: Story = {
	args: {
		note: makeNote(),
		onSend: fn(),
		sentInsights: [makeSent({ status: "archived" })],
	},
	name: "Already sent — archived does not count",
};

// ---------------------------------------------------------------------------
// The three read-only replay modes
// ---------------------------------------------------------------------------

/** Freshly noted, from a chat that predates the consent step
 * (`InsightNoteCard.tsx:44-46`). Read-only. */
export const Noted: Story = {
	args: { note: makeNote({ insightId: "a1b2c3d4", mode: "noted" }) },
};

/** Amended by id. Picks up an "updated" chip (`InsightNoteCard.tsx:173-177`). */
export const Edited: Story = {
	args: { note: makeNote({ insightId: "a1b2c3d4", mode: "edited" }) },
};

/** Withdrawn. The card mutes (`InsightNoteCard.tsx:68-69`), adds a "retracted"
 * chip (`:178-184`), and shows the reason when one came through (`:214-218`). */
export const Retracted: Story = {
	args: {
		note: makeNote({
			insightId: "a1b2c3d4",
			mode: "retracted",
			reason: "the monitor already shows this, I misread it",
		}),
	},
};

/** Deleted by the host. Dismissing a draft is local state with nothing to undo
 * (`InsightNoteCard.tsx:36-37`), but a dismissed sent insight says "This insight
 * has been deleted" in red (`:219-223`). The Remove button only appears on a
 * card with an insight id that is not already dismissed (`:71`). */
export const Dismissed: Story = {
	args: {
		dismissed: true,
		note: makeNote({ insightId: "a1b2c3d4", mode: "noted" }),
		onDismiss: fn(),
	},
};

// ---------------------------------------------------------------------------
// The four kinds
// ---------------------------------------------------------------------------

/** Every kind the parser accepts (`agenticToolActivity.ts:566-570`). The chips
 * are lowercase on purpose: they read as quiet chips, not headings
 * (`InsightNoteCard.tsx:11`).
 *
 * The four sample texts are mine. */
export const Kinds: Story = {
	args: { note: makeNote() },
	render: () => (
		<Stack gap="md">
			<InsightNoteCard
				note={makeNote({
					content: "There is no way to see which conversations are still live.",
					kind: "capability_gap",
				})}
				onSend={fn()}
			/>
			<InsightNoteCard
				note={makeNote({
					content: "Tagging four conversations took four separate modals.",
					kind: "friction",
				})}
				onSend={fn()}
			/>
			<InsightNoteCard
				note={makeNote({
					content: "The host wanted to export just the quotes, not the report.",
					kind: "wish",
				})}
				onSend={fn()}
			/>
			<InsightNoteCard
				note={makeNote({
					content: "The QR flow worked first time with a room of forty people.",
					kind: "praise",
				})}
				onSend={fn()}
			/>
		</Stack>
	),
};
