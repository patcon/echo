import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import react from "@vitejs/plugin-react";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// The builder picks up ../vite.config.ts automatically, so the lingui plugin,
// the react-compiler babel pass, the `@/` alias and the __APP_BUILD_ID__ define
// all apply here exactly as they do in `pnpm dev`. Nothing is duplicated below.
const config: StorybookConfig = {
	// Renders a badge in the sidebar/toolbar for tags like `new`, `deprecated`
	// or `experimental` declared on a meta or story. Default badge set only —
	// customise by adding `.storybook/manager.ts` with `addons.setConfig({
	// tagBadges: [...] })`.
	addons: ["storybook-addon-tag-badges"],
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
		// Agentation's `injectJsxSource` babel plugin (vite.config.ts) puts a
		// `__source` object into the props of every `_jsx()` call, which the app
		// needs to map an element back to its source line. It is on in any dev-mode
		// build, so Storybook inherits it, and in a story it is pure noise: React
		// warns "Invalid prop `__source` supplied to `React.Fragment`" for every
		// fragment rendered, and every DOM node in the canvas carries a
		// `__source="[object Object]"` attribute that clutters the DOM a `play`
		// function prints on failure. Swap the plugin's own react() instance for
		// one without that injection; `macros` (Lingui) and the react compiler stay.
		const isReactPlugin = (plugin: unknown): boolean =>
			!!plugin &&
			typeof plugin === "object" &&
			"name" in plugin &&
			typeof plugin.name === "string" &&
			plugin.name.startsWith("vite:react-");
		config.plugins = [
			react({
				babel: { plugins: ["macros", ["babel-plugin-react-compiler"]] },
			}),
			...(config.plugins ?? [])
				.flat(Number.POSITIVE_INFINITY)
				.filter((plugin) => !isReactPlugin(plugin)),
		];

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
