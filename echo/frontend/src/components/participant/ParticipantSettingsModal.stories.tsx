import { Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, within } from "storybook/test";
import { ParticipantSettingsModal } from "./ParticipantSettingsModal";

/** A thin Mantine `Modal` wrapper (`opened`/`onClose` pass straight through,
 * `:18-20`) around `MicrophoneTest` (`:32-38`), which is where all the real
 * state lives: device enumeration, `getUserMedia`, an `AudioContext` level
 * meter, and a device-change sub-screen.
 *
 * This file intentionally does not story `MicrophoneTest`'s internal states
 * (permission denied, granted-but-silent, voice detected, device-change).
 * Confirmed by grep, not asserted from any doc: no `.stories.tsx` file in
 * this repo mocks `getUserMedia`/`enumerateDevices`/`AudioContext`, so there
 * is no existing seam to reach those states from here — jsdom has none of
 * these APIs, and `MicrophoneTest` is left to whatever it does by default
 * without them (verify what that is by opening `Open` below rather than
 * assuming a specific mic-permission UI).
 *
 * Like `PermissionErrorModal` and `StopRecordingConfirmationModal`, this
 * modal is portaled to `document.body` by Mantine, so the `Open` story's
 * `play` function queries `within(document.body)` rather than
 * `canvasElement`. */
const meta = {
	component: ParticipantSettingsModal,
	title: "Participant/ParticipantSettingsModal",
} satisfies Meta<typeof ParticipantSettingsModal>;

export default meta;

type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Playground
// ---------------------------------------------------------------------------

const PlaygroundHarness = () => {
	const [opened, { open, close }] = useDisclosure(false);
	return (
		<>
			<Button onClick={open}>Open settings</Button>
			<ParticipantSettingsModal onClose={close} opened={opened} />
		</>
	);
};

/** A trigger button plus the modal, so opening and closing (backdrop, the X,
 * Escape) all genuinely happen. `MicrophoneTest` inside renders whatever it
 * renders with no media APIs mocked — see the note above. */
export const Playground: Story = {
	args: {
		onClose: fn(),
		opened: false,
	},
	argTypes: {
		onClose: { table: { disable: true } },
		onMicTestSuccess: { table: { disable: true } },
		opened: { table: { disable: true } },
	},
	render: () => <PlaygroundHarness />,
};

// ---------------------------------------------------------------------------
// Pinned states
// ---------------------------------------------------------------------------

export const Closed: Story = {
	args: {
		onClose: fn(),
		opened: false,
	},
};

export const Open: Story = {
	args: {
		onClose: fn(),
		opened: true,
	},
	play: async () => {
		const modal = within(document.body);
		await modal.findByTestId("portal-settings-modal");
	},
};
