import { Text } from "@mantine/core";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { delay, HttpResponse, http } from "msw";
import { useEffect, useMemo } from "react";
import { userEvent, within } from "storybook/test";
import type {
	VerificationArtifactDetail,
	VerificationTopicsResponse,
} from "@/lib/api";
import { withParticipantLayout } from "../../../../.storybook/decorators";
import {
	CUSTOM_TOPIC,
	SEEDED_TOPICS,
} from "../../../../.storybook/fixtures/verificationTopics";
import { VerifyArtefact } from "./VerifyArtefact";

const PROJECT_ID = "project-story";
const CONVERSATION_ID = "conversation-story";
const ARTEFACT_ID = "artefact-1";
const BASE_PATH = `/en-US/${PROJECT_ID}/conversation/${CONVERSATION_ID}`;

/** Reproduces the audio route's `<Outlet />` wrapper, which is what constrains
 * this screen's height so the action bar floats over the outcome rather than
 * sitting below it. */
const withConversationOutlet: Decorator = (Story) => (
	<div className="container mx-auto flex h-full max-w-2xl flex-col justify-end">
		<div className="relative flex-grow p-4">
			<Story />
		</div>
	</div>
);

/** A silent 8 bit mono WAV as a `data:` URI, built rather than pasted so the
 * fixture stays a few lines instead of a base64 wall.
 *
 * Five seconds because `isPlaying` is only cleared by the audio's `ended`
 * event: a shorter clip would flip the button back to the speaker icon before
 * the story settled. */
