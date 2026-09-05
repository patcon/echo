import { Text } from "@mantine/core";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import { withParticipantLayout } from "../../../../.storybook/decorators";
import { RefineSelection } from "./RefineSelection";

const PROJECT_ID = "project-story";
const CONVERSATION_ID = "conversation-story";
const BASE_PATH = `/en-US/${PROJECT_ID}/conversation/${CONVERSATION_ID}`;

/** Reproduces the audio route's `<Outlet />` wrapper. Load bearing here: the
 * cards size themselves with `flex-1` / `h-[50%]`, so without a
 * height-constrained ancestor they collapse to their text. */
const withConversationOutlet: Decorator = (Story) => (
	<div className="container mx-auto flex h-full max-w-2xl flex-col justify-end">
		<div className="relative flex-grow p-4">
			<Story />
		</div>
	</div>
);

const project = (overrides: Partial<ParticipantProject>) =>
	({
		id: PROJECT_ID,
		is_get_reply_enabled: true,
		is_verify_enabled: true,
		language: "en",
		...overrides,
	}) as unknown as ParticipantProject;

/** Seeds the project query and answers the request behind it, so the two cannot
 * drift if the query ever refetches. */
const withProject = (overrides: Partial<ParticipantProject> = {}) => {
	const data = project(overrides);
	return {
		msw: {
			handlers: [
				http.get(`/api/participant/projects/${PROJECT_ID}`, () =>
					HttpResponse.json(data),
				),
			],
		},
		query: { seed: [[["participantProject", PROJECT_ID], data]] },
	};
};

/** Both cards navigate on click, so give the memory router somewhere to land
 * rather than dead-ending on an unmatched route. */
const ROUTER = {
	path: `${BASE_PATH}/refine`,
	pattern: "/:language?/:projectId/conversation/:conversationId/refine",
	routes: [
		{
			element: <Text p="lg">Verify flow (storied separately).</Text>,
			path: `${BASE_PATH}/verify`,
		},
		{
			element: (
				<Text p="lg">Back to the conversation, with echo requested.</Text>
			),
			path: BASE_PATH,
		},
	],
};

/** The fork at the end of a conversation: Verify (make the contribution
 * concrete) and Explore (get an immediate reply). Which cards appear is driven
 * by two project flags, and each card can independently be cooling down.
 *
 * Cooldowns live in localStorage under `cooldown_<conversationId>_<type>` and
 * last two minutes, so they leak between stories unless cleared. `RefineSelection`
 * writes a third key, `refine_disabled_<conversationId>`, when Explore is
 * clicked. All three are reset before every story below.
 *
 * Not storied: while the project query loads, and when both flags are off, the
 * component renders null. */
const meta = {
	beforeEach: () => {
		localStorage.removeItem(`cooldown_${CONVERSATION_ID}_verify`);
		localStorage.removeItem(`cooldown_${CONVERSATION_ID}_echo`);
		localStorage.removeItem(`refine_disabled_${CONVERSATION_ID}`);
	},
	component: RefineSelection,
	decorators: [withConversationOutlet, withParticipantLayout],
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withProject(),
	},
	title: "Participant/RefineSelection",
} satisfies Meta<typeof RefineSelection>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Both flags on, so the two cards split the height evenly. */
export const BothOptions: Story = {};

/** With one card hidden the survivor takes a fixed half-height rather than
 * stretching, leaving deliberate empty space below it. */
export const VerifyOnly: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withProject({ is_get_reply_enabled: false }),
	},
};

export const ExploreOnly: Story = {
	parameters: {
		layout: "fullscreen",
		router: ROUTER,
		...withProject({ is_verify_enabled: false }),
	},
};

/** Halfway through the two minute cooldown, so the card is dimmed and
 * click-blocked and the progress bar sits near 50% with "1:00" left. The
 * remaining time ticks down once a second. */
export const VerifyCoolingDown: Story = {
	beforeEach: () => {
		localStorage.setItem(
			`cooldown_${CONVERSATION_ID}_verify`,
			String(Date.now() - 60_000),
		);
	},
};

export const EchoCoolingDown: Story = {
	beforeEach: () => {
		localStorage.setItem(
			`cooldown_${CONVERSATION_ID}_echo`,
			String(Date.now() - 60_000),
		);
	},
};
