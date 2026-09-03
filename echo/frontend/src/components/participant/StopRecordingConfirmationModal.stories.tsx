import { Badge, Button, Group, Paper, Stack, Switch, Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { fn, userEvent, within } from "storybook/test";
import { toast } from "@/components/common/Toaster";
import { StopRecordingConfirmationModal } from "./StopRecordingConfirmationModal";

/** The first story from the capture loop, and the moment the participant
 * experience funnels into: a person in a room has stopped talking and has to
 * decide whether they are done.
 *
 * The recording interface proper (`ParticipantConversationAudio.tsx`, 1108
 * lines) reads five queries, a mutation, `useChunkedAudioRecorder` and two wake
 * locks off no injection seam, so it is a "skip the giants, story their leaves"
 * case. This is its most consequential leaf and the only fully prop-driven one:
 * ten props, no queries, no mutations, one piece of local state
 * (`:41`).
 *
 * ## Two tiers in this file
 *
 * `Playground` comes first and is the one story that **runs**: a stateful
 * wrapper owns the parent's state machine, so Resume, the X, the backdrop,
 * Finish and the pause-time upload all genuinely do something. Start there to
 * feel the flow.
 *
 * Every story after it **pins one state** through `args` and leaves it there:
 * the handlers are `fn()` spies, so no click changes what you are looking at.
 * That is deliberate and it is what makes them readable as documentation — a
 * story you can click your way out of does not hold a state still, and this
 * modal's exits all lead to `opened: false`, which renders nothing at all.
 *
 * So the two tiers answer different questions. The pinned stories are what the
 * component *is*; the Playground is what it *does*, and it is the only story
 * that simulates rather than reports.
 *
 * Why the pinned tier is worth having at all rather than just the Playground:
 * three of these states — uploading, stopping, and the verification prompt —
 * are sub-second windows in the real app, and a state you can only reach by
 * catching it mid-transition is not a state you can read.
 *
 * ## The modal is portaled
 *
 * Mantine renders `Modal` into a portal at the document root, so it is not
 * inside Storybook's `canvasElement`. Queries in `play` here go through
 * `within(document.body)`, unlike the card stories on this branch which use
 * `canvasElement` for in-tree components. A `canvasElement` query in this file
 * finds nothing and fails with a timeout that does not say why.
 *
 * No pinned story sets `opened: false`; it renders nothing at all, and per the
 * lesson in `.storybook/NOTES.md` a boolean does not get both its sides
 * storied. The Playground *starts* closed, but it starts closed on a recording
 * screen with a way in, which is a state rather than an absence.
 *
 * ## Viewport
 *
 * Every state here ships on a phone held by someone standing in a room. The
 * modal pins `size="sm"` (`:81`), which is a fixed width rather than a
 * proportion, so these stories are not misrepresenting the real thing at
 * desktop canvas width the way a fluid layout would. `preview.tsx` has no
 * viewport handling and this component does not need it.
 *
 * ## Closing the modal resumes recording
 *
 * Worth knowing before reading any pinned story, because it is invisible in
 * every one of them. There is no neutral way out. `handleModalClose`
 * (backdrop, Escape, the X) calls `handleClose`, which calls `handleResume()`
 * before `close()` (`:43-47`, `:57-61`) — the same handler the Resume button
 * runs (`:139`). At the call site that restarts the recorder from the captured
 * timestamp and re-obtains the wake lock
 * (`ParticipantConversationAudio.tsx:539-549`).
 *
 * So dismissing this modal is not "put it back how it was", it is Resume with
 * no label on it. My reading, not sourced: that is the safe default for a
 * conversation you might still be having, and the recording screen behind the
 * modal does show a recording state — but nothing in the modal says so, and it
 * is the only affordance in the component whose effect is not written on it.
 * The Playground is where you can watch it happen.
 *
 * ## Provenance
 *
 * Any claim carrying a `file:line` ref was read out of that source; a bare
 * `:NN` refers to `StopRecordingConfirmationModal.tsx`. Anything without a ref
 * is my own reading of the code and should be checked before you rely on it.
 * Handlers in the pinned stories are `fn()` spies — nothing there starts, stops
 * or uploads anything, so the states are pinned rather than sequenced.
 * `Playground` is the exception and says so.
 */
const meta = {
	component: StopRecordingConfirmationModal,
	parameters: {
		// Storybook's default `layout: "padded"` pads the canvas root on the
		// left only, so Mantine centering the modal in that padded box (not the
		// real viewport) reads off-center.
		layout: "fullscreen",
	},
	title: "Participant/StopRecordingConfirmationModal",
} satisfies Meta<typeof StopRecordingConfirmationModal>;

export default meta;

type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Playground
// ---------------------------------------------------------------------------

/** How long the simulated finish spends in `isStopping` before closing.
 *
 * **Invented, but bounded by real numbers.** The duration is not a constant in
 * the code: `handleConfirmFinish` waits a fixed 100ms
 * (`ParticipantConversationAudio.tsx:490`), then races any pending chunk uploads
 * against a 30-second timeout (`:494-496`), then awaits `finishConversation`
 * over the network (`:514`). So the sourced facts are a 100ms floor and a 30s
 * ceiling; 3000 is a plausible middle picked to be long enough to watch and
 * short enough to sit through, and it asserts nothing about real timing. */
const SIMULATED_FINISH_MS = 3000;

/** How long the final chunk spends uploading after a pause.
 *
 * **Invented, and unlike the finish there is no bound in the code to anchor
 * it.** Pausing really does start an upload — `handleStopRecording` stops the
 * recorder specifically to "trigger final chunk upload immediately"
 * (`ParticipantConversationAudio.tsx:473`), and `isUploading` is that
 * mutation's own `isPending` (`:812`). What it costs is a network POST of up to
 * one chunk, which is 30 seconds of audio at the recorder's default timeslice
 * (`hooks/useChunkedAudioRecorder.ts:63`), so the payload has a known size and
 * the duration does not. 1500 is short enough not to be in the way and long
 * enough to see Finish switch from dead to live, which is the point. */
const SIMULATED_UPLOAD_MS = 1500;

/** Where the harness ends up once the modal is gone. The real component's exits
 * navigate (`ParticipantConversationAudio.tsx:520`, `:536`, `:554`), so a
 * faithful playground has to show *something* afterwards rather than an empty
 * canvas — otherwise every exit looks identical and looks broken.
 *
 * The colours and words are not invented: they are lifted from `StatePill`'s
 * own map (`conversation/StatePill.tsx:16-51`), which is the vocabulary a *host*
 * reads in the live monitor. So the badge below doubles as "what the other side
 * of the product sees while the participant does this", which is the one thing
 * neither loop's stories show on their own. `StatePill` is storied separately
 * and enumerates all thirteen states.
 *
 * Note `verify` takes `primary`/"Verifying" rather than a recording colour even
 * though the recorder is still running (`:551-555`) — that is the app's own
 * choice, not the harness's, and it is why the surprising resume is easy to
 * miss from the host side too. */
type Surface = "recording" | "paused" | "finished" | "text" | "verify";

const SURFACE_META: Record<
	Surface,
	{ color: string; detail: string; label: string }
> = {
	finished: {
		color: "primary",
		detail: "finish route",
		label: "Finished",
	},
	paused: {
		color: "yellow",
		detail: "modal dismissed, audio not flowing",
		label: "Paused",
	},
	recording: { color: "red", detail: "audio flowing", label: "Recording" },
	text: { color: "primary", detail: "text mode route", label: "Typing" },
	verify: {
		color: "primary",
		detail: "verify route — recorder still running",
		label: "Verifying",
	},
};

/** The parent's state machine, reimplemented small.
 *
 * This is the one place in the file that guesses. Every transition below is
 * traceable to `ParticipantConversationAudio.tsx`, but it is a second
 * implementation of that logic living next to the real one, so it can drift
 * from it silently. Treat it as a way to feel the flow, not as a spec — the
 * pinned stories below are what the component actually does. */
const PlaygroundHarness = () => {
	// Starts where the participant starts: recording, no modal. The modal is not
	// a screen you land on, it is something a pause produces
	// (`ParticipantConversationAudio.tsx:470-479`), so the harness begins one
	// step earlier and you press "Simulate pause" to open it. Costs one click
	// and buys the whole sequence, including the upload window that a pause
	// starts and that opening straight into the modal would skip past.
	const [opened, setOpened] = useState(false);
	const [isStopping, setIsStopping] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [surface, setSurface] = useState<Surface>("recording");
	// Both switches live in the harness panel rather than in `args`, so there is
	// one place to click rather than two. They are not the same kind of thing,
	// though, and the panel says which is which: `showVerifyOnFinish` is a real
	// prop the parent passes (`ParticipantConversationAudio.tsx:816`), while the
	// failure is a fiction standing in for the parent's catch branch
	// (`:521-525`) — the component has no failure mode of its own.
	const [showVerifyOnFinish, setShowVerifyOnFinish] = useState(false);
	const [shouldFinishFail, setShouldFinishFail] = useState(false);
	const uploadTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	// Storybook swaps stories without unmounting the iframe, so a finish or an
	// upload left mid-flight would land its setState on an unmounted tree.
	useEffect(
		() => () => {
			if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
			if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
		},
		[],
	);

	const startUpload = () => {
		setIsUploading(true);
		if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
		uploadTimeoutRef.current = setTimeout(
			() => setIsUploading(false),
			SIMULATED_UPLOAD_MS,
		);
	};

	// `handleStopRecording` captures the elapsed time, stops the recorder — which
	// is what kicks off the final chunk's upload — and opens this modal
	// (`ParticipantConversationAudio.tsx:470-479`). Only reachable while
	// recording, hence the guard on the button below.
	const simulatePause = () => {
		setSurface("paused");
		setOpened(true);
		startUpload();
	};

	// `handleConfirmFinish` (`:481-526`). Two details worth keeping faithful:
	// on success `setIsStopping(false)` is never called — it closes and
	// navigates away with the flag still true (`:519-520`) — while the failure
	// path toasts and resets it (`:521-525`), dropping the participant back on
	// the pause screen. So a failed finish is the only way back out of
	// `isStopping`, and the switch below is the only way to see it.
	const confirmFinish = () => {
		setIsStopping(true);
		finishTimeoutRef.current = setTimeout(() => {
			if (shouldFinishFail) {
				toast.error("Failed to finish conversation. Please try again.");
				setIsStopping(false);
				return;
			}
			setOpened(false);
			setSurface("finished");
		}, SIMULATED_FINISH_MS);
	};

	// The modal calls this from the Resume button *and* from every dismissal —
	// backdrop, Escape, the X (`StopRecordingConfirmationModal.tsx:43-47`,
	// `:57-61`). It is wired to resume here precisely so that behaviour is
	// visible: dismiss the modal and watch the badge go back to Recording.
	//
	// Deliberately does not cancel an upload in flight, because the real one
	// does not either — the chunk keeps going while recording restarts.
	const resume = () => {
		setSurface("recording");
	};

	const reset = () => {
		if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
		if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
		setSurface("recording");
		setIsStopping(false);
		setIsUploading(false);
		setOpened(false);
	};

	return (
		<Stack gap="md" p="md">
			<Paper p="md" radius="md" withBorder>
				<Stack gap="sm">
					<Group gap="xs">
						<Text size="sm" c="dimmed">
							What the host's live monitor would show:
						</Text>
						<Badge color={SURFACE_META[surface].color} variant="light">
							{SURFACE_META[surface].label}
						</Badge>
						<Text size="xs" c="dimmed">
							{SURFACE_META[surface].detail}
						</Text>
						{isUploading && (
							<Badge color="gray" variant="outline">
								uploading
							</Badge>
						)}
					</Group>
					<Group gap="sm">
						<Button
							disabled={surface !== "recording"}
							onClick={simulatePause}
							size="sm"
						>
							Simulate pause
						</Button>
						<Button onClick={reset} size="sm" variant="subtle">
							Reset
						</Button>
					</Group>
					<Switch
						checked={showVerifyOnFinish}
						description="Real prop. Arms the verification detour, so Finish asks before it finishes."
						label="Verify on finish"
						onChange={(event) =>
							setShowVerifyOnFinish(event.currentTarget.checked)
						}
						size="sm"
					/>
					<Switch
						checked={shouldFinishFail}
						description="Harness only. Stands in for the parent's catch branch; the modal has no failure mode of its own."
						label="Simulate failure on finish"
						onChange={(event) =>
							setShouldFinishFail(event.currentTarget.checked)
						}
						size="sm"
					/>
					<Text size="xs" c="dimmed">
						This panel is the harness, not the component. It exists so the
						modal's exits are distinguishable — every one of them closes the
						modal, so without a surface behind it Resume, dismiss, Finish and
						Switch to text would all look like the same blank canvas.
					</Text>
				</Stack>
			</Paper>

			<StopRecordingConfirmationModal
				close={() => setOpened(false)}
				handleConfirmFinish={confirmFinish}
				handleResume={resume}
				handleSkipVerification={() => {
					// Closes, then finishes (`ParticipantConversationAudio.tsx:528-531`).
					setOpened(false);
					confirmFinish();
				}}
				handleSwitchToText={() => {
					// Closes and navigates to text mode (`:533-537`).
					setOpened(false);
					setSurface("text");
				}}
				handleVerify={() => {
					// Closes, resumes recording, navigates to verify (`:551-555`). The
					// resume is the surprising half and the badge shows it.
					setOpened(false);
					setSurface("verify");
				}}
				isStopping={isStopping}
				isUploading={isUploading}
				opened={opened}
				showVerifyOnFinish={showVerifyOnFinish}
			/>
		</Stack>
	);
};

/** The sandbox, and the place to start. Every affordance works: Resume, the X
 * and the backdrop all close the modal *and* resume recording, pausing uploads
 * the final chunk for `SIMULATED_UPLOAD_MS`, Finish spends
 * `SIMULATED_FINISH_MS` in the stopping state and then lands on the finish
 * surface, and the verify detour routes the way the real parent routes it.
 *
 * It opens where the participant starts — recording, no modal — so the first
 * thing to do is press "Simulate pause".
 *
 * Five things to try that the pinned stories can only describe:
 *
 * - **Press "Simulate pause" and read the modal without touching it.** Finish
 *   is dead for the first moment and then comes alive. That is the real first
 *   frame: pausing stops the recorder specifically to start the final chunk's
 *   upload (`ParticipantConversationAudio.tsx:473`), so every pause has a
 *   window where the participant is being asked to decide and one of the three
 *   choices is not available yet.
 * - **Dismiss the modal by clicking the backdrop.** The badge goes back to
 *   Recording. Nothing in the modal said it would; this is the meta note above
 *   made visible. Then press "Simulate pause" to come back in.
 * - **Flip "Verify on finish", press Finish, then dismiss the reminder.** You
 *   asked to finish, got asked a question, backed out, and are recording again.
 * - **Flip "Simulate failure on finish", press Finish.** The only path back out
 *   of `isStopping`, since the success path never resets it
 *   (`ParticipantConversationAudio.tsx:519-524`).
 * - **Flip "Verify on finish", press Finish, then press Skip.** Three seconds
 *   of nothing, then the finish surface. Compare with pressing Finish directly,
 *   which spins in the modal for the same three seconds. Found by building this
 *   harness, and it is real: `handleSkipVerification` calls `close()` *before*
 *   awaiting the finish (`ParticipantConversationAudio.tsx:528-531`), so
 *   `isStopping` goes true on an already-closed modal and its spinner
 *   (`StopRecordingConfirmationModal.tsx:150`) has nothing to render into. The
 *   two ways of finishing the same conversation differ in whether the
 *   participant gets any feedback while it happens.
 *
 * Also worth doing once: press Finish and try to leave while it spins. Backdrop,
 * Escape and the X are all inert for those three seconds
 * (`StopRecordingConfirmationModal.tsx:58`, `:67-68`) — the deliberate trap
 * from `Paused (pending finish)`, except here you can feel how long it lasts.
 * And pause, then press Resume while the upload badge is still showing: the
 * upload carries on, because the real one does not cancel either.
 *
 * Everything is clicked in the canvas; the Storybook controls panel is empty
 * for this story, and every arg is hidden via `argTypes`. That is a revision of
 * how this file started, and worth stating plainly: the first version kept
 * `showVerifyOnFinish` in the controls panel on the reasoning that real props
 * belong in `args` and harness fictions belong in the harness. The distinction
 * is right, the split location was not — it made you flip between two control
 * surfaces to exercise one flow. Both switches now sit together and each
 * carries a `description` saying which kind it is, so the distinction survives
 * without costing a round trip.
 *
 * The rest is `useState` inside the wrapper, including `isUploading`, which the
 * harness drives off the pause rather than taking from a control. Nothing
 * writes back to args, which is why they are hidden rather than left visible: a
 * control reading `opened: true` that does nothing is worse than no control at
 * all. (`useArgs` from `storybook/preview-api` would keep them genuinely in
 * sync, at the cost of an import this file does not otherwise need. Not worth
 * it for a story you click rather than dial.)
 *
 * **This story simulates.** Its state machine is a second, smaller
 * implementation of the parent's, written from reading it, and can drift from
 * the real one. Both durations are invented — see `SIMULATED_FINISH_MS` and
 * `SIMULATED_UPLOAD_MS`, which record what in them is sourced and what is not.
 * Anything you want to rely on, check against the pinned stories and the refs
 * in them. */
export const Playground: Story = {
	args: {
		close: fn(),
		handleConfirmFinish: fn(),
		handleResume: fn(),
		handleSwitchToText: fn(),
		isStopping: false,
		opened: false,
		showVerifyOnFinish: false,
	},
	argTypes: {
		close: { table: { disable: true } },
		handleConfirmFinish: { table: { disable: true } },
		handleResume: { table: { disable: true } },
		handleSkipVerification: { table: { disable: true } },
		handleSwitchToText: { table: { disable: true } },
		handleVerify: { table: { disable: true } },
		isStopping: { table: { disable: true } },
		isUploading: { table: { disable: true } },
		opened: { table: { disable: true } },
		showVerifyOnFinish: { table: { disable: true } },
	},
	render: () => <PlaygroundHarness />,
};

/** The three exits, plus the two the component supplies itself. Spies rather
 * than no-ops so the actions panel shows which one a click took. */
const handlers = {
	close: fn(),
	handleConfirmFinish: fn(),
	handleResume: fn(),
	handleSkipVerification: fn(),
	handleSwitchToText: fn(),
	handleVerify: fn(),
};

// ---------------------------------------------------------------------------
// The pause
// ---------------------------------------------------------------------------

/** The state a participant actually sees when they press stop, and the one all
 * the others are variations on.
 *
 * Three ways out of a recording, ranked by the component's own visual weight.
 * Resume is the filled button and Finish is `variant="outline"` (`:148`), so
 * carrying on is the emphasised choice and ending the conversation is the
 * quieter one. Switching to text is an `Anchor`, quieter again (`:164`), which
 * puts the mode change below both — reasonable, since it is the only exit that
 * navigates away from the recording route
 * (`ParticipantConversationAudio.tsx:533-537`).
 *
 * That hierarchy is the opposite of what the title says. The modal is called
 * "Recording Paused" (`:77`) and offers no explanation, no elapsed time and no
 * question — it names a state and hands over three buttons. My reading, not
 * sourced: the emphasis on Resume is doing the work the missing copy would
 * otherwise do, nudging away from an accidental finish.
 *
 * Finish here is terminal and unconfirmed. It calls `handleConfirmFinish`
 * straight through (`:49-55`), which stops the recorder, waits on pending
 * uploads and navigates to the finish route
 * (`ParticipantConversationAudio.tsx:481-526`). The `showVerifyOnFinish`
 * stories below are the one case where it asks anything first.
 *
 * Strictly this is the state *after* the pause-time upload settles; the
 * Playground opens on the frame before it, where Finish is still dead. */
export const Paused: Story = {
	args: {
		...handlers,
		isStopping: false,
		opened: true,
	},
};

// ---------------------------------------------------------------------------
// Two reasons the same button is dead
// ---------------------------------------------------------------------------

/** A final chunk is still in flight. `isFinishDisabled` is
 * `isStopping || isUploading` (`:40`), so Finish is dead — you cannot end a
 * conversation while its audio is still uploading.
 *
 * Compare with `Paused (pending finish)` below. It disables the same button,
 * and the only thing distinguishing them is that Finish there also spins,
 * because `loading` is wired to `isStopping` alone (`:150`). This one gets its
 * own spinner instead, in a row of copy above the buttons (`:126-135`), so the
 * two states do read differently — but the difference is *where* the spinner
 * is, which is a lot to ask of a glance. The names say which is which; the
 * screens barely do.
 *
 * The asymmetry worth noticing is what stays live. Resume is disabled by
 * `isStopping` only (`:140`), as is the switch-to-text link (`:170`), and
 * `closeOnClickOutside` / `closeOnEscape` are also keyed to `isStopping` alone
 * (`:67-68`). So mid-upload a participant can resume, switch to text, or
 * dismiss the modal — every exit except the one they pressed stop to reach.
 *
 * My reading, not sourced: that is defensible rather than accidental. An
 * upload in flight does not block going back to recording, and blocking every
 * control during a network round trip on a phone in a room is worse than
 * blocking the one that depends on it. But it does mean "Uploading audio..."
 * appears next to a live Resume button, and resuming does not cancel anything
 * — the chunk keeps uploading.
 *
 * This is the opening frame of every pause, not an edge case: stopping the
 * recorder is what starts the upload
 * (`ParticipantConversationAudio.tsx:473`). The Playground shows it resolving. */
export const PausedPendingUpload: Story = {
	args: {
		...handlers,
		isStopping: false,
		isUploading: true,
		opened: true,
	},
	name: "Paused (pending upload)",
};

/** `handleConfirmFinish` has been called and is awaiting pending uploads
 * (`ParticipantConversationAudio.tsx:481-526`). This is the only state where
 * the modal is a trap on purpose: Resume disabled (`:140`), Finish spinning and
 * disabled (`:150-151`), the text link disabled (`:170`), and backdrop and
 * Escape both switched off (`:67-68`). `handleModalClose` returns early as well
 * (`:58`), which belts what those two props already brace — the X is rendered
 * by Mantine regardless, so the early return is what actually stops it.
 *
 * Correct: the recorder is mid-teardown and there is no coherent thing for
 * Resume to mean. It is also why the "dismissing resumes" behaviour in the meta
 * above is safe — the one moment resuming would be wrong is the one moment you
 * cannot dismiss.
 *
 * One thing to check against a real device rather than this story: the finish
 * path waits on uploads with a timeout, so on a bad connection this state can
 * last seconds, and it is the whole UI. There is no progress, no count of
 * outstanding chunks and no cancel. A participant who taps Finish on hotel
 * Wi-Fi gets a spinner in a box they cannot leave.
 *
 * My reading, not sourced: the switch-to-text link being `disabled` on an
 * `Anchor component="button"` is the weakest link in the lockdown. Mantine
 * spreads unknown props onto the underlying element, so this should reach the
 * DOM as `<button disabled>` and genuinely not fire — but `Anchor` has no
 * disabled *styling*, so it stays a blue link that looks clickable. Unverified:
 * `node_modules` is empty on this checkout, so I could not read Mantine's
 * source. Worth confirming by clicking it in this story; if `handleSwitchToText`
 * shows up in the actions panel, the lockdown has a hole. */
export const PausedPendingFinish: Story = {
	args: {
		...handlers,
		isStopping: true,
		opened: true,
	},
	name: "Paused (pending finish)",
};

// ---------------------------------------------------------------------------
// The verification detour
// ---------------------------------------------------------------------------

/** `showVerifyOnFinish` is true, and this renders almost exactly like `Paused`.
 * The identity is the finding, so it gets a story rather than a sentence.
 *
 * The single pixel-level difference is an 18px check rosette in the Finish
 * button's `rightSection` (`:154-158`). Behind it, Finish no longer finishes:
 * `handleFinishClick` sets local state and returns without calling
 * `handleConfirmFinish` at all (`:49-53`). Same word, same position, same
 * emphasis, different destination — and the only advance notice is an icon
 * with no label.
 *
 * Whether that matters depends on your read of the detour. It is a reminder
 * with a Skip, not a gate, so the cost of not noticing is one extra tap. My
 * reading, not sourced: the icon is decoration that happens to be load-bearing
 * rather than a chosen signal, since nothing else in the modal changes to
 * announce a two-step flow.
 *
 * The host controls whether this branch exists at all. It needs verification
 * enabled, verify-on-finish enabled, no already-approved outcomes, and at least
 * 60 seconds recorded (`ParticipantConversationAudio.tsx:463-467`,
 * `REFINE_BUTTON_THRESHOLD_SECONDS` at `:62`) — so a participant who stops
 * early never sees the second screen, which is the reason this story and
 * `Paused` both describe real deployments rather than one being a variant of
 * the other.
 *
 * Not gated on anything agentic, though the agentic chat reaches into it from
 * three directions. `is_verify_enabled` and `is_verify_on_finish_enabled` are
 * plain Directus project booleans a host sets in portal settings
 * (`project/ProjectPortalEditor.tsx:1007`, `:1232`). But both are in
 * `ProjectUpdateSuggestionCard`'s field map
 * (`chat/ProjectUpdateSuggestionCard.tsx:65-66`), as is
 * `selected_verification_key_list` (`:69`), and that card is constructed only
 * by `AgenticChatPanel.tsx:1895` — so the assistant can propose switching this
 * detour on for participants it will never meet. What verification *does* is
 * LLM work in its own right: the backend generates an artefact from the
 * conversation, the participant reads it aloud, discusses, hits revise to
 * regenerate against that discussion, and approves
 * (`verify/hooks/index.ts:29-60`, `verify/VerifyInstructions.tsx:14-58`).
 *
 * Worth not confusing with "Agentation", which despite the name is unrelated —
 * a dev-only overlay resolving DOM elements back to source paths
 * (`config.ts:194-197`).
 *
 * Click Finish to reach the next story's state. */
export const PausedWithVerify: Story = {
	args: {
		...handlers,
		isStopping: false,
		opened: true,
		showVerifyOnFinish: true,
	},
	name: "Paused (with verify)",
};

/** The second screen, and the only state in this file with no seam of its own.
 * `showVerifyPrompt` is local `useState` (`:41`) with no prop and nothing
 * persisted, so args cannot reach it — the same `play` tier
 * `GoalSuggestionCard`'s `Dismissed` story needed for the same reason. This
 * story clicks Finish on load.
 *
 * The whole modal is replaced (`:87-123`), not extended: title becomes
 * "Verification reminder" (`:73-75`), the copy asks the question, and both
 * Resume and the switch-to-text link are gone. Two buttons, Skip outlined and
 * Verify filled with the rosette (`:96-121`).
 *
 * Where the transition costs something is the exits it removes. Resume and
 * switch-to-text disappear from a screen the participant arrived at by pressing
 * *Finish*, so the two choices they had a tap ago are unavailable, and there is
 * no back. What is left is the unlabelled one: dismissing here runs
 * `handleModalClose` -> `handleClose` -> `handleResume()` (`:43-47`, `:57-61`),
 * so escaping a verification reminder silently restarts the recording. The
 * participant asked to finish, was asked a question, backed out of the
 * question, and is recording again.
 *
 * Both buttons clear `showVerifyPrompt` before delegating (`:99`, `:110`), so
 * the modal is left on the pause screen for next time rather than reopening
 * mid-detour. Worth pairing with what the call site does: Skip closes and
 * finishes (`ParticipantConversationAudio.tsx:528-531`), while Verify closes,
 * *resumes recording*, and navigates to the verify route (`:551-555`). So
 * Verify is not "finish, then verify" — it is "keep recording while you
 * verify", which the copy ("verify before finishing") does not say.
 *
 * `play` runs on core Storybook 10 with `addons: []`, so there is no
 * step-through panel; the click just happens on load. Reload the story to
 * replay it. */
export const VerifyPrompt: Story = {
	args: {
		...handlers,
		isStopping: false,
		opened: true,
		showVerifyOnFinish: true,
	},
	name: "Verify prompt",
	play: async () => {
		// document.body, not canvasElement: Mantine portals the modal out of the
		// story root. See the note in the meta above.
		const modal = within(document.body);
		await userEvent.click(
			await modal.findByTestId("portal-audio-stop-finish-button"),
		);
	},
};
