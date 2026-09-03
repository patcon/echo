import "@fontsource-variable/space-grotesk";
import "@mantine/core/styles.css";
import "@/index.css";

import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import type { Decorator, Preview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mswLoader } from "msw-storybook-addon/csf3";
import { type PropsWithChildren, useEffect, useMemo, useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { Toaster } from "@/components/common/Toaster";
import { languageOptions } from "@/components/language/LanguagePicker";
import { I18nProvider } from "@/components/layout/I18nProvider";
import { useWhitelabelLogo, WhitelabelLogoProvider } from "@/hooks/useWhitelabelLogo";
import { stripLanguagePrefix } from "@/lib/language";
import { theme } from "@/theme";
import {
	installMediaMock,
	type MediaParameters,
	resetMediaMock,
} from "./mocks/media";

export type { MediaParameters };

// Most components read :language / :workspaceId / :projectId off the route
// (useLanguage, useI18nNavigate, useParams), so a story with no router throws.
// A memory router keeps the URL out of the browser bar, which a real
// createBrowserRouter would fight Storybook over.
const DEFAULT_ROUTE_PATTERN =
	"/:language/w/:workspaceId/projects/:projectId/chats/:chatId";
const DEFAULT_INITIAL_PATH =
	"/en-US/w/workspace-story/projects/project-story/chats/chat-story";

export type RouterParameters = {
	/** Route pattern the story element is mounted at. */
	pattern?: string;
	/** URL the router starts on; must match `pattern`. */
	path?: string;
	/** Extra routes, e.g. a navigation destination to land on. */
	routes?: { path: string; element: React.ReactNode }[];
};

/**
 * Escape hatch for components that read server state through React Query with
 * no prop seam. Most of the suggestion cards derive their "already applied"
 * state by comparing their proposal to whatever the project currently holds,
 * so without a cache entry they can only ever render the un-applied half.
 *
 * A story declares the rows it needs and they are written into that story's
 * own client before the tree mounts:
 *
 *     parameters: {
 *       query: { seed: [[projectGoalQueryKeys.detail(PROJECT_ID), goal]] },
 *     }
 *
 * Keys are the app's own. Prefer an exported key factory where the hook offers
 * one; a hand-written literal has to be kept in step with the hook by hand.
 */
export type QueryParameters = {
	/** `[queryKey, data]` rows written with `setQueryData` before first render. */
	seed?: [readonly unknown[], unknown][];
};

// `Logo` (src/components/common/Logo.tsx) reads `useWhitelabelLogo()` and
// renders a `Loader` while `logoUrl` is `undefined` — the "not resolved yet"
// state. In the real app something always calls `setLogoUrl` shortly after
// mount (`ParticipantLayout.tsx`, `useSidebarWhitelabelLogo.ts`); nothing in
// a story does, so without this the spinner never goes away. Resolves to "no
// custom logo" so stories show the default Dembrane mark instead of a
// permanent spinner.
const ResolveWhitelabelLogo = ({ children }: PropsWithChildren) => {
	const { setLogoUrl } = useWhitelabelLogo();
	useEffect(() => setLogoUrl(null), [setLogoUrl]);
	return children;
};

const AppProviders = ({
	children,
	pattern = DEFAULT_ROUTE_PATTERN,
	path = DEFAULT_INITIAL_PATH,
	routes = [],
	seed = [],
}: PropsWithChildren<RouterParameters & QueryParameters>) => {
	// Per-story client: retries off so a missing backend fails fast and visibly
	// instead of hanging in a spinner for ~30s.
	//
	// staleTime Infinity so seeded rows survive. React Query treats fresh cache
	// data as stale by default and refetches on mount, which against no backend
	// means every seeded story fires a doomed request on load. Stories are
	// static, so nothing here wants refetching anyway.
	//
	// Seeding inside the initialiser, not an effect, because the card reads the
	// cache on its first render and an effect would land a frame too late.
	const [queryClient] = useState(() => {
		const client = new QueryClient({
			defaultOptions: {
				queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
			},
		});
		for (const [key, data] of seed) {
			client.setQueryData(key, data);
		}
		return client;
	});

	// I18nProvider twice, and both are load bearing. The app does the same thing
	// for the same two reasons (`App.tsx` and `LanguageLayout.tsx`):
	//
	// - Inside the router, because it reads the language off `:language` through
	//   useParams. Outside a router that hook sees no params at all, so a story
	//   asking for nl-NL used to fall back to en-US and silently render English.
	// - Outside the router, because Mantine's modal portal re-enters the tree
	//   above it, so <Trans> inside a modals.* child needs Lingui from there
	//   down. See the comment in `App.tsx`.
	//
	// `i18n` is one module-level singleton, so the inner one activating a locale
	// is what the outer one renders too.
	const router = useMemo(
		() =>
			createMemoryRouter(
				[
					{ element: <I18nProvider>{children}</I18nProvider>, path: pattern },
					...routes,
				],
				{ initialEntries: [path] },
			),
		[children, pattern, path, routes],
	);

	return (
		<QueryClientProvider client={queryClient}>
			<MantineProvider theme={theme}>
				<WhitelabelLogoProvider>
					<ResolveWhitelabelLogo>
						<I18nProvider>
							<ModalsProvider>
								<RouterProvider router={router} />
								<Toaster />
							</ModalsProvider>
						</I18nProvider>
					</ResolveWhitelabelLogo>
				</WhitelabelLogoProvider>
			</MantineProvider>
		</QueryClientProvider>
	);
};

const withAppProviders: Decorator = (Story, context) => {
	const router = (context.parameters.router ?? {}) as RouterParameters;
	const query = (context.parameters.query ?? {}) as QueryParameters;
	// Toolbar locale wins over a story's own `router.path` locale segment;
	// left on "Story default" (empty string), the story's path is untouched.
	const locale = context.globals.locale as string | undefined;
	const path = locale
		? `/${locale}${stripLanguagePrefix(router.path ?? DEFAULT_INITIAL_PATH)}`
		: router.path;

	return (
		// Keyed on `path` so a toolbar locale change forces a full remount:
		// Storybook re-renders decorators on a globals change but does not
		// remount them, and the memory router's own internal state (plus
		// anything downstream that only reads locale on mount) would
		// otherwise survive the switch and need a manual page reload.
		<AppProviders
			key={path}
			pattern={router.pattern}
			path={path}
			routes={router.routes}
			seed={query.seed}
		>
			<Story />
		</AppProviders>
	);
};

// Reads are seeded through `parameters.query`; writes need the request itself to
// be answered, which is what MSW is for. A story declares
// `parameters.msw.handlers` and its apply/save buttons complete against them,
// so a card reaches its applied state through the real mutation path rather
// than by being told it is applied.
//
// This is the CSF 3 entry point (`msw-storybook-addon/csf3`). The 3.x default
// export is for CSF Next, which this project does not use, and 2.x's
// `initialize()` no longer exists — `mswLoader()` is a factory now and starts
// the worker itself. Its default setup already ignores Storybook's own asset
// requests and warns on anything else it did not handle, which is the useful
// side of the trade: a typo'd handler path shows up in the console rather than
// failing silently.
//
// If a mocked button is not working, check the path against `API_BASE_URL`
// first (`config.ts:90-93`). Locally it is the relative `/api`, resolved
// against the page origin, so handlers are written as `/api/v2/bff/...` and
// not against a backend host.
//
// The worker file is served from `public/` via `staticDirs` in main.ts.

// `MicrophoneTest` reads `navigator.mediaDevices`/`AudioContext` directly with
// no prop seam. `parameters.media` (see `.storybook/mocks/media.ts`) patches
// those globals for the story's lifetime.
//
// Installed synchronously in a lazy `useState` initializer, not a
// `useEffect`: React fires child effects before parent effects on mount, and
// `MicrophoneTest`'s own device-enumeration effect is a descendant of this
// decorator, so an effect here would race it. A lazy initializer runs during
// the render phase, before any effect in the tree fires.
const withMediaMocks: Decorator = (Story, context) => {
	const media = context.parameters.media as MediaParameters | undefined;
	// Always reset first: a story with no `parameters.media` wants the real
	// browser APIs, and a mock left behind by the previous story would hang it.
	useState(() => {
		resetMediaMock();
		if (media) installMediaMock(media);
		return true;
	});
	useEffect(() => resetMediaMock, []);
	return <Story />;
};

// Every size-bearing type-scale var `AppPreferencesProvider` writes
// (`useAppPreferences.tsx:227-263`); line-heights and weights are ratios and
// aren't touched by the real scale either.
const SCALED_TYPE_VARS = [
	"--app-base-font-size",
	"--app-font-size-xs",
	"--app-font-size-sm",
	"--app-font-size-md",
	"--app-font-size-lg",
	"--app-font-size-xl",
	"--app-heading-h1-size",
	"--app-heading-h2-size",
	"--app-heading-h3-size",
	"--app-heading-h4-size",
	"--app-heading-h5-size",
	"--app-heading-h6-size",
	"--app-home-icon-size",
];

/**
 * `USE_PARTICIPANT_ROUTER` (`config.ts:73`) only turns on for a `portal.*`
 * host or port 5174 — never true in Storybook — so `AppPreferencesProvider`
 * (`useAppPreferences.tsx:16`) never applies the real portal's 0.9x
 * type-scale reduction, and every "Participant/*" story renders ~11% larger
 * than on an actual device. Reproduce that scale directly on the CSS
 * variables it would have set (reading the current value so it stays in step
 * with `index.css`'s ramp) for any story filed under that title, and restore
 * them on unmount so other stories aren't left scaled down.
 */
const withPortalFontScale: Decorator = (Story, context) => {
	const isParticipantStory = context.title.startsWith("Participant/");
	useEffect(() => {
		if (!isParticipantStory) return;
		const root = document.documentElement;
		const previousInlineValues = new Map<string, string>();
		for (const name of SCALED_TYPE_VARS) {
			const current = getComputedStyle(root).getPropertyValue(name).trim();
			const match = current.match(/^([\d.]+)(rem|px)$/);
			if (!match) continue;
			previousInlineValues.set(name, root.style.getPropertyValue(name));
			const scaled = Number.parseFloat(match[1]) * 0.9;
			root.style.setProperty(
				name,
				`${Number.parseFloat(scaled.toFixed(4))}${match[2]}`,
			);
		}
		return () => {
			for (const name of SCALED_TYPE_VARS) {
				const previous = previousInlineValues.get(name);
				if (previous) root.style.setProperty(name, previous);
				else root.style.removeProperty(name);
			}
		};
	}, [isParticipantStory]);
	return <Story />;
};

export const globalTypes: Preview["globalTypes"] = {
	locale: {
		description: "Lingui locale",
		toolbar: {
			dynamicTitle: true,
			icon: "globe",
			items: [
				{ title: "Story default", value: "" },
				...languageOptions.map((o) => ({ title: o.label, value: o.value })),
			],
		},
	},
};

const preview: Preview = {
	decorators: [withAppProviders, withMediaMocks, withPortalFontScale],
	globalTypes,
	loaders: [mswLoader()],
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
	},
};

export default preview;
