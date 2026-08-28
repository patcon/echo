import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack, Text } from "@mantine/core";
import type { AgenticRunEvent } from "@/lib/api";
import {
	extractTopLevelToolActivity,
	parseNavigationSuggestion,
} from "./agenticToolActivity";
import { NavigationSuggestionCard } from "./NavigationSuggestionCard";

const projectId = "project-story";

const meta = {
	component: NavigationSuggestionCard,
	parameters: {
		// The card navigates on click; give the router somewhere to land so the
		// button does something visible instead of blanking the canvas.
		router: {
			routes: [
				{
					element: <Text p="lg">Overview route reached.</Text>,
					path: "/:language/w/:workspaceId/projects/:projectId/home",
				},
			],
		},
	},
	title: "Chat/NavigationSuggestionCard",
} satisfies Meta<typeof NavigationSuggestionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Overview: Story = {
	args: {
		suggestion: { entityId: null, page: "overview", projectId },
	},
};

export const Library: Story = {
	args: {
		suggestion: { entityId: null, page: "library", projectId },
	},
};

export const ConversationEntity: Story = {
	args: {
		suggestion: {
			entityId: "conversation-story",
			page: "conversations",
			projectId,
		},
	},
};

// Mirrors e2e/navigation-suggestion.spec.ts: exercises the real
// extract -> parse pipeline rather than hand-building the suggestion, so a
// change to the tool-output shape shows up here too.
const navigateToEvent: AgenticRunEvent = {
	event_type: "on_tool_end",
	id: 1,
	payload: {
		name: "navigateTo",
		output: {
			kwargs: {
				content: JSON.stringify({
					entity_id: null,
					label: "overview",
					page: "overview",
					project_id: projectId,
					type: "navigation_suggestion",
					visible_to_user: true,
				}),
			},
		},
	},
	project_agentic_run_id: "run-story",
	seq: 1,
	timestamp: new Date("2026-07-08T12:00:00Z").toISOString(),
};

export const ParsedFromToolEvent: Story = {
	args: {
		suggestion: { entityId: null, page: "overview", projectId },
	},
	render: () => {
		const activity = extractTopLevelToolActivity([navigateToEvent])[0];
		const suggestion = activity ? parseNavigationSuggestion(activity) : null;

		return (
			<Stack maw={720}>
				{suggestion ? (
					<NavigationSuggestionCard suggestion={suggestion} />
				) : (
					<Text size="sm">No navigation suggestion parsed.</Text>
				)}
			</Stack>
		);
	},
};
