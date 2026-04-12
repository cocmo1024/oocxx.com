export const TOPICS = {
	identity: {
		slug: 'identity-and-proof',
		name: 'Identity & Proof',
		description:
			'Counters, guestbooks, site badges, and all the small ways early websites proved they had visitors.',
		shortDescription: 'How small sites recorded presence, trust, and return visits.',
	},
	navigation: {
		slug: 'navigation-and-discovery',
		name: 'Navigation & Discovery',
		description:
			'WebRings, portal pages, directory logic, and the hand-built routes people used to discover small sites.',
		shortDescription: 'The mechanics of wandering the web before feeds and centralized timelines.',
	},
	spectacle: {
		slug: 'spectacle-and-interface-noise',
		name: 'Spectacle & Interface Noise',
		description:
			'Blinking text, GIF badges, construction banners, and the loud visual grammar of the first web.',
		shortDescription: 'The decorative and attention-seeking layer of the early web.',
	},
	publishing: {
		slug: 'homepages-and-publishing-habits',
		name: 'Homepages & Publishing Habits',
		description:
			'GeoCities neighborhoods, splash pages, homepage layouts, and the editorial habits of personal sites.',
		shortDescription: 'How early homepages introduced themselves and arranged information.',
	},
} as const;

export type TopicKey = keyof typeof TOPICS;

export const TOPIC_ORDER = Object.keys(TOPICS) as TopicKey[];

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
