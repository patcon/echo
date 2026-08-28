import { Box } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CanvasFrame } from "./CanvasFrame";
import { fixtureCanvasGenerations } from "./fixtures";

/** What the platform hands back at the end: a generated "panel wall"
 * (`fixtures.ts:14`) rendered from model-authored HTML.
 *
 * Provenance convention for this file: any claim that carries a `file:line`
 * ref was read out of that source. Anything without one is my own reading of
 * the code and should be checked before you rely on it.
 *
 * Two things are invisible in the rendered output and worth knowing first:
 *
 *  - The canvas is untrusted HTML. It renders in an iframe with
 *    `sandbox="allow-scripts"` and no `allow-same-origin` (`CanvasFrame.tsx:147`),
 *    around a document built by `assembleCanvasDocument` (`kit.ts`, called at
 *    `CanvasFrame.tsx:90`). The frame then sizes itself: the document posts
 *    `{ type: "dembrane:canvas:height", height }` to the parent, which clamps to
 *    a 320px floor (`CanvasFrame.tsx:49-57`). No story exercises that handshake,
 *    because the fixture HTML is static, so every story below sits at the 520px
 *    initial height (`CanvasFrame.tsx:39`).
 *  - `useWhitelabelLogo` is plain React context defaulting to `undefined`
 *    (`useWhitelabelLogo.tsx:10,29`), so the logo `fetch` at
 *    `CanvasFrame.tsx:63` never fires in Storybook. No decorator or request
 *    mocking is needed.
 *
 * The generations come from `./fixtures`, and that content is dembrane's, not
 * mine. They are also not test fixtures: they are a local-dev fallback the
 * canvas hooks return when the BFF 404s (`canvas/hooks/index.ts:93`), which is a
 * hand-rolled version of what Storybook is for. See `.storybook/NOTES.md`. The
 * sample content is good, so these stories import it and change nothing.
 */
const meta = {
	component: CanvasFrame,
	title: "Canvas/CanvasFrame",
} satisfies Meta<typeof CanvasFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `fixtures.ts:97`. Index order is ok / no_op / error. */
const [okGeneration, noOpGeneration, errorGeneration] =
	fixtureCanvasGenerations;

/** Before the first run finishes there is no generation at all
 * (`CanvasFrame.tsx:97-116`). */
export const Empty: Story = {
	args: { generation: null },
};

/** A completed run.
 *
 * `projectId` is not decoration. It reaches `isAllowedPortalQrUrl`
 * (`kit.ts:79-96`), which swaps a link inside the canvas for a rendered QR image
 * (`kit.ts:99`) only when the link's origin matches the portal base URL and its
 * path is exactly this project's `/{lang}/{projectId}/start`. Any other link
 * stays a link. `ChatHistoryMessage` does the same thing for chat replies.
 *
 * The fixture HTML contains no portal link, so no QR renders here. */
export const Rendered: Story = {
	args: { generation: okGeneration, projectId: "project-story" },
};

/** A run that looked at the latest window and changed nothing.
 *
 * `no_op` renders as an ordinary canvas: `CanvasFrame` special-cases only
 * `error` (`:118`), so every other status takes the iframe path. The fixture's
 * own copy says the run "kept the previous version because there was no
 * meaningful change" (`fixtures.ts:93`). */
export const NoOp: Story = {
	args: { generation: noOpGeneration, projectId: "project-story" },
	name: "No-op run",
};

/** The one status that does not render an iframe (`CanvasFrame.tsx:118-140`).
 * `content_html` is empty on an errored generation (`fixtures.ts:118`), and the
 * copy points at the previous versions rather than showing a blank canvas. */
export const ErrorState: Story = {
	args: { generation: errorGeneration },
	name: "Error",
};

/** The `fullscreen` branch: `100dvh` / `100dvw` and no border
 * (`CanvasFrame.tsx:149-160`). In the app it is driven by a "Full screen" toggle
 * on the canvas route (`CanvasRoute.tsx:571`, passed down at `:672`).
 *
 * My reading, not sourced: this is for projecting the wall on a screen in the
 * room. The toggle and the viewport units are real; the intent behind them is a
 * guess.
 *
 * The story bounds it in a parent so it does not fight the Storybook canvas. */
export const Fullscreen: Story = {
	args: { fullscreen: true, generation: okGeneration },
	render: (args) => (
		<Box h={600} style={{ overflow: "hidden", position: "relative" }}>
			<CanvasFrame {...args} />
		</Box>
	),
};
