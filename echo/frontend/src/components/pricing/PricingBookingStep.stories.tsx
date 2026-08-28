import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { buildBookingPrefill } from "./bookingPrefill";
import { PricingBookingStep } from "./PricingBookingStep";
import { getQuestionSet } from "./questions";

const reference = "DEM-4F2A";

/** The same map the real flow hands over: a plain-text summary of the answers
 * plus the reference, in cal.com's own prefill keys. */
const prefill = buildBookingPrefill({
	answers: {
		concurrency: "2_5",
		context: "Two rooms running at once, both in Dutch.",
		extras: ["custom_logo"],
		timing: "next_month",
		use_case: ["event_workshop", "assembly"],
		volume: "10_50",
	},
	questions: getQuestionSet(),
	reference,
});

/** The booking screen, reached in the app only after a send returns a
 * reference. That reference is component state on `PricingConfigurator`, so
 * `?pc_step=book` cannot get you here — hence this separate file. The
 * configurator's own `6. Extras — sends, then books` story covers the
 * transition into it.
 *
 * Both stories below end up on the fallback link, and that is correct: the
 * app's CSP lists cal.com in none of `frame-src`, `script-src` or
 * `connect-src`, so every person in every environment already gets the plain
 * link. The embed is the path nobody currently takes. Please don't "fix" this. */
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
 * Give it eight seconds (`EMBED_TIMEOUT_MS`). The script never lands, the timer
 * fires `onUnavailable("timeout", 8)`, and the screen settles from waiting into
 * the fallback link. Both phases are this one story; the fallback is not a
 * separate state you can mount directly, only a later moment of this one.
 */
export const Default: Story = { name: "No attendee known" };

/** When the mount point already holds a signed-in user, their name and address
 * ride along so cal.com does not ask again. The configurator never asks for
 * either itself, so these can only come from the caller.
 *
 * The visible difference is in the fallback link's query string: `name` and
 * `email` keys that the story above does not carry.
 */
export const WithKnownAttendee: Story = {
	args: {
		prefill: buildBookingPrefill({
			answers: {
				concurrency: "2_5",
				timing: "next_month",
				use_case: ["event_workshop"],
				volume: "10_50",
			},
			attendee: { email: "rosa@example.org", name: "Rosa Meijer" },
			questions: getQuestionSet(),
			reference,
		}),
	},
	name: "Attendee already known",
};
