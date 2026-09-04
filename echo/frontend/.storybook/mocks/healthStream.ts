import type { ServerSentEventMessage } from "msw";
import { sse } from "msw";

/**
 * `useConversationsHealthStream` (`src/components/participant/hooks/useConversationsHealthStream.ts`)
 * opens a raw `EventSource` with no React Query seam, so it can't be driven
 * via `parameters.query.seed` the way most participant data can. MSW's
 * `sse()` handler intercepts `EventSource` directly — a plain `http.get`
 * returning a streamed body does *not* catch it, since `EventSource` doesn't
 * go through `fetch`/XHR.
 *
 * The hook also marks the connection unhealthy on its own if 60s pass with
 * no ping (a real dead-connection check), so a handler that only sends its
 * events once on connect goes stale and surfaces the "something went wrong"
 * banner on any story left open a while. `healthStreamHandler` below repeats
 * them on an interval instead.
 *
 * `sse()`'s resolver has no way to detect the `EventSource` closing (no
 * abort signal, no close callback), and catching a failed `client.send()`
 * doesn't work either — MSW swallows that failure internally rather than
 * throwing to the caller, confirmed by watching a leaked interval spam the
 * console for the better part of an hour uninterrupted. Since only one story
 * is ever mounted at a time, tracking the active interval at module scope
 * and clearing it at the top of every resolver that connects to this path —
 * `unhealthyHealthStreamHandler` included — kills the previous story's
 * leaked interval exactly when the next one opens its own connection, no
 * exception handling needed.
 */
export const HEALTH_STREAM_PATH = "/api/conversations/health/stream";

export type HealthStreamEventMap = {
	ping: Record<string, unknown>;
	health_update: { conversation_issue: string };
};

let activeHealthStreamInterval: ReturnType<typeof setInterval> | undefined;

const clearPreviousHealthStreamInterval = () => {
	if (activeHealthStreamInterval) clearInterval(activeHealthStreamInterval);
};

/** Sends the given events on connect, then repeats them every 20s until the
 * next story's connection clears this one. Pass `[{ event: "ping" }]` for
 * the common "just stay healthy" case. */
export const healthStreamHandler = (
	events: {
		[K in keyof HealthStreamEventMap]: {
			event: K;
			data?: HealthStreamEventMap[K];
		};
	}[keyof HealthStreamEventMap][],
) =>
	sse<HealthStreamEventMap>(HEALTH_STREAM_PATH, ({ client }) => {
		clearPreviousHealthStreamInterval();

		const sendAll = () => {
			for (const { event, data } of events) {
				client.send({
					data: data ?? {},
					event,
				} as ServerSentEventMessage<HealthStreamEventMap>);
			}
		};

		sendAll();
		activeHealthStreamInterval = setInterval(sendAll, 20_000);
	});

/** `client.error()` makes the `EventSource` fire its native `error` event,
 * which is what actually flips `sseConnectionHealthy` to `false`. */
export const unhealthyHealthStreamHandler = () =>
	sse(HEALTH_STREAM_PATH, ({ client }) => {
		clearPreviousHealthStreamInterval();
		client.error();
	});