const silentWav = (seconds: number) => {
	const rate = 8000;
	const samples = rate * seconds;
	const bytes = new Uint8Array(44 + samples);
	const view = new DataView(bytes.buffer);
	const ascii = (offset: number, text: string) => {
		for (let i = 0; i < text.length; i++) {
			bytes[offset + i] = text.charCodeAt(i);
		}
	};

	ascii(0, "RIFF");
	view.setUint32(4, 36 + samples, true);
	ascii(8, "WAVEfmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, rate, true);
	view.setUint32(28, rate, true);
	view.setUint16(32, 1, true);
	view.setUint16(34, 8, true);
	ascii(36, "data");
	view.setUint32(40, samples, true);
	// 0x80 is silence for unsigned 8 bit samples, not 0x00.
	bytes.fill(128, 44);

	const chunks: string[] = [];
	for (let i = 0; i < bytes.length; i += 4096) {
		chunks.push(String.fromCharCode(...bytes.subarray(i, i + 4096)));
	}
	return `data:audio/wav;base64,${btoa(chunks.join(""))}`;
};

const SILENT_AUDIO = silentWav(5);

/** Stands in for the server's stream URL. Never fetched: `withSpeechAudio`
 * ignores it and speaks instead. Non-empty only because that is what makes the
 * button render. */
const SPOKEN_STREAM_URL = "story://read-aloud";

/** Markdown read aloud verbatim would include its own syntax, so the fake TTS
 * speaks a stripped version. Crude on purpose: it only has to sound like the
 * outcome, not round-trip. */
const plainText = (markdown: string) =>
	markdown
		.replace(/[#*_`]/g, "")
		.replace(/^\s*-\s*/gm, "")
		// Every run of newlines becomes a sentence break, which is what the
		// synthesizer paces on. Collapsing them to spaces instead would run the
		// heading into the first line and every bullet into the next.
		.replace(/\s*\n+\s*/g, ". ")
		// ...but not where the line already ended in punctuation, or the break
		// lands as a doubled full stop.
		.replace(/([.!?:])\s*\.\s/g, "$1 ")
		.replace(/[ \t]+/g, " ")
		.trim();

/** Backs `new Audio()` with the Web Speech API so read-aloud reads the outcome
 * instead of playing a file. The component only ever touches `src`, `play()`,
 * `pause()` and the `ended` event, so that is the whole surface to cover.
 *
 * Installed and torn down per story, following `.storybook/mocks/media.ts`: a
 * patch left in place would hijack every later story in the same tab.
 *
 * Story-local because read-aloud is unique to this component. If a second
 * consumer appears, this belongs in `.storybook/mocks/` behind a parameter the
 * way the media mock is.
 *
 * Two browser caveats, neither worth working around here: `speak()` needs user
 * activation in Chrome, so a play function's synthetic click is silent, and
 * `getVoices()` populates behind `voiceschanged`, so the first click after a
 * cold load can be too. */
const withSpeechAudio = (text: string): Decorator =>
	function WithSpeechAudio(Story) {
		useEffect(() => {
			const OriginalAudio = window.Audio;

			class SpeechAudio extends EventTarget {
				src: string;

				constructor(src = "") {
					super();
					this.src = src;
				}

				play() {
					const utterance = new SpeechSynthesisUtterance(text);
					utterance.onend = () => this.dispatchEvent(new Event("ended"));
					window.speechSynthesis.speak(utterance);
					// The component never awaits this, but returning a promise keeps
					// the fake honest about `HTMLMediaElement.play`'s signature.
					return Promise.resolve();
				}

				pause() {
					window.speechSynthesis.cancel();
				}
			}

			window.Audio = SpeechAudio as unknown as typeof window.Audio;
			return () => {
				window.speechSynthesis.cancel();
				window.Audio = OriginalAudio;
			};
		}, [text]);

		return <Story />;
	};

const CONTENT = [
	"### What this screen shows",
	"",
	"The generated outcome for the *Hidden gems* topic, rendered read only.",
	"",
	"- **Revise** regenerates this text from whatever was said since it was written",
	"- The **pencil** opens the same text in an editor, and those edits stay local",
	"- **Approve** saves the content and returns to the conversation",
].join("\n");

const REVISED_CONTENT = [
	"### This outcome has been revised",
	"",
	"A revise landed, so this replaced the original text. Any unapproved local",
	"edit was dropped in the process.",
].join("\n");

const LONG_CONTENT = [
	CONTENT,
	...Array.from({ length: 6 }, (_, index) =>
		[
			"",
			`### Filler section ${index + 1}`,
			"",
			"Padding so the outcome overflows its scroll area. The action bar below is",
			"`sticky bottom-[10%]`, so it should stay put while this text scrolls past.",
		].join("\n"),
	),
].join("\n");

const artefact = (
	overrides: Partial<VerificationArtifactDetail> = {},
): VerificationArtifactDetail => ({
	approved_at: null,
	content: CONTENT,
	date_created: "2026-09-04T14:28:00.000Z",
	id: ARTEFACT_ID,
	key: "gems",
	read_aloud_stream_url: "",
	topic_label: null,
	...overrides,
});

const ALL_TOPICS: VerificationTopicsResponse = {
	available_topics: [...SEEDED_TOPICS, CUSTOM_TOPIC],
	selected_topics: [
		...SEEDED_TOPICS.map((topic) => topic.key),
		CUSTOM_TOPIC.key,
	],
};

/** The same topics with the artefact's own key dropped from the selection, the
 * shape a host leaves behind by deselecting a topic after an outcome was
 * generated for it. */
const DESELECTED_TOPICS: VerificationTopicsResponse = {
	...ALL_TOPICS,
	selected_topics: ALL_TOPICS.selected_topics.filter((key) => key !== "gems"),
};

const project = {
	id: PROJECT_ID,
	is_get_reply_enabled: true,
	is_verify_enabled: true,
	language: "en",
} as unknown as ParticipantProject;

/** Which request fails. The two revise failures differ in more than status:
 * only `revise-no-feedback` arms the cooldown, and it toasts info rather than
 * error. */
type Failing =
	| "none"
	| "project"
	| "topics"
	| "artefact"
	| "revise"
	| "revise-no-feedback"
	| "approve";

/** Which self-redirect guard to trip. Both bounce to the placeholder
 * conversation route. */
type Guard = "none" | "artefact-null" | "topic-deselected";

/** Read at request time by the Playground's handlers, so switching a control
 * changes the response without rebuilding the handler (which `parameters.msw`
 * fixes for the life of the story). */
let activeFailing: Failing = "none";
let activeGuard: Guard = "none";
let activeReadAloud = false;

/** Seeds all three reads and answers all three requests, so a refetch cannot
 * leave them disagreeing, and answers the update too.
 *
 * `loadMs` delays the reads and drops the seed along with it: seeded data
 * renders before any response lands, so a story cannot both seed and show the
 * loading gate. `updateMs` of `Infinity` leaves the update hanging, which is
 * the only way to hold the revising and approving states still. */
const withData = (
	artefactData:
		| VerificationArtifactDetail
		| (() => VerificationArtifactDetail | null),
	topicsData:
		| VerificationTopicsResponse
		| (() => VerificationTopicsResponse) = ALL_TOPICS,
	{
		failing = (): Failing => "none",
		loadMs = 0,
		updateMs = 0,
	}: { failing?: () => Failing; loadMs?: number; updateMs?: number } = {},
) => {
	const resolveArtefact = () =>
		typeof artefactData === "function" ? artefactData() : artefactData;
	const resolveTopics = () =>
		typeof topicsData === "function" ? topicsData() : topicsData;
	const isStatic =
		typeof artefactData !== "function" &&
		typeof topicsData !== "function" &&
		!loadMs;

	return {
		msw: {
			handlers: [
				http.get(`/api/participant/projects/${PROJECT_ID}`, async () => {
					if (loadMs) await delay(loadMs);
					if (failing() === "project") {
						return new HttpResponse(null, { status: 500 });
					}
					return HttpResponse.json(project);
				}),
				http.get(`/api/verify/topics/${PROJECT_ID}`, async () => {
					if (loadMs) await delay(loadMs);
					if (failing() === "topics") {
						return new HttpResponse(null, { status: 500 });
					}
					return HttpResponse.json(resolveTopics());
				}),
				http.get(`/api/verify/artifact/${ARTEFACT_ID}`, async () => {
					if (loadMs) await delay(loadMs);
					if (failing() === "artefact") {
						return new HttpResponse(null, { status: 500 });
					}
					// A null body is still a 200, so it reaches the redirect guard
					// rather than the error screen.
					return HttpResponse.json(resolveArtefact());
				}),
				http.put(`/api/verify/artifact/${ARTEFACT_ID}`, async ({ request }) => {
					// Approve and revise are the same endpoint; the body is what tells
					// them apart.
					const body = (await request.json()) as {
						approvedAt?: string;
						content?: string;
					};
					const isApprove = Boolean(body.approvedAt);

					if (updateMs === Number.POSITIVE_INFINITY) {
						return new Promise<never>(() => {});
					}
					if (updateMs) await delay(updateMs);

					const mode = failing();
					if (isApprove && mode === "approve") {
						return new HttpResponse(null, { status: 500 });
					}
					if (!isApprove && mode === "revise") {
						return new HttpResponse(null, { status: 500 });
					}
					// The server's own shape. Anything else falls through to the
					// generic "Failed to revise" toast and arms no cooldown.
					if (!isApprove && mode === "revise-no-feedback") {
						return HttpResponse.json(
							{
								detail: {
									code: "NO_NEW_FEEDBACK",
									message: "No new feedback found since provided timestamp",
								},
							},
							{ status: 400 },
						);
					}

					const current = resolveArtefact() ?? artefact();
					return HttpResponse.json({
						...current,
						approved_at: body.approvedAt ?? current.approved_at ?? null,
						content: isApprove
							? (body.content ?? current.content)
							: REVISED_CONTENT,
						conversation_id: CONVERSATION_ID,
					});
				}),
			],
		},
		query: {
			seed: isStatic
				? [
						[["participantProject", PROJECT_ID], project],
						[["verify", "topics", PROJECT_ID], topicsData],
						[["verify", "artifact_by_id", ARTEFACT_ID], artefactData],
					]
				: [],
		},
	};
};

/** The screen only mounts with an `artifact_id` in the URL, and it navigates
 * back to the conversation on approve and on every guard, so that destination
 * has to exist. `useI18nNavigate` prefixes the locale, hence the `/en-US` in
 * `BASE_PATH`. */
const ROUTER = {
	path: `${BASE_PATH}/verify/approve?artifact_id=${ARTEFACT_ID}`,
	pattern: "/:language?/:projectId/conversation/:conversationId/verify/approve",
	routes: [
		{
			element: <Text p="lg">Conversation screen (storied separately).</Text>,
			path: BASE_PATH,
		},
	],
};

/** Args are the story's own; `VerifyArtefact` itself takes none. */
type StoryArgs = { failing?: Failing; guard?: Guard; readAloud?: boolean };

/** The controls choose what the mocked endpoints answer with, so an arg only
 * takes effect once the cached reads are dropped and the component is
 * remounted. */
const withPlaygroundArgs: Decorator = (Story, context) => {
	const {
		failing = "none",
		guard = "none",
		readAloud = false,
	} = context.args as StoryArgs;
	const queryClient = useQueryClient();
	const argKey = `${failing}:${guard}:${readAloud}`;

	// During render rather than in an effect: the story's queries fire from child
	// effects, which React runs before this decorator's own effects.
	useMemo(() => {
		activeFailing = failing;
		activeGuard = guard;
		activeReadAloud = readAloud;
		queryClient.removeQueries({ queryKey: ["verify"] });
		queryClient.removeQueries({ queryKey: ["participantProject", PROJECT_ID] });
	}, [failing, guard, readAloud, queryClient]);

	return <Story key={argKey} />;
};

/** The last screen of the verify flow: read the generated outcome, then revise,
 * edit or approve it.
 *
 * It joins three reads (project, topics, the artefact named by `?artifact_id=`)
 * and one write. That write is a single `PUT` doing double duty: a body with
 * `approvedAt` approves, a body with `useConversation` asks for a revision.
 *
 * Most of what is worth seeing here is an interaction mode rather than a data
 * shape, so the stories below reach their state by clicking rather than by
 * seeding. Worth knowing while reading them:
 *
 * - Edits are local until approve. Save only sets `localArtefactContent` and
 *   toasts "Outcome updated!", which reads as persistence but is not. A
 *   successful revise then clears it, silently discarding the edit.
 * - Only `NO_NEW_FEEDBACK` arms the 30 second cooldown. Any other revise
 *   failure lets the participant retry at once, so the gentler outcome is the
 *   one that gets throttled.
 * - `handleReadAloud` never awaits or catches `audio.play()`, and sets
 *   `isPlaying` regardless, so a browser that blocks autoplay shows the pause
 *   icon with nothing playing.
 * - `isLoading` folds in `artefactQuery.isFetching`, but the loading gate is
 *   `isLoading && !artefactQuery.data`, so a refetch with data in hand disables
 *   every button without a spinner to explain why.
 *
 * Not storied: loading and error, which delegate wholesale to
 * `VerifyArtefactLoading` and `VerifyArtefactError` and are already storied
 * there. The composed reach is on the Playground instead, along with two of the
 * three redirect guards. The third, a missing `artifact_id`, cannot be a
 * control because it lives in `parameters.router.path`, which is fixed for the
 * life of a story.
 *
 * Toasts come from Storybook's global `Toaster`; the real screen mounts its own
 * at `position="top-center"` in `Verify.tsx`, so placement differs here. */
const meta = {
	component: VerifyArtefact,
	decorators: [withConversationOutlet, withParticipantLayout],
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(artefact()),
	},
	title: "Participant/VerifyArtefact",
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The whole screen wired end to end from a cold cache, with the update slow
 * enough to watch.
 *
 * The failing-request control covers all three reads and both writes. `project`
 * and `topics` and `artefact` all land on the same error screen, which is the
 * point: the branch is an OR across the three, so a participant cannot tell
 * which one broke.
 *
 * The guard control trips the redirects instead. `artefact-null` is a 200 with
 * a null body, which toasts and bounces; `topic-deselected` bounces with no
 * message at all.
 *
 * Each switch replays the load. */
export const Playground: Story = {
	args: { failing: "none", guard: "none", readAloud: false },
	argTypes: {
		failing: {
			control: { type: "radio" },
			name: "Failing request",
			options: [
				"none",
				"project",
				"topics",
				"artefact",
				"revise",
				"revise-no-feedback",
				"approve",
			] satisfies Failing[],
		},
		guard: {
			control: { type: "radio" },
			name: "Redirect guard",
			options: ["none", "artefact-null", "topic-deselected"] satisfies Guard[],
		},
		readAloud: { control: { type: "boolean" }, name: "Read aloud offered" },
	},
	decorators: [withPlaygroundArgs],
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(
			() =>
				activeGuard === "artefact-null"
					? null
					: artefact({
							read_aloud_stream_url: activeReadAloud ? SILENT_AUDIO : "",
						}),
			() =>
				activeGuard === "topic-deselected" ? DESELECTED_TOPICS : ALL_TOPICS,
			{ failing: () => activeFailing, loadMs: 800, updateMs: 2000 },
		),
	},
};

/** The outcome as the participant first meets it: markdown, a Revise button
 * paired with the edit pencil, and Approve. */
export const Ready: Story = {};

/** An outcome long enough to overflow. The action bar is `sticky bottom-[10%]`
 * inside a `Group` that sits below the scroll area, so it holds its place while
 * the text moves behind it. */
export const LongOutcome: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(artefact({ content: LONG_CONTENT })),
	},
};

