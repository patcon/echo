/**
 * Fakes `MediaRecorder` so `useChunkedAudioRecorder`
 * (`src/components/participant/hooks/useChunkedAudioRecorder.ts`) can run for
 * real inside a story: the hook itself is untouched, it just records from a
 * fake stream into a fake recorder.
 *
 * Pair with `parameters.media: { permission: "granted" }`
 * (`.storybook/mocks/media.ts`), which supplies the `getUserMedia` stream and
 * the `AudioContext` the hook taps for its VU meter. That stream is a plain
 * object, so a real `MediaRecorder` would throw on construction — hence this.
 *
 * Two knobs, because the hook's whole chunking contract is timing and size:
 * it cuts a chunk every 30s in production and treats anything under 1KB as a
 * dropped-audio symptom. Both are far too slow / too coarse to watch in a
 * story, so a story sets its own cadence and chunk size instead.
 */

export type RecorderParameters = {
	/** ms between simulated chunks (production: a 30s timeslice). */
	chunkEveryMs?: number;
	/** Bytes per simulated chunk. Under 1024 the hook counts the chunk as
	 * suspicious, and two consecutive ones fire `onRecordingInterrupted`. */
	chunkBytes?: number;
};

const DEFAULT_CHUNK_EVERY_MS = 4000;
const DEFAULT_CHUNK_BYTES = 4096;

let currentConfig: RecorderParameters | undefined;
let patched = false;
let originalMediaRecorder: typeof window.MediaRecorder | undefined;

/** Every recorder handed out since the last reset, so teardown can silence the
 * ones still running. `useChunkedAudioRecorder` never stops its recorder on
 * unmount (its cleanup effect closes the stream and the audio contexts, but
 * leaves both chunk intervals and the recorder itself alive), so a story left
 * mid-recording keeps cutting chunks and uploading them from a component that
 * is no longer on screen — which starves the *next* story of the requests its
 * own render is waiting on. */
const liveRecorders = new Set<FakeMediaRecorder>();

class FakeMediaRecorder {
	state: "inactive" | "recording" | "paused" = "inactive";
	mimeType: string;
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onstop: (() => void) | null = null;
	private timer: ReturnType<typeof setTimeout> | undefined;

	constructor(_stream: MediaStream, options?: { mimeType?: string }) {
		this.mimeType = options?.mimeType ?? "audio/webm";
		liveRecorders.add(this);
	}

	static isTypeSupported() {
		return true;
	}

	start() {
		this.state = "recording";
		liveRecorders.add(this);
		// One chunk per cut, then stop — which is what makes the hook's `onstop`
		// hand the blob to `onChunk` and immediately start the next recorder, so
		// a story keeps producing chunks without any driving from outside.
		this.timer = setTimeout(() => {
			const bytes = currentConfig?.chunkBytes ?? DEFAULT_CHUNK_BYTES;
			this.ondataavailable?.({
				data: new Blob([new Uint8Array(bytes)], { type: this.mimeType }),
			});
			this.stop();
		}, currentConfig?.chunkEveryMs ?? DEFAULT_CHUNK_EVERY_MS);
	}

	stop() {
		if (this.state === "inactive") return;
		clearTimeout(this.timer);
		this.state = "inactive";
		// Asynchronously, as a real recorder's event would be. The hook's `onstop`
		// restarts recording unconditionally and relies on the stream ref already
		// being cleared to stop; firing synchronously here would let a stopped
		// recording restart itself and keep uploading chunks forever.
		//
		// Held in `timer`, and so still cancellable, until the event has fired:
		// a story torn down in this window must not deliver one last chunk into
		// the story that replaces it.
		this.timer = setTimeout(() => {
			liveRecorders.delete(this);
			this.onstop?.();
		}, 0);
	}

	pause() {
		if (this.state !== "recording") return;
		clearTimeout(this.timer);
		this.state = "paused";
	}

	resume() {
		if (this.state !== "paused") return;
		this.start();
	}

	/** Storybook-only: drops this recorder without firing anything. Leaving it
	 * `inactive` with no handlers is also what neutralises the hook's own leaked
	 * 30s interval, which would otherwise call `stop()` and restart the loop. */
	silence() {
		clearTimeout(this.timer);
		this.state = "inactive";
		this.ondataavailable = null;
		this.onstop = null;
	}
}

export const installRecorderMock = (config: RecorderParameters) => {
	currentConfig = config;
	if (patched) return;
	patched = true;
	originalMediaRecorder = window.MediaRecorder;
	// @ts-expect-error — Storybook-only stub of a browser global.
	window.MediaRecorder = FakeMediaRecorder;
};

/** Silences every recorder still running and restores the browser's real
 * `MediaRecorder`. Called on every story mount and unmount, not only the
 * mocked ones, so neither a patch nor a recording loop can outlive the story
 * that started it. */
export const resetRecorderMock = () => {
	for (const recorder of liveRecorders) recorder.silence();
	liveRecorders.clear();
	if (!patched) return;
	patched = false;
	if (originalMediaRecorder) window.MediaRecorder = originalMediaRecorder;
	currentConfig = undefined;
};
