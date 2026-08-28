import { Stack } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatModeBanner } from "./ChatModeBanner";

/** The strip above the composer naming which of the three chat modes is active.
 *
 * The modes are the product's three answers to "what is this chat for":
 * `overview` reads across every conversation in the project, `deep_dive` reads
 * only the ones the host picked from the sidebar, and `agentic` lets the
 * assistant call tools and propose changes back to the project. The banner is
 * the one place all three are stated in the host's own words rather than as
 * an enum, which is why it is worth a story despite being sixty lines.
 *
 * It is a pure function of two props (`ChatModeBanner.tsx:12-15`) — no hooks,
 * no queries — so every state below is reachable by args alone.
 *
 * Provenance convention for this file: any claim that carries a `file:line` ref
 * was read out of that source. Anything without one is my own reading of the
 * code and should be checked before you rely on it.
 */
const meta = {
	component: ChatModeBanner,
	title: "Chat/ChatModeBanner",
} satisfies Meta<typeof ChatModeBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// The three modes
// ---------------------------------------------------------------------------

/** Reads across the whole project, so the count is descriptive — "exploring N"
 * (`ChatModeBanner.tsx:49`), not a selection the host made. The only mode
 * carrying a Beta badge (`:42-46`). */
export const Overview: Story = {
	args: { conversationCount: 24, mode: "overview" },
};

/** Reads only what the host selected, so the same number means something else
 * here: "N selected" (`ChatModeBanner.tsx:53`). Worth reading beside `Overview`
 * — same prop, same number, different claim. */
export const DeepDive: Story = {
	args: { conversationCount: 3, mode: "deep_dive" },
	name: "Deep dive",
};

/** Ignores the count entirely and says "Live agent execution mode"
 * (`ChatModeBanner.tsx:51`).
 *
 * My reading, not sourced: the count is dropped because in this mode the
 * assistant chooses its own context through tool calls, so a number the host
 * fixed up front would misdescribe what it is about to read. */
export const Agentic: Story = {
	args: { conversationCount: 24, mode: "agentic" },
};

// ---------------------------------------------------------------------------
// The empty-selection branch
// ---------------------------------------------------------------------------

/** Deep dive is the only mode that can be under-specified, and the only one
 * whose banner turns into an instruction: at zero it reads "Select
 * conversations from sidebar" (`ChatModeBanner.tsx:55`).
 *
 * The other two modes have no such branch — overview at zero still says
 * "Exploring 0 conversations". */
export const DeepDiveNothingSelected: Story = {
	args: { conversationCount: 0, mode: "deep_dive" },
	name: "Deep dive — nothing selected",
};

// ---------------------------------------------------------------------------
// Side by side
// ---------------------------------------------------------------------------

/** All three at once, which is the point of the component: each mode carries
 * its own colour from the shared `MODE_COLORS` palette
 * (`ChatModeSelector.tsx:27-49`) — spring green, cyan, orange — used for the
 * icon, the border and a tenth-opacity background fill
 * (`ChatModeBanner.tsx:22-25`).
 *
 * The icon splits two-against-one rather than three ways: overview and agentic
 * both get the sparkle, deep dive gets the speech bubble
 * (`ChatModeBanner.tsx:32-36`), so colour is the only thing separating the
 * first two. */
export const AllModes: Story = {
	args: { conversationCount: 24, mode: "overview" },
	name: "All modes",
	render: () => (
		<Stack gap="sm">
			<ChatModeBanner conversationCount={24} mode="overview" />
			<ChatModeBanner conversationCount={3} mode="deep_dive" />
			<ChatModeBanner conversationCount={24} mode="agentic" />
		</Stack>
	),
};