/** The speaker button, which renders only when the artefact carries a
 * `read_aloud_stream_url`. Every other fixture in this directory leaves that
 * empty, so this and its TTS twin below are the only places the affordance
 * appears at all.
 *
 * The stream is five seconds of silence, so clicking gets the pause icon and
 * an arbitrary wait rather than anything to hear. */
export const ReadAloudSilent: Story = {
	name: "Read Aloud (Silent Placeholder)",
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(artefact({ read_aloud_stream_url: SILENT_AUDIO })),
	},
};

/** The same button with `Audio` backed by the Web Speech API, so clicking
 * actually reads the outcome and the pause icon lasts exactly as long as the
 * text takes, rather than for a fixed five seconds.
 *
 * Still a placeholder: the real stream is server side, and Chrome gates
 * `speechSynthesis.speak()` on user activation, so this only speaks for a real
 * click in the canvas. */
export const ReadAloudTts: Story = {
	decorators: [withSpeechAudio(plainText(CONTENT))],
	name: "Read Aloud (TTS Placeholder)",
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(artefact({ read_aloud_stream_url: SPOKEN_STREAM_URL })),
	},
};

/** The pencil swaps the rendered markdown for an MDXEditor and the three
 * buttons for Cancel and Save. The editor is seeded once on mount and is
 * uncontrolled thereafter, which is why the component memoizes it. */
