import type { StorybookConfig } from "@storybook/react-vite";

// The builder picks up ../vite.config.ts automatically, so the lingui plugin,
// the react-compiler babel pass, the `@/` alias and the __APP_BUILD_ID__ define
// all apply here exactly as they do in `pnpm dev`. Nothing is duplicated below.
const config: StorybookConfig = {
	addons: [],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	stories: ["../src/**/*.stories.@(ts|tsx)"],
};

export default config;
