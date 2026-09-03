// Aliased in over "@/config" (see main.ts's viteFinal) for every Storybook
// build, not just the GitHub Pages one — a relative import here, not the "@/"
// alias, so this doesn't resolve back to itself.
//
// config.ts picks API_BASE_URL/DIRECTUS_PUBLIC_URL from `window.location`: a
// relative "/api" path only when the hostname is a recognized local one.
// Every story's MSW handlers are written against that relative-path
// convention (see AGENTS.md and GoalSuggestionCard.stories.tsx), and EventSource
// / fetch / axios all resolve a relative URL against the *page's* origin — so
// on any other host (GitHub Pages, Chromatic, a teammate's LAN IP) those
// constants would resolve to the real dembrane.com API instead, and none of
// the handlers would match the resulting absolute URL. Force the same
// same-origin behavior Storybook already gets when run locally.
export * from "../../src/config";

export const API_BASE_URL = "/api";
export const DIRECTUS_PUBLIC_URL = `${globalThis.window?.location.origin ?? ""}/directus`;
