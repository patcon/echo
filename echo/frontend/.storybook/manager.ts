import { addons } from "storybook/manager-api";
import {
	defaultConfig,
	type TagBadgeParameters,
} from "storybook-addon-tag-badges/manager-helpers";

addons.setConfig({
	tagBadges: [
		// Flags a story that isn't reachable through any real caller today
		// (e.g. a prop that's hardcoded upstream), so it doesn't get mistaken
		// for a state the app can actually produce.
		{
			badge: {
				style: "grey",
				text: "Unused",
				tooltip: "Not reachable through any current caller",
			},
			tags: "unused",
		},
		{
			badge: {
				style: "orange",
				text: "Edge case",
				tooltip: "Reachable, but only via a narrow race or rare condition",
			},
			tags: "edge-case",
		},
		...defaultConfig,
	] satisfies TagBadgeParameters,
});
