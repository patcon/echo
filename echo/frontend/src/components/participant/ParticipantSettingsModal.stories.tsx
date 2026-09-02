import { Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { MediaParameters } from "../../../.storybook/preview";
import { ParticipantSettingsModal } from "./ParticipantSettingsModal";

/** A thin Mantine `Modal` wrapper (`opened`/`onClose` pass straight through,
 * `:18-20`) around `MicrophoneTest` (`:32-38`), which is where all the real
 * state lives: device enumeration, `getUserMedia`, an `AudioContext` level
 * meter, and a device-change sub-screen.
 *
 * Every story here is the same interactive harness — a trigger button plus
 * the modal, opened by default — differing only in `parameters.media`
 * (`.storybook/mocks/media.ts`), which stubs `navigator.mediaDevices` and
 * `window.AudioContext` so `MicrophoneTest` can be driven through its real
 * permission/device/volume branches without a browser permission prompt or an
 * actual microphone. Closing and reopening the modal, or picking a different
 * device from the dropdown, all genuinely work in every story below — none
 * of them pin a static render the way the other files in this directory do.
 *
 * Not covered by the mock: the device-change confirmation screen
 * (`showSecondModal`, `MicrophoneTest.tsx:419-450`). It is pure UI state with
 * no media call behind it — reachable in any granted story by picking the
 * other device from the dropdown and pressing Continue — so it does not need
 * its own `parameters.media` config, just a `play` function or a manual
 * click; left manual here rather than automated against a Mantine `Select`,
 * which no other story in this repo drives via `play`.
 *
 * `RealMic` below is the one exception: it sets no `parameters.media` at all,
 * so `withMediaMocks` (`.storybook/preview.tsx`) leaves the browser's real
 * `getUserMedia`/`enumerateDevices`/`AudioContext` in place, and the story
 * behaves exactly like the real app — including a real permission prompt. */
const meta = {
	component: ParticipantSettingsModal,
	title: "Participant/ParticipantSettingsModal",
} satisfies Meta<typeof ParticipantSettingsModal>;

export default meta;

type Story = StoryObj<typeof meta> & {
	parameters?: { media?: MediaParameters };
};

const Harness = () => {
	const [opened, { open, close }] = useDisclosure(true);
	return (
		<>
			<Button onClick={open}>Open settings</Button>
			<ParticipantSettingsModal onClose={close} opened={opened} />
		</>
	);
};

const harnessStory = (media?: MediaParameters): Story => ({
	args: {
		onClose: fn(),
		opened: true,
	},
	argTypes: {
		onClose: { table: { disable: true } },
		onMicTestSuccess: { table: { disable: true } },
		opened: { table: { disable: true } },
	},
	parameters: media ? { media } : {},
	render: () => <Harness />,
});

/** No `parameters.media` — the real browser APIs are live, so this behaves
 * exactly like the real app: a real permission prompt, your actual
 * microphones in the dropdown, and a real analyser reading whatever your mic
 * picks up. The one story here you cannot fully predict from reading the
 * code. */
export const RealMic: Story = harnessStory();

/** The initial `getUserMedia({ audio: true })` call (`:67-69`) never
 * resolves, so `isLoadingDevices` stays true forever: disabled `Select`, blue
 * "Requesting microphone access…" alert (`:366-376`). */
export const Loading: Story = harnessStory({ permission: "pending" });

/** The initial `getUserMedia` call rejects (`:99-110`). Red "Microphone
 * permission is required…" alert; the yellow "please allow access" prompt
 * never shows in this state — it's gated on `!micAccessDenied` too. */
export const PermissionDenied: Story = harnessStory({ permission: "denied" });

/** Permission granted, but `enumerateDevices()` returns no audio inputs, so
 * `selectedDeviceId` never gets set and the per-device setup effect bails out
 * before it starts (`:177`, `if (!selectedDeviceId) return`) — the analyser
 * never runs. Visually indistinguishable from `Silent` below: both show the
 * yellow "we cannot hear you" alert, because the UI has no way to tell "no
 * device" apart from "device present but quiet". */
export const GrantedNoDevices: Story = harnessStory({
	devices: [],
	permission: "granted",
});

/** Permission granted, a device selected, no signal at all: `avg: 0`
 * (`MicrophoneTest.tsx:136`). Yellow "We cannot hear you…" alert
 * (`:390-400`), progress bar yellow, Continue disabled. */
export const Silent: Story = harnessStory({
	avg: 0,
	permission: "granted",
});

/** The near-miss version of `Silent`: `avg: 2` matches `SILENCE_THRESHOLD`
 * (`:38`) exactly rather than sitting comfortably under it. The success check
 * is `avg > SILENCE_THRESHOLD` (`:152`), so equal still fails — someone
 * speaking is almost, but not quite, loud enough. Yellow alert, same as
 * `Silent`, and — as of `level <= SILENCE_THRESHOLD` at `:339` — a yellow
 * progress bar too.
 *
 * That bar comparison used to be a strict `<`, which disagreed with the
 * success check's strict `>` at this exact boundary: `MicrophoneTest`'s own
 * `level` state is set to `avg` (`:143-149`), so `avg === SILENCE_THRESHOLD`
 * made `level < SILENCE_THRESHOLD` false (bar reads blue, a "good signal"
 * color) while `avg > SILENCE_THRESHOLD` was also false (alert still says
 * "we cannot hear you") — this story is what surfaced it. Fixed now by
 * making the bar's threshold inclusive to match, so this story currently
 * shows a fully consistent "too quiet" state rather than the disagreement
 * that found the bug. A real microphone's level fluctuates continuously and
 * essentially never lands on this exact value; only a perfectly constant
 * mock does. */
export const TooLow: Story = harnessStory({
	avg: 2,
	permission: "granted",
});

/** Comfortably above `SILENCE_THRESHOLD` (`:38`), so `isMicTestSuccessful` is
 * true from the first analyser tick. Green "Everything looks good" alert
 * (`:381-389`), progress bar blue, Continue enabled (`:410`). */
export const VoiceDetected: Story = harnessStory({
	avg: 24,
	permission: "granted",
});

/** The per-device `getUserMedia({ audio: { deviceId: { exact } } })` call
 * (`:213-215`) rejects for the auto-selected first device, even though the
 * initial permission-check call already succeeded. The catch at `:237-243`
 * sets `micAccessDenied` but never resets `micAccessGranted` back to false,
 * so both are true at once: the red error alert and the stale yellow "we
 * cannot hear you" alert render stacked, together — a state the component
 * likely never intended to produce, since nothing in the UI distinguishes it
 * from two unrelated problems happening to coincide. */
export const DeviceStreamFailure: Story = harnessStory({
	devices: [{ deviceId: "mock-mic-flaky", label: "Flaky USB Microphone" }],
	failingDeviceIds: ["mock-mic-flaky"],
	permission: "granted",
});
