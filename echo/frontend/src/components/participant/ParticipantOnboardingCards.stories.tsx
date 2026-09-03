import { Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import { fn } from "storybook/test";
import ParticipantOnboardingCards from "./ParticipantOnboardingCards";

/**
 * The final slide's form really does POST to
 * `/participant/projects/:projectId/conversations/initiate`
 * (`lib/api.ts:181-202`) on submit. This handler answers it so pressing
 * Continue there completes and navigates, instead of failing against no
 * backend and toasting the mutation's generic "Invalid PIN or email" error
 * (`hooks/index.ts:324-334` — that message fires on any failure, not just a
 * bad PIN). */
const initiateConversationHandler = http.post(
	"/api/participant/projects/:projectId/conversations/initiate",
	async ({ request, params }) => {
		const body = (await request.json()) as {
			name: string;
			tag_id_list: string[];
		};
		return HttpResponse.json({
			created_at: new Date(),
			id: "conversation-onboarding-story",
			participant_name: body.name,
			project_id: params.projectId as string,
			tags: [],
			updated_at: new Date(),
		} satisfies TConversation);
	},
);

/**
 * The onboarding slide deck a participant sees between scanning a QR code and
 * reaching the recording console. Deck contents are driven by the project's
 * `default_conversation_tutorial_slug` and `legal_basis`
 * (`hooks/useOnboardingCards.ts`); a mic-check slide and the "ready to begin"
 * form are always appended last.
 *
 * The mic-check slide embeds `MicrophoneTest` with no mock, so it prompts for
 * a real microphone. `MicrophoneTest`'s own permission/device/volume states
 * are covered separately in `ParticipantSettingsModal.stories.tsx`.
 */
const meta = {
	component: ParticipantOnboardingCards,
	parameters: {
		msw: { handlers: [initiateConversationHandler] },
		// Successful submit navigates to `/:language/:projectId/conversation/:id`
		// (`ParticipantInitiateForm.tsx:169-171`); give it somewhere to land.
		router: {
			routes: [
				{
					element: <Text p="lg">Recording console reached.</Text>,
					path: "/:language/:projectId/conversation/:conversationId",
				},
			],
		},
	},
	title: "Participant/ParticipantOnboardingCards",
} satisfies Meta<typeof ParticipantOnboardingCards>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Minimal fixture: only the fields this component's tree reads. */
const PROJECT = {
	default_conversation_ask_for_participant_name: true,
	default_conversation_tutorial_slug: "advanced",
	id: "project-onboarding-story",
	legal_basis: "consent",
	organiser_name: "River Cleanup Collective",
	privacy_policy_url: "https://example.org/privacy",
	tags: [
		{ id: "tag-1", text: "Session A" },
		{ id: "tag-2", text: "Session B" },
	],
} as unknown as ParticipantProject;

/**
 * `PROJECT` with only the tutorial slug swapped, and `legal_basis` pinned to
 * `client-managed` (no consent checkbox) so these three stories isolate the
 * slug as the one variable between them.
 */
const withTutorialSlug = (
	slug: "None" | "basic" | "advanced",
): ParticipantProject =>
	({
		...PROJECT,
		default_conversation_tutorial_slug: slug,
		legal_basis: "client-managed",
	}) as unknown as ParticipantProject;

/**
 * The full deck: `advanced` tutorial plus `consent` legal basis, which
 * together exercise every slide type (plain content, a required checkbox
 * with a privacy-policy link, the mic check, and the final form).
 */
export const Playground: Story = {
	args: {
		onFunnelStage: fn(),
		project: PROJECT,
	},
};

/**
 * `default_conversation_tutorial_slug: "None"` — the fallback when a host
 * hasn't set a tutorial. Only a privacy card precedes the mic check and the
 * final form; no welcome or "how it works" slides.
 */
export const NoTutorial: Story = {
	args: {
		onFunnelStage: fn(),
		project: withTutorialSlug("None"),
	},
	name: "No tutorial (default)",
};

/**
 * `default_conversation_tutorial_slug: "basic"` — a short welcome-plus-privacy
 * tutorial, no "Best Practices" section.
 */
export const BasicTutorial: Story = {
	args: {
		onFunnelStage: fn(),
		project: withTutorialSlug("basic"),
	},
	name: "Basic tutorial",
};

/**
 * `default_conversation_tutorial_slug: "advanced"` — adds a "Best Practices"
 * section (background noise, connection, keeping the device unlocked) on top
 * of the basic tutorial's slides.
 */
export const AdvancedTutorial: Story = {
	args: {
		onFunnelStage: fn(),
		project: withTutorialSlug("advanced"),
	},
	name: "Advanced tutorial",
};

/**
 * `?skipOnboarding=1` skips the deck entirely and renders the "ready to
 * begin" form directly under a plain heading — a distinct render branch, not
 * a state within the deck above.
 */
export const SkipOnboarding: Story = {
	args: {
		onFunnelStage: fn(),
		project: PROJECT,
	},
	name: "Skip onboarding (?skipOnboarding=1)",
	parameters: {
		router: {
			path: "/en-US/w/workspace-story/projects/project-story/chats/chat-story?skipOnboarding=1",
		},
	},
};
