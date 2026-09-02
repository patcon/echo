/**
 * Stubs `navigator.mediaDevices` and `window.AudioContext` so
 * `MicrophoneTest` (`src/components/participant/MicrophoneTest.tsx`) can be
 * driven into its permission/device/volume states without a real microphone
 * or a browser permission prompt. Confirmed by grep before writing this: no
 * other `.stories.tsx` file in this repo touches these APIs, so there is no
 * existing convention to match — this establishes one.
 *
 * The patch is installed once, lazily, the first time a story asks for it via
 * `installMediaMock`; after that, stories just swap `currentConfig` in and
 * out, so there is only ever one active monkey-patch rather than a new layer
 * per story.
 */

export type FakeMicDevice = { deviceId: string; label: string };

export type MediaParameters =
	| { permission: "pending" }
	| { permission: "denied" }
	| {
			permission: "granted";
			devices?: FakeMicDevice[];
			/** deviceIds whose per-device `getUserMedia({ audio: { deviceId: { exact } } })`
			 * call should reject, even though the initial `getUserMedia({ audio: true })`
			 * used to enumerate devices succeeded. Simulates a device disappearing
			 * (unplugged, `OverconstrainedError`) after permission was already granted —
			 * `MicrophoneTest.tsx:237-243` never resets `micAccessGranted` in that catch,
			 * so this is the one state where the red error alert and the stale yellow
			 * "we cannot hear you" alert render at the same time. */
			failingDeviceIds?: string[];
			/** Raw analyser byte-domain value the fake `AnalyserNode` reports, 0-255.
			 * `MicrophoneTest.tsx:135-136` derives `avg = rms * 2` from this, and
			 * `SILENCE_THRESHOLD` is `2` (`:38`) — 128 (the default) means silence,
			 * anything a few units away from 128 crosses the threshold. */
			level?: number;
	  };

const DEFAULT_DEVICES: FakeMicDevice[] = [
	{ deviceId: "mock-mic-built-in", label: "Built-in Microphone" },
	{ deviceId: "mock-mic-usb-headset", label: "USB Headset Microphone" },
];

let currentConfig: MediaParameters | undefined;
let installed = false;

const fakeStream = (): MediaStream =>
	({
		getTracks: () => [{ stop: () => {} }],
	}) as unknown as MediaStream;

class FakeAnalyserNode {
	fftSize = 1024;
	smoothingTimeConstant = 0.8;
	frequencyBinCount = 512;
	getByteTimeDomainData(array: Uint8Array) {
		const level =
			currentConfig?.permission === "granted"
				? (currentConfig.level ?? 128)
				: 128;
		array.fill(level);
	}
}

class FakeAudioContext {
	createMediaStreamSource() {
		return { connect: () => {} };
	}
	createAnalyser() {
		return new FakeAnalyserNode();
	}
	close() {}
}

const requestedDeviceId = (
	constraints: MediaStreamConstraints | undefined,
): string | undefined => {
	const audio = constraints?.audio;
	if (typeof audio !== "object") return undefined;
	const deviceId = audio.deviceId;
	if (typeof deviceId === "string") return deviceId;
	if (
		deviceId &&
		typeof deviceId === "object" &&
		"exact" in deviceId &&
		typeof deviceId.exact === "string"
	) {
		return deviceId.exact;
	}
	return undefined;
};

const ensureInstalled = () => {
	if (installed) return;
	installed = true;

	navigator.mediaDevices.getUserMedia = async (constraints) => {
		const config = currentConfig;
		if (!config || config.permission === "pending") {
			// Never resolves — keeps `isLoadingDevices` true, matching the "still
			// requesting permission" window before the browser prompt is answered.
			return new Promise<MediaStream>(() => {});
		}
		if (config.permission === "denied") {
			throw new DOMException("Permission denied", "NotAllowedError");
		}
		const deviceId = requestedDeviceId(constraints);
		if (deviceId && config.failingDeviceIds?.includes(deviceId)) {
			throw new DOMException("Device unavailable", "NotReadableError");
		}
		return fakeStream();
	};

	navigator.mediaDevices.enumerateDevices = async () => {
		const config = currentConfig;
		if (!config || config.permission !== "granted") return [];
		return (config.devices ?? DEFAULT_DEVICES).map(
			(d) =>
				({
					deviceId: d.deviceId,
					groupId: "",
					kind: "audioinput",
					label: d.label,
				}) as MediaDeviceInfo,
		);
	};

	// @ts-expect-error — Storybook-only stub of a browser global, not a real AudioContext.
	window.AudioContext = FakeAudioContext;
};

export const installMediaMock = (config: MediaParameters) => {
	ensureInstalled();
	currentConfig = config;
};

export const resetMediaMock = () => {
	currentConfig = undefined;
};
