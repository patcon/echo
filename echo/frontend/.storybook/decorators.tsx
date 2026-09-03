import type { Decorator } from "@storybook/react-vite";

/**
 * Reproduces `ParticipantLayout`'s height-constrained shell —
 * `main.!h-dvh.overflow-y-auto > div.flex.h-full.flex-col > main.relative.grow`
 * (`ParticipantLayout.tsx:38-49`) — the real ancestor every routed
 * `Participant/*` screen renders inside. Needed whenever a component's own
 * layout depends on a height-constrained ancestor (e.g. a `flex-grow`
 * content area meant to fill available height, or nav buttons pinned to the
 * bottom); pair with `parameters.layout: "fullscreen"` so Storybook's own
 * padded canvas root doesn't push the `!h-dvh` wrapper taller than the
 * viewport.
 */
export const withParticipantLayout: Decorator = (Story) => (
	<main className="relative !h-dvh overflow-y-auto">
		<div className="flex h-full flex-col">
			<main className="relative grow">
				<Story />
			</main>
		</div>
	</main>
);