export const Editing: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByTestId("portal-verify-artefact-edit-button"),
		);
		await canvas.findByTestId("portal-verify-artefact-editor");
	},
};

/** A revision in flight. The spinner replaces the outcome inside the same
 * Paper rather than covering the screen, so the action bar stays visible with
 * everything on it disabled. */
export const Revising: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(artefact(), ALL_TOPICS, {
			updateMs: Number.POSITIVE_INFINITY,
		}),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByTestId("portal-verify-artefact-revise-button"),
		);
		await canvas.findByTestId("portal-verify-artefact-revising");
	},
};

/** Revise came back with `NO_NEW_FEEDBACK`, so the outcome is unchanged and the
 * button counts down from 30 in place of its label. The countdown is a live
 * one second interval, not a frozen render. */
export const ReviseCooldown: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(artefact(), ALL_TOPICS, {
			failing: () => "revise-no-feedback",
		}),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByTestId("portal-verify-artefact-revise-button"),
		);
		// Matched by shape rather than text because the label is a bare countdown.
		await canvas.findByText(/^\d+s$/);
	},
};

/** Approve in flight. Only this button takes a loader; the rest go disabled.
 * On success the screen navigates to the conversation and toasts from there,
 * so the state is only reachable while the request is outstanding. */
export const Approving: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withData(artefact(), ALL_TOPICS, {
			updateMs: Number.POSITIVE_INFINITY,
		}),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByTestId("portal-verify-artefact-approve-button"),
		);
	},
};
