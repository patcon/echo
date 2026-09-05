import type { VerificationTopicMetadata } from "@/lib/api";

/** The six default verification topics, transcribed from the server seed that
 * `reconcile_default_verification_topics` applies at startup: real keys, real
 * sort order, the eight locales the seed ships, and the Slack shortcodes it
 * stores. Shortcodes rather than emoji is the point. Both `VerifiedArtefactItem`
 * and `VerifySelection` reject any icon starting with ":" and substitute one
 * from their own `TOPIC_ICON_MAP`, so a fixture carrying emoji here would skip
 * that path entirely.
 *
 * Transcribed, so it can drift if the seed changes. Re-read `seed.py` rather
 * than trusting this if a label looks wrong. */
export const SEEDED_TOPICS: VerificationTopicMetadata[] = [
	{
		icon: ":white_check_mark:",
		key: "agreements",
		sort: 1,
		translations: {
			"cs-CZ": { label: "Na čem jsme se shodli" },
			"de-DE": { label: "Worauf wir uns wirklich geeinigt haben" },
			"en-US": { label: "What we actually agreed on" },
			"es-ES": { label: "En qué estuvimos de acuerdo" },
			"fr-FR": { label: "Ce qu'on a décidé ensemble" },
			"it-IT": { label: "Su cosa ci siamo accordati" },
			"nl-NL": { label: "Waar we het over eens werden" },
			"uk-UA": { label: "Про що ми домовились" },
		},
	},
	{
		icon: ":mag:",
		key: "gems",
		sort: 2,
		translations: {
			"cs-CZ": { label: "Skryté klenoty" },
			"de-DE": { label: "Verborgene Schätze" },
			"en-US": { label: "Hidden gems" },
			"es-ES": { label: "Joyas ocultas" },
			"fr-FR": { label: "Pépites cachées" },
			"it-IT": { label: "Perle nascoste" },
			"nl-NL": { label: "Verborgen parels" },
			"uk-UA": { label: "Приховані перлини" },
		},
	},
	{
		icon: ":eyes:",
		key: "truths",
		sort: 3,
		translations: {
			"cs-CZ": { label: "Bolestivé pravdy" },
			"de-DE": { label: "Unbequeme Wahrheiten" },
			"en-US": { label: "Painful truths" },
			"es-ES": { label: "Verdades incómodas" },
			"fr-FR": { label: "Vérités difficiles" },
			"it-IT": { label: "Verità scomode" },
			"nl-NL": { label: "Pijnlijke waarheden" },
			"uk-UA": { label: "Болючі істини" },
		},
	},
	{
		icon: ":rocket:",
		key: "moments",
		sort: 4,
		translations: {
			"cs-CZ": { label: "Průlomové okamžiky" },
			"de-DE": { label: "Durchbrüche" },
			"en-US": { label: "Breakthrough moments" },
			"es-ES": { label: "Momentos decisivos" },
			"fr-FR": { label: "Moments décisifs" },
			"it-IT": { label: "Momenti di svolta" },
			"nl-NL": { label: "Doorbraken" },
			"uk-UA": { label: "Моменти прориву" },
		},
	},
	{
		icon: ":arrow_upper_right:",
		key: "actions",
		sort: 5,
		translations: {
			"cs-CZ": { label: "Co by se podle nás mělo stát" },
			"de-DE": { label: "Was wir denken, das passieren sollte" },
			"en-US": { label: "What we think should happen" },
			"es-ES": { label: "Lo que creemos que debe pasar" },
			"fr-FR": { label: "Ce qu'on pense qu'il faut faire" },
			"it-IT": { label: "Cosa pensiamo debba succedere" },
			"nl-NL": { label: "Wat we denken dat moet gebeuren" },
			"uk-UA": { label: "Що, на нашу думку, має статися" },
		},
	},
	{
		icon: ":warning:",
		key: "disagreements",
		sort: 6,
		translations: {
			"cs-CZ": { label: "Kdy jsme se shodli, že se neshodneme" },
			"de-DE": { label: "Worüber wir uns nicht einig wurden" },
			"en-US": { label: "Moments we agreed to disagree" },
			"es-ES": { label: "Donde no coincidimos" },
			"fr-FR": { label: "Là où on n'était pas d'accord" },
			"it-IT": { label: "Dove non eravamo d'accordo" },
			"nl-NL": { label: "Waar we het oneens bleven" },
			"uk-UA": { label: "Де ми погодились не погоджуватись" },
		},
	},
];

/** Custom topics are created per project with a `<slug>-<8 hex>` key, an
 * `en-US` translation plus whatever the host translated, and a free-text icon.
 * Having no `TOPIC_ICON_MAP` entry, this is the only kind whose stored icon
 * actually reaches the UI. */
export const CUSTOM_TOPIC: VerificationTopicMetadata = {
	icon: "🤔",
	is_custom: true,
	key: "what-surprised-us-3f9a2c1b",
	translations: {
		"en-US": { label: "What surprised us about the timeline" },
	},
};
