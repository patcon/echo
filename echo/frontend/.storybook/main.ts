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
	// msw-storybook-addon v3 needs no `addons` entry: it is wired through
	// `initialize()` + `mswLoader` in preview.tsx. But its service worker is
	// fetched over HTTP, and Storybook does not inherit Vite's publicDir, so
	// `public/mockServiceWorker.js` has to be served explicitly or every mocked
	// request silently falls through to the network.
	staticDirs: ["../public"],
	stories: ["../src/**/*.stories.@(ts|tsx)"],
	// GitHub Pages serves this as a project site under /echo/, not the domain
	// root, so the built assets need that base path baked in. Local dev and
	// `pnpm build-storybook` without the env var are unaffected.
	async viteFinal(config) {
		if (process.env.STORYBOOK_BASE_PATH) {
			config.base = process.env.STORYBOOK_BASE_PATH;
		}
		return config;
	},
};

export default config;
