import type { Meta, StoryObj } from "@storybook/react-vite";
import { withParticipantLayout } from "../../../../.storybook/decorators";
import { VerifyArtefactLoading } from "./VerifyArtefactLoading";

/** The spinner `VerifyArtefact` shows while its queries are in flight. Takes no
 * props and has no branches, so there is exactly one state.
 *
 * Centres itself with `h-full`, so it needs a height-constrained ancestor. */
const meta = {
	component: VerifyArtefactLoading,
	decorators: [withParticipantLayout],
	parameters: {
		layout: "fullscreen",
	},
	title: "Participant/VerifyArtefactLoading",
} satisfies Meta<typeof VerifyArtefactLoading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
