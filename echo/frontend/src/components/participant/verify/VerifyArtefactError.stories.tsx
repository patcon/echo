import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { withParticipantLayout } from "../../../../.storybook/decorators";
import { VerifyArtefactError } from "./VerifyArtefactError";

/** Shown when any of `VerifyArtefact`'s three queries errors. Pure props, no
 * state, so `isReloading` is the only branch: it drives the Reload button's
 * loader and disables both buttons. */
const meta = {
	args: {
		onGoBack: fn(),
		onReload: fn(),
	},
	component: VerifyArtefactError,
	decorators: [withParticipantLayout],
	parameters: {
		layout: "fullscreen",
	},
	title: "Participant/VerifyArtefactError",
} satisfies Meta<typeof VerifyArtefactError>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		isReloading: false,
	},
};

/** Reload swaps its icon for a loader and both buttons go disabled, so the
 * participant cannot queue a second refetch or navigate mid-flight. */
export const Reloading: Story = {
	args: {
		isReloading: true,
	},
};
