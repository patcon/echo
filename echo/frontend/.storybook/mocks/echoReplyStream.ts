import { HttpResponse, http } from "msw";

/**
 * The echo reply endpoint `useChat` posts to
 * (`ParticipantConversationAudioContent`). Despite its `text/event-stream`
 * media type this is *not* SSE: the server writes raw Vercel AI SDK data-stream
 * lines and the AI SDK reads the response body over `fetch`. So it is mocked
 * with `http.post` and a `ReadableStream`, the exact opposite of
 * `healthStream.ts`, whose `EventSource` target `http.*` cannot see at all.
 */
export const echoReplyPath = (conversationId: string) =>
	`/api/conversations/${conversationId}/get-reply`;

/** Data-stream frame prefixes the server emits (`stream_status.py`, `conversation.py`). */
const TEXT_FRAME = "0:";
const DATA_FRAME = "2:";
const ERROR_FRAME = "3:";

/**
 * A `2:` data frame. `useChat` flattens each frame's array into its `data`, so
 * one object here becomes one entry there, which is what `useLoadNotification`
 * scans for. Only `high_load` is ever emitted in production, after the server
 * waits 20s for a first chunk.
 */
export type EchoStatusEvent = {
	type: "high_load" | "processing" | "retrying" | "ready";
	message: string;
};

export type EchoReplyOptions = {
	/** Text deltas, sent in order. Each becomes one `0:` frame. */
	segments: string[];
	/** Milliseconds between segments, so the stream is legible rather than instant. */
	delayMs?: number;
	/** Emitted as a `2:` frame before the first segment. */
	statusEvent?: EchoStatusEvent;
	/** Sent as a `3:` frame instead of the segments, surfacing as `error` on `useChat`. */
	error?: string;
};

const DEFAULT_DELAY_MS = 250;

/**
 * Streams an assistant reply back to `useChat`, one `0:` frame per segment.
 *
 * Only reachable when the page opens on `?echo=1`: that mount effect is the
 * sole caller of `handleReply`, so a story without the param never posts here.
 */
export const echoReplyHandler = (
	conversationId: string,
	{
		delayMs = DEFAULT_DELAY_MS,
		error,
		segments,
		statusEvent,
	}: EchoReplyOptions,
) =>
	http.post(echoReplyPath(conversationId), () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				const send = (frame: string, value: unknown) => {
					controller.enqueue(
						encoder.encode(`${frame}${JSON.stringify(value)}\n`),
					);
				};

				if (statusEvent) send(DATA_FRAME, [statusEvent]);

				if (error) {
					// A pause first, so the status event and the "Thinking..."
					// placeholder are both readable before the failure lands.
					await new Promise((resolve) => setTimeout(resolve, delayMs));
					send(ERROR_FRAME, error);
					controller.close();
					return;
				}

				for (const segment of segments) {
					await new Promise((resolve) => setTimeout(resolve, delayMs));
					send(TEXT_FRAME, segment);
				}
				controller.close();
			},
		});

		return new HttpResponse(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"X-Accel-Buffering": "no",
			},
		});
	});

/**
 * Splits a reply into the chunky, uneven deltas a real model produces, so the
 * streamed text arrives in phrases rather than all at once. The width is a
 * stand-in for the real thing, not a measurement.
 */
export const asSegments = (text: string, wordsPerSegment = 3) => {
	const words = text.split(" ");
	const segments: string[] = [];
	for (let index = 0; index < words.length; index += wordsPerSegment) {
		const chunk = words.slice(index, index + wordsPerSegment).join(" ");
		segments.push(index === 0 ? chunk : ` ${chunk}`);
	}
	return segments;
};
