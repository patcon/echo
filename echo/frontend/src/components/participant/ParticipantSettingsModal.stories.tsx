import { Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
	levelForAvg,
	type MediaParameters,
	SILENT_LEVEL,
} from "../../../.storybook/mocks/media";
import { ParticipantSettingsModal } from "./ParticipantSettingsModal";

/** Mirrors `MicrophoneTest.tsx:38`'s own `SILENCE_THRESHOLD`. Not imported —
 * that constant lives inside the component function and isn't exported —
 * duplicated here so `TooLow` and `VoiceDetected` can derive their `level`
 * from it via `levelForAvg` instead of hand-picking a byte value. */
const SILENCE_THRESHOLD = 2;

/** `TooLow`'s raw analyser byte, derived rather than hand-picked: the level
 * that makes `avg` (`MicrophoneTest.tsx:135-136`) land exactly at
 * `SILENCE_THRESHOLD` — too quiet to pass, by definition, not by guesswork. */
const LOW_AUDIO_LEVEL_BYTES = levelForAvg(SILENCE_THRESHOLD);

/** `VoiceDetected`'s raw analyser byte: derived from a margin comfortably
 * above `SILENCE_THRESHOLD` (arbitrary multiplier, just meant to be
 * unambiguously loud) so `avg` clears the threshold with room to spare. */
const SUFFICIENT_AUDIO_LEVEL_BYTES = levelForAvg(SILENCE_THRESHOLD * 12);

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
	parameters: {
		// Storybook's default `layout: "padded"` pads the canvas root on the
		// left only in this modal's case (Mantine centers the modal in that
		// padded box, not the real viewport), so it reads off-center.
		layout: "fullscreen",
	},
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
			<Button onClick={open} m="md">
				Open settings
			</Button>
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

/** Permission granted, a device selected, no signal at all: `SILENT_LEVEL` is
 * the analyser's midpoint, so `avg` (`MicrophoneTest.tsx:135-136`) comes out
 * to exactly `0`. Yellow "We cannot hear you…" alert (`:390-400`), progress
 * bar yellow, Continue disabled. */
export const Silent: Story = harnessStory({
	level: SILENT_LEVEL,
	permission: "granted",
});

/** The near-miss version of `Silent`: `LOW_AUDIO_LEVEL_BYTES` puts `avg` at
 * exactly `SILENCE_THRESHOLD`, matching it (`:38`) rather than sitting
 * comfortably under it. The success check is `avg > SILENCE_THRESHOLD`
 * (`:152`), so equal still fails — someone speaking is almost, but not quite,
 * loud enough. Yellow alert, same as `Silent`, and — as of `level <=
 * SILENCE_THRESHOLD` at `:339` — a yellow progress bar too.
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
	level: LOW_AUDIO_LEVEL_BYTES,
	permission: "granted",
});

/** Comfortably above `SILENCE_THRESHOLD` (`:38`): `SUFFICIENT_AUDIO_LEVEL_BYTES`
 * makes `avg` (`MicrophoneTest.tsx:135-136`) clear the threshold with room to
 * spare, so `isMicTestSuccessful` is true from the first analyser tick. Green
 * "Everything looks good" alert (`:381-389`), progress bar blue, Continue
 * enabled (`:410`). */
export const VoiceDetected: Story = harnessStory({
	level: SUFFICIENT_AUDIO_LEVEL_BYTES,
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
