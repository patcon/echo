import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { BookingLinks } from "@/lib/links";
import { buildBookingPrefill } from "./bookingPrefill";
import { PricingBookingStep } from "./PricingBookingStep";
import { getQuestionSet } from "./questions";

const reference = "DEM-4F2A";

/** Stand in for the CSP, so the fallback can be seen here at all.
 *
 * In the app cal.com is in none of `frame-src`, `script-src` or `connect-src`,
 * so every person gets the plain link. That CSP is a response header set in
 * `vercel.json`, and Storybook serves none of it, so left alone the embed here
 * really loads and the fallback is unreachable.
 *
 * The step reuses an existing `script[src=...]` rather than appending its own
 * (`PricingBookingStep.tsx`), so planting a dead one is the whole trick. The
 * type is what kills it: a script whose type is not a JavaScript type is never
 * fetched, so no `load` event ever fires, exactly as under the CSP. Nothing is
 * requested, so this behaves the same offline.
 *
 * `Cal` goes with it. A story that ran before this one may have left the real
 * embed API on the window, and the step would happily use it and open an
 * iframe with no script tag of ours involved.
 */
const blockEmbed = () => {
	const scope = globalThis as { Cal?: unknown };
	const selector = `script[src="${BookingLinks.EMBED_SCRIPT}"]`;
	for (const stale of document.querySelectorAll(selector)) stale.remove();
	Reflect.deleteProperty(scope, "Cal");

	const dead = document.createElement("script");
	dead.type = "text/plain";
	dead.src = BookingLinks.EMBED_SCRIPT;
	document.head.appendChild(dead);

	// Both halves matter on the way out: a later story that wants the real embed
	// needs the dead tag gone, and needs no queueing stub left behind.
	return () => {
		dead.remove();
		Reflect.deleteProperty(scope, "Cal");
	};
};

/** The same map the real flow hands over: a plain-text summary of the answers
 * plus the reference, in cal.com's own prefill keys.
 *
 * Every value is a real option key from `questions.ts`. `buildBookingPrefill`
 * looks each one up and drops the line when it finds nothing, so an invented
 * key does not fail, it just quietly leaves that question out of the summary a
 * reviewer is meant to be reading. */
const prefill = buildBookingPrefill({
	answers: {
		concurrency: "2_to_5",
		context: "Two rooms running at once, both in Dutch.",
		extras: ["event_help"],
		timing: "One day in October",
		timing_example: "one_day_october",
		use_case: ["event_workshop", "assembly"],
		volume: "50_to_250",
	},
	questions: getQuestionSet(),
	reference,
});

/** The prefill a signed-in mount hands over: the same answers, plus a name and
 * an address cal.com then does not have to ask for. */
const prefillWithAttendee = buildBookingPrefill({
	answers: {
		concurrency: "2_to_5",
		timing: "One day in October",
		timing_example: "one_day_october",
		use_case: ["event_workshop"],
		volume: "50_to_250",
	},
	attendee: { email: "rosa@example.org", name: "Rosa Meijer" },
	questions: getQuestionSet(),
	reference,
});

/** The booking screen, reached in the app only after a send returns a
 * reference. That reference is component state on `PricingConfigurator`, so
 * `?pc_step=book` cannot get you here — hence this separate file. The
 * configurator's own `6. Extras — sends, then books` story covers the
 * transition into it.
 *
 * Two routes, and which one a person gets is decided by the CSP rather than by
 * anything here:
 *
 * - In the app, always the plain link. The CSP lists cal.com in none of
 *   `frame-src`, `script-src` or `connect-src`, so the embed is the path
 *   nobody currently takes. Please don't "fix" this.
 * - In Storybook, the embed, because that CSP is a `vercel.json` response
 *   header and none of it is served here. The `Embed blocked` stories put it
 *   back with `blockEmbed` so the real screen can be read.
 *
 * The prefill is the same map either way: the embed gets it as `config`, the
 * plain link gets it on the query string. */
const meta = {
	args: {
		onBooked: fn(),
		onOpened: fn(),
		onUnavailable: fn(),
		prefill,
		reference,
	},
	component: PricingBookingStep,
	title: "Pricing/PricingBookingStep",
} satisfies Meta<typeof PricingBookingStep>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The default: no name or address known, which is the website mount and the
 * common case in the app too.
 *
 * Storybook has no CSP, so this is the embed route: cal.com's own calendar
 * loads into the box and the eight second timer is called off the moment the
 * iframe first posts back. Nobody in the app sees this today.
 */
export const Default: Story = { name: "No attendee known" };

/** When the mount point already holds a signed-in user, their name and address
 * ride along so cal.com does not ask again. The configurator never asks for
 * either itself, so these can only come from the caller.
 *
 * On this route the difference only shows once you pick a time and the embed's
 * own form comes up already filled in.
 */
export const WithKnownAttendee: Story = {
	args: { prefill: prefillWithAttendee },
	name: "Attendee already known",
};

/** What every person in the app actually gets. `blockEmbed` stands in for the
 * CSP, so the step waits its eight seconds (`EMBED_TIMEOUT_MS`), fires
 * `onUnavailable("timeout", 8)`, and settles from waiting into the plain link.
 *
 * Both phases are this one story. The fallback is not a state you can mount
 * directly, only a later moment of this one, so give it the eight seconds.
 */
export const EmbedBlocked: Story = {
	beforeEach: blockEmbed,
	name: "Embed blocked — fallback link",
};

/** The same fallback, carrying a known attendee.
 *
 * Nothing on screen differs from the story above, and that is the whole
 * behaviour: the fallback screen is fixed copy plus the reference, and the
 * prefill lives entirely in the button's `href`. Hover Pick a time, or copy the
 * link, to see the `name` and `email` keys the other fallback does not carry.
 */
export const EmbedBlockedWithKnownAttendee: Story = {
	args: { prefill: prefillWithAttendee },
	beforeEach: blockEmbed,
	name: "Embed blocked — attendee already known",
};
