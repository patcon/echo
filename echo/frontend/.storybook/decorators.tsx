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

/**
 * Reproduces the audio route's `<Outlet />` column in
 * `ParticipantConversationAudio` — a centered, width-capped, bottom-aligned
 * container. Everything on the conversation screen renders inside it, and
 * anything that right-aligns itself or wraps only reads correctly at that
 * width. Nest it inside `withParticipantLayout`.
 */
export const withConversationOutlet: Decorator = (Story) => (
	<div className="container mx-auto flex h-full max-w-2xl flex-col justify-end">
		<div className="relative flex-grow p-4">
			<Story />
		</div>
	</div>
);
