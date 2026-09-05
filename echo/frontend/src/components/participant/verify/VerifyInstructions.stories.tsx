import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { withParticipantLayout } from "../../../../.storybook/decorators";
import { VerifyInstructions } from "./VerifyInstructions";

/** Reproduces the audio route's `<Outlet />` wrapper, which is what actually
 * constrains this screen's height and width in the app. */
const withConversationOutlet: Decorator = (Story) => (
	<div className="container mx-auto flex h-full max-w-2xl flex-col justify-end">
		<div className="relative flex-grow p-4">
			<Story />
		</div>
	</div>
);

/** The five-step explainer `VerifySelection` shows while an artefact generates.
 * Pure props. `objectLabel` is interpolated into four of the five steps, so it
 * is the arg worth playing with in the controls panel.
 *
 * `isLoading` and `canProceed` both gate the Next button but are not
 * redundant: only `isLoading` swaps the arrow for a spinner. */
const meta = {
	args: {
		objectLabel: "hidden gem",
		onNext: fn(),
	},
	component: VerifyInstructions,
	decorators: [withConversationOutlet, withParticipantLayout],
	parameters: {
		layout: "fullscreen",
	},
	title: "Participant/VerifyInstructions",
} satisfies Meta<typeof VerifyInstructions>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Generation has finished and an artefact id is in hand. */
export const Default: Story = {
	args: {
		canProceed: true,
		isLoading: false,
	},
};

/** Generation in flight. Note the step circles are blue here and grey when
 * idle, which is the opposite of how the rest of the portal signals progress. */
export const Generating: Story = {
	args: {
		canProceed: false,
		isLoading: true,
	},
};

/** The gap state: the mutation has settled but no artefact id arrived, so Next
 * stays disabled with no spinner to explain why. */
export const WaitingToProceed: Story = {
	args: {
		canProceed: false,
		isLoading: false,
	},
};
