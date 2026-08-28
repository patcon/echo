import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import posthog from "posthog-js";
import {
	clearStoredConfiguration,
	newConfigSessionId,
	writeStoredConfiguration,
} from "./configuratorState";
import { PricingConfigurator, STEP_PARAM } from "./PricingConfigurator";
import { QUESTION_SET_VERSION } from "./questions";

/** The modal reads its step from the URL, so every step is a deep link rather
 * than a click path. `pattern` is widened off the preview default because this
 * component wants a search param, not the chat route's five segments. */
const atStep = (step: number | "book" | "done") => ({
	router: {
		path: `/en-US/pricing?${STEP_PARAM}=${step}`,
		pattern: "/:language/*",
	},
});

const meta = {
	args: {
		onClose: fn(),
		onEvent: fn(),
		opened: true,
		// Injectable by design — see the `submit` prop's own comment. Nothing
		// here reaches the network.
		submit: fn(async () => ({ reference: "DEM-4F2A" })),
	},
	// The component restores answers from localStorage on mount, so without this
	// a story inherits whatever the last one typed.
	beforeEach: () => {
		clearStoredConfiguration();
	},
	component: PricingConfigurator,
	parameters: atStep(1),
	title: "Pricing/PricingConfigurator",
} satisfies Meta<typeof PricingConfigurator>;

export default meta;

type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// The opening step
// ---------------------------------------------------------------------------

export const Opening: Story = { name: "1. Opening" };

/** The opening's first line is the only per-wall variation in the whole modal:
 * `wallActionLine` turns the key into "You were trying to {action}.", and an
 * unknown or absent key falls back to "You are on the free plan." Flip the
 * control to read all thirteen. */
export const WallAttemptLine: Story = {
	name: "1. Opening — wall attempt line",
	argTypes: {
		wallKey: {
			control: "select",
			options: [
				"billing_page",
				"chat_cap",
				"chat_turn_cap",
				"chat_voice_cap",
				"custom_logo",
				"private_workspace",
				"report_cap",
				"transcription_cap",
				"transcripts_view",
				"upload_cap",
				"webhooks",
				"workspace_cap",
			],
		},
	},
	args: { wallKey: "upload_cap" },
};

/** The one locked-data wall. The cap block sits above the opening, because
 * nothing was blocked in the room — only the transcription of it. */
export const TranscriptionCap: Story = {
	name: "1. Opening — transcription cap",
	args: { variant: "transcription_cap", wallKey: "transcription_cap" },
};

// ---------------------------------------------------------------------------
// The five questions
// ---------------------------------------------------------------------------

export const UseCase: Story = { name: "2. Use case", parameters: atStep(2) };
export const Timing: Story = { name: "3. Timing", parameters: atStep(3) };
export const Volume: Story = { name: "4. Volume", parameters: atStep(4) };
export const Concurrency: Story = {
	name: "5. Concurrency",
	parameters: atStep(5),
};

/** The last step carries two answers: the `extras` choices and the free-text
 * `context` box beneath them. */
export const Extras: Story = {
	name: "6. Extras + context",
	parameters: atStep(6),
};

/** Answers survive a reload. Seeding the store before mount shows what a person
 * sees when they come back to a half-finished form. */
export const ResumedSession: Story = {
	name: "4. Volume — resumed session",
	beforeEach: () => {
		writeStoredConfiguration({
			answers: {
				timing: "next_month",
				use_case: ["event_workshop", "assembly"],
				volume: "10_50",
			},
			config_session_id: newConfigSessionId(),
			furthest_step: 4,
			question_set_version: QUESTION_SET_VERSION,
		});
	},
	parameters: atStep(4),
};

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Next on the last step sends, then moves to the booking phase. The booking
 * phase is guarded by the reference the send returns, so this transition is the
 * only way to reach it — `?pc_step=book` on its own renders an empty step.
 * For the booking screen's own states see `PricingBookingStep.stories.tsx`. */
export const SubmitsToBooking: Story = {
	name: "6. Extras — sends, then books",
	parameters: atStep(6),
};

/** A failed send keeps every answer on screen and says so, rather than losing
 * the form. Click Next to see it. */
export const SubmitFails: Story = {
	name: "6. Extras — send fails",
	args: {
		submit: fn(async () => {
			throw new Error("storybook: submit rejected on purpose");
		}),
	},
	parameters: atStep(6),
};

// ---------------------------------------------------------------------------
// The price-anchor feature flag
// ---------------------------------------------------------------------------

/** `priceAnchor.ts` reads one PostHog flag to decide whether the opening names
 * a starting price. Storybook never runs `main.tsx`, so PostHog is never
 * initialised and every read falls through its own try/catch to "none" — the
 * variant below would otherwise be unreachable here.
 *
 * Scoped to the one story that needs it: the methods live on the prototype, so
 * assigning shadows them and `Reflect.deleteProperty` hands the real ones back.
 * Nothing in `.storybook/` is touched and no other story sees a fake PostHog.
 *
 * The wording is invented. The real line is the flag's payload, set in PostHog
 * rather than committed here, which is the point of it being a flag. */
const withPriceAnchor: Decorator = (Story) => {
	posthog.getFeatureFlag = () => "anchor";
	posthog.getFeatureFlagPayload = () => ({
		line: "Plans start at €250 a month.",
	});
	posthog.onFeatureFlags = () => () => {};

	return <Story />;
};

export const PriceAnchor: Story = {
	name: "1. Opening — price anchor flag",
	beforeEach: () => () => {
		Reflect.deleteProperty(posthog, "getFeatureFlag");
		Reflect.deleteProperty(posthog, "getFeatureFlagPayload");
		Reflect.deleteProperty(posthog, "onFeatureFlags");
	},
	decorators: [withPriceAnchor],
};

// ---------------------------------------------------------------------------
// Mount points
// ---------------------------------------------------------------------------

/** The website mount. No signed-in user, so no wall named and no workspace. */
export const SiteMount: Story = {
	name: "1. Opening — website mount",
	args: { entry: "popover_link", mount: "site" },
};

/** Two separate inputs: the `:language` route param drives the words through
 * lingui, and the `locale` prop rides on the payload and picks the anchor line.
 * A story that set only one of them would be lying about one of the two. */
export const Dutch: Story = {
	name: "1. Opening — Dutch",
	args: { locale: "nl-NL" },
	parameters: {
		router: {
			path: `/nl-NL/pricing?${STEP_PARAM}=1`,
			pattern: "/:language/*",
		},
	},
};
