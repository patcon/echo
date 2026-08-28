import "@fontsource-variable/space-grotesk";
import "@mantine/core/styles.css";
import "@/index.css";

import type { Decorator, Preview } from "@storybook/react-vite";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useMemo, useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { Toaster } from "@/components/common/Toaster";
import { I18nProvider } from "@/components/layout/I18nProvider";
import { theme } from "@/theme";

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

const AppProviders = ({
	children,
	pattern = DEFAULT_ROUTE_PATTERN,
	path = DEFAULT_INITIAL_PATH,
	routes = [],
}: PropsWithChildren<RouterParameters>) => {
	// Per-story client: retries off so a missing backend fails fast and visibly
	// instead of hanging in a spinner for ~30s.
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: { queries: { retry: false } },
			}),
	);

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
				<I18nProvider>
					<ModalsProvider>
						<RouterProvider router={router} />
						<Toaster />
					</ModalsProvider>
				</I18nProvider>
			</MantineProvider>
		</QueryClientProvider>
	);
};

const withAppProviders: Decorator = (Story, context) => {
	const router = (context.parameters.router ?? {}) as RouterParameters;

	return (
		<AppProviders
			pattern={router.pattern}
			path={router.path}
			routes={router.routes}
		>
			<Story />
		</AppProviders>
	);
};

const preview: Preview = {
	decorators: [withAppProviders],
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
