import { Text } from "@mantine/core";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
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
/**
 * In the real app this renders under `ParticipantLayout` (its `/start` route
 * hides `ParticipantHeader`, so only the component's own internal logo row
 * shows) — `main.!h-dvh.overflow-y-auto > div.flex.h-full.flex-col >
 * main.relative.grow` (`ParticipantLayout.tsx:38-49`). The component relies
 * on that real height: its root is `flex h-full flex-col` and its content
 * area is `flex flex-grow flex-col justify-center`
 * (`ParticipantOnboardingCards.tsx:394,401`), so without a height-constrained
 * ancestor the nav buttons render inline after the content instead of
 * pinned to the bottom, and nothing centers vertically.
 */
const withParticipantLayout: Decorator = (Story) => (
	<main className="relative !h-dvh overflow-y-auto">
		<div className="flex h-full flex-col">
			<main className="relative grow">
				<Story />
			</main>
		</div>
	</main>
);

const meta = {
	component: ParticipantOnboardingCards,
	decorators: [withParticipantLayout],
	parameters: {
		// Storybook's default `layout: "padded"` adds ~16px around the canvas
		// root, which pushes the `!h-dvh` wrapper above just past the viewport
		// and makes it scroll. The real app renders full-bleed.
		layout: "fullscreen",
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

/** Reused by the tag-related stories below. */
const TAGS = [
	{ id: "tag-1", text: "Session A" },
	{ id: "tag-2", text: "Session B" },
];

/** Minimal fixture: only the fields this component's tree reads. No tags by
 * default — the final form's tag `MultiSelect` only renders when
 * `project.tags` is non-empty (`ParticipantInitiateForm.tsx:231`). */
const PROJECT = {
	default_conversation_ask_for_participant_name: true,
	default_conversation_tutorial_slug: "advanced",
	id: "project-onboarding-story",
	legal_basis: "consent",
	organiser_name: "River Cleanup Collective",
	privacy_policy_url: "https://example.org/privacy",
	tags: [],
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
 * `PROJECT` with the tutorial slug fixed at `"None"` and only `legal_basis`
 * swapped, so these three stories isolate the privacy card as the one
 * variable between them.
 */
const withLegalBasis = (
	legalBasis: NonNullable<ParticipantProject["legal_basis"]>,
): ParticipantProject =>
	({
		...PROJECT,
		default_conversation_tutorial_slug: "None",
		legal_basis: legalBasis,
	}) as unknown as ParticipantProject;

/**
 * `legal_basis: "client-managed"` — static text naming the organiser as data
 * controller. No checkbox, no link, Next is never gated.
 */
export const ClientManagedBasis: Story = {
	args: {
		onFunnelStage: fn(),
		project: withLegalBasis("client-managed"),
	},
	name: "Legal basis: client-managed",
};

/**
 * `legal_basis: "consent"` — the only basis with a required checkbox; Next is
 * disabled until it's checked. Also renders a link to the project's own
 * `privacy_policy_url` and interpolates `organiser_name` into the copy.
 */
export const ConsentBasis: Story = {
	args: {
		onFunnelStage: fn(),
		project: withLegalBasis("consent"),
	},
	name: "Legal basis: consent",
};

/**
 * `legal_basis: "dembrane-events"` — static text citing dembrane's own
 * legitimate interest, with a link to dembrane's privacy policy. No
 * checkbox, and the link is a fixed dembrane URL rather than the project's
 * `privacy_policy_url`.
 */
export const DembraneEventsBasis: Story = {
	args: {
		onFunnelStage: fn(),
		project: withLegalBasis("dembrane-events"),
	},
	name: "Legal basis: dembrane-events",
};

/**
 * `withTutorialSlug("None")` plus `project.tags` populated, so these two
 * tag stories isolate the final form's `MultiSelect` as the one variable
 * between them.
 */
const withTags = (tags: typeof TAGS): ParticipantProject =>
	({
		...withTutorialSlug("None"),
		tags,
	}) as unknown as ParticipantProject;

/**
 * `project.tags` non-empty renders the final slide's tag `MultiSelect`
 * (`ParticipantInitiateForm.tsx:231`), none selected by default.
 */
export const WithTags: Story = {
	args: {
		onFunnelStage: fn(),
		project: withTags(TAGS),
	},
	name: "With tags",
};

/**
 * `?tags=` (or `?tag_id_list=`) resolves against `project.tags` in two
 * places: this component's own `preselectedTags` memo, which only feeds
 * `onFunnelStage`'s `tagsPreselected` flag, and `ParticipantInitiateForm`'s
 * `defaultTagIdList`, which preselects entries in the final slide's tag
 * `MultiSelect` (`ParticipantInitiateForm.tsx:250`).
 */
export const TagsPrefilled: Story = {
	args: {
		onFunnelStage: fn(),
		project: withTags(TAGS),
	},
	name: "With tags prefilled (?tags=)",
	parameters: {
		router: {
			path: "/en-US/w/workspace-story/projects/project-story/chats/chat-story?tags=tag-1,tag-2",
		},
	},
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
		project: withTutorialSlug("advanced"),
	},
	parameters: {
		router: {
			path: "/en-US/w/workspace-story/projects/project-story/chats/chat-story?skipOnboarding=1",
		},
	},
};

/**
 * `?skipOnboarding=1` with `default_conversation_ask_for_participant_name:
 * false` and no `?participant_name=` satisfies the auto-submit effect's
 * `hasRequiredName` check (`ParticipantInitiateForm.tsx:125-143`), so this
 * submits immediately and lands on the recording console — no form is ever
 * shown.
 */
export const SkipOnboardingNoName: Story = {
	args: {
		onFunnelStage: fn(),
		project: {
			...withTutorialSlug("None"),
			default_conversation_ask_for_participant_name: false,
		} as ParticipantProject,
	},
	name: "Skip Onboarding: No name (auto-submit)",
	parameters: {
		router: {
			path: "/en-US/w/workspace-story/projects/project-story/chats/chat-story?skipOnboarding=1",
		},
	},
};

/**
 * Same auto-submit as above, but `project.tags` is also populated and
 * `?tags=` prefills them — tags are never required for auto-submit, so the
 * prefilled selection is just carried along in the payload, unseen.
 */
export const SkipOnboardingPrefilledTags: Story = {
	args: {
		onFunnelStage: fn(),
		project: {
			...withTags(TAGS),
			default_conversation_ask_for_participant_name: false,
		} as ParticipantProject,
	},
	name: "Skip Onboarding: Prefilled tags (auto-submit)",
	parameters: {
		router: {
			path: "/en-US/w/workspace-story/projects/project-story/chats/chat-story?skipOnboarding=1&tags=tag-1,tag-2",
		},
	},
};
