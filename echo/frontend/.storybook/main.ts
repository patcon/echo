import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

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
		// Keep API_BASE_URL/DIRECTUS_PUBLIC_URL same-origin regardless of which
		// host serves the build — see mocks/config.ts for why. Listed first so
		// it wins over the broader "@" alias from vite.config.ts.
		config.resolve = {
			...config.resolve,
			alias: {
				"@/config": path.resolve(dirname, "./mocks/config.ts"),
				...config.resolve?.alias,
			},
		};
		return config;
	},
};

export default config;
