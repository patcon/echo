import { Stack, Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SuggestionCardFrame } from "./SuggestionCardFrame";

/** The shared border every proposal the assistant makes is drawn inside.
 *
 * Provenance convention for this file: any claim that carries a `file:line` ref
 * was read out of that source. Anything without one is my own reading of the
 * code and should be checked before you rely on it. All the sample copy in
 * these stories is written by me, not taken from the app.
 *
 * Worth knowing what the frame deliberately does not do: there is no `w-full`.
 * Blocks in the chat column size to their content and the max-width is only a
 * ceiling, so a short card ends where its text ends rather than trailing an
 * empty border across the column (`SuggestionCardFrame.tsx:19-21`).
 * `ShortContent` below is the story that makes that visible.
 */
const meta = {
	component: SuggestionCardFrame,
	title: "Common/SuggestionCardFrame",
} satisfies Meta<typeof SuggestionCardFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

const Body = () => (
	<Stack gap="xs">
		<Text size="sm" fw={500}>
			Add a tag for accessibility
		</Text>
		<Text size="sm">
			Four conversations raised step-free access without anyone asking about it.
			A tag would let you filter them together.
		</Text>
	</Stack>
);

/** The default ceiling: 80% of the chat column (`SuggestionCardFrame.tsx:25`),
 * with roomy padding. */
export const Default: Story = {
	args: { children: <Body /> },
};

/** `compact` tightens the vertical padding only, `py="xs"` instead of `"md"`
 * (`SuggestionCardFrame.tsx:28`).
 *
 * My reading, not sourced: it exists for cards that appear in a run, where full
 * padding stacks into a wall. */
export const Compact: Story = {
	args: { children: <Body />, compact: true },
};

/** `tight` is the narrower treatment: a 36rem ceiling instead of 80%
 * (`SuggestionCardFrame.tsx:24`) and `px="sm"` (`:27`). The prop's own comment
 * says why: for small cards, like a drafted insight, that would read as loose at
 * full width (`SuggestionCardFrame.tsx:12-13`). */
export const Tight: Story = {
	args: { children: <Body />, tight: true },
};

/** Both together, which is what `InsightNoteCard` actually passes
 * (`InsightNoteCard.tsx:90,161`). */
export const CompactAndTight: Story = {
	args: { children: <Body />, compact: true, tight: true },
	name: "Compact and tight",
};

/** The no-`w-full` decision (`SuggestionCardFrame.tsx:19-21`), made visible.
 * The border stops at the word instead of running out to the ceiling. */
export const ShortContent: Story = {
	args: { children: <Text size="sm">Noted.</Text> },
	name: "Short content",
};
