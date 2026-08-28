import { Group, Stack, Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ParticipantState } from "@/hooks/useConversationMonitor";
import { StatePill } from "./StatePill";

/** The host's live view of a room is built out of these thirteen words. The
 * `ParticipantState` union (`useConversationMonitor.ts:16-29`) is the platform's
 * model of a conversation in progress, and this pill is where a host reads it,
 * so the story that enumerates every state doubles as the vocabulary list.
 *
 * Provenance convention for this file: any claim that carries a `file:line` ref
 * was read out of that source. Anything without one is my own reading of the
 * code and should be checked before you rely on it.
 *
 * The colour scheme carries meaning, and all four rules below are stated in
 * comments in the component itself:
 *
 *  - Grey (`waiting`, `initiated`, `idle`) means nothing to act on
 *    (`StatePill.tsx:32-33`).
 *  - Yellow groups `paused`, `left` and `backgrounded`: the participant reached
 *    the recording page but audio is not flowing, so a host may want to walk
 *    over. All three take the existing `paused` treatment rather than each
 *    inventing a colour (`StatePill.tsx:40-43`).
 *  - `offline` is the only filled pill, because mauve's light tint is near-white
 *    and offline has to stand out (`StatePill.tsx:37-38`).
 *  - `recording` is the only pulsing dot (`StatePill.tsx:19`, rendered at
 *    `:84-86`).
 */
const meta = {
	component: StatePill,
	title: "Conversation/StatePill",
} satisfies Meta<typeof StatePill>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Declared in the same order as the union
 * (`useConversationMonitor.ts:16-29`), so a state added there but not to
 * `stateMeta`'s switch (`StatePill.tsx:16-51`) shows up here as the grey `Idle`
 * default (`:48-49`) rather than disappearing. */
const ALL_STATES: ParticipantState[] = [
	"initiated",
	"waiting",
	"recording",
	"paused",
	"verifying",
	"refining",
	"finishing",
	"finished",
	"text",
	"backgrounded",
	"offline",
	"left",
	"idle",
];

const StateTable = () => (
	<Stack gap="xs">
		{ALL_STATES.map((state) => (
			<Group key={state} gap="md" wrap="nowrap">
				<Text size="xs" ff="monospace" w={140}>
					{state}
				</Text>
				<StatePill state={state} />
			</Group>
		))}
	</Stack>
);

// ---------------------------------------------------------------------------
// The whole vocabulary
// ---------------------------------------------------------------------------

/** Every state the monitor can report, raw value beside rendered pill.
 *
 * The label often does not repeat the state name: `refining` reads as
 * "Exploring", `waiting` as "On recording page", `backgrounded` as "Away"
 * (`StatePill.tsx:25,34,47`).
 *
 * My reading, not sourced: that gap looks deliberate, an internal vocabulary
 * and a host-facing one kept separate. The labels are real; the intent is a
 * guess. */
export const AllStates: Story = {
	args: { state: "recording" },
	name: "All states",
	render: () => <StateTable />,
};

/** The same table under a Dutch route. Every label is a `t` macro
 * (`StatePill.tsx:16-51`), so this is the cheapest check that the pill is fully
 * translated, and that the story locale is activating inside the router
 * (`.storybook/preview.tsx:47-60`). */
export const Dutch: Story = {
	args: { state: "recording" },
	name: "All states — Dutch",
	parameters: {
		router: {
			path: "/nl-NL/w/workspace-story/projects/project-story/chats/chat-story",
		},
	},
	render: () => <StateTable />,
};

// ---------------------------------------------------------------------------
// The two states that render differently from every other
// ---------------------------------------------------------------------------

/** The only pulsing dot (`StatePill.tsx:19`). Audio is arriving right now. */
export const Recording: Story = {
	args: { state: "recording" },
};

/** The only filled pill (`StatePill.tsx:39`), so it stays legible where the
 * light tints blur together. */
export const Offline: Story = {
	args: { state: "offline" },
};

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/** Use the Controls tab to step through the union one state at a time. */
export const Playground: Story = {
	args: { state: "verifying" },
};
