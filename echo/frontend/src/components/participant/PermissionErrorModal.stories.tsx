import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { PermissionErrorModal } from "./PermissionErrorModal";

/** Mantine renders `Modal` into a portal at the document root, so `opened` is
 * the only thing controlling whether anything is visible at all — there is no
 * `onClose` seam (`:33` passes a no-op), which makes this a permanent lockout
 * screen once `permissionError` is truthy.
 *
 * Not storied: `permissionError: null`. The modal renders nothing in that
 * case, and an empty canvas is not a state worth a story of its own.
 *
 * Not exercised in either story: "Check microphone access" (`:65-74`), which
 * calls `checkPermissionError()` (`@/lib/utils`, itself calling
 * `navigator.permissions.query`) and then either `window.location.reload()`
 * or a toast. There is no prop seam to intercept either outcome, so clicking
 * it here risks reloading the Storybook iframe — left real and un-clicked.
 *
 * `TroubleshootingGuideOpened` below drives its `play` function through
 * `within(document.body)` rather than `canvasElement`, since the modal is
 * portaled out of the story root — confirmed in this repo by the working
 * `play` function in `StopRecordingConfirmationModal.stories.tsx` (its
 * `Verify prompt` story queries `document.body` for the same reason). A
 * `canvasElement` query here finds nothing. */
const meta = {
	component: PermissionErrorModal,
	title: "Participant/PermissionErrorModal",
} satisfies Meta<typeof PermissionErrorModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		permissionError: "NotAllowedError",
	},
};

/** After "Open troubleshooting guide" is clicked, `troubleShootingGuideOpened`
 * flips and the two buttons swap visual weight: the troubleshooting button
 * drops from `xl`/`filled` to `lg`/`light`, and "Check microphone access"
 * grows from `lg`/`light` to `xl`/`filled` (`:55-57`, `:66-68`) — nudging
 * toward the next step once the guide has been opened. */
export const TroubleshootingGuideOpened: Story = {
	args: {
		permissionError: "NotAllowedError",
	},
	play: async () => {
		const modal = within(document.body);
		await userEvent.click(await modal.findByText("Open troubleshooting guide"));
	},
};
