export const TOPICS = {
	foundations: {
		slug: 'foundations-and-planning',
		name: 'Foundations & Planning',
		description:
			'Positioning, platform choices, page priorities, and the structural decisions that make a personal website easier to build and easier to grow.',
		shortDescription: 'Start with the right goal, shape, and publishing plan.',
	},
	pages: {
		slug: 'pages-and-navigation',
		name: 'Pages & Navigation',
		description:
			'Homepage structure, about pages, portfolio framing, navigation labels, and the page-level decisions that help visitors know where they are and what to do next.',
		shortDescription: 'Build pages that explain the site quickly and move readers forward.',
	},
	publishing: {
		slug: 'blogging-and-publishing',
		name: 'Blogging & Publishing',
		description:
			'Editorial systems for small websites: categories, tags, archives, publishing cadence, and the habits that turn scattered posts into a coherent site.',
		shortDescription: 'Turn isolated posts into a body of work that compounds over time.',
	},
	growth: {
		slug: 'seo-and-audience-growth',
		name: 'SEO & Audience Growth',
		description:
			'Search basics, internal linking, evergreen content, and sustainable discovery systems for independent blogs and personal websites.',
		shortDescription: 'Grow discovery with durable site structure instead of constant platform chasing.',
	},
} as const;

export type TopicKey = keyof typeof TOPICS;

export const TOPIC_ORDER = ['foundations', 'pages', 'publishing', 'growth'] as const;

export function getTopic(key: TopicKey) {
	return TOPICS[key];
}

export function getTopicBySlug(slug: string) {
	return TOPIC_ORDER.find((key) => TOPICS[key].slug === slug);
}

export function slugifyTag(tag: string) {
	return tag
		.toLowerCase()
		.replace(/&/g, 'and')
		.trim()
		.split(/[^a-z0-9]+/g)
		.filter(Boolean)
		.join('-');
}
