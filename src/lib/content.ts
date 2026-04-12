import type { CollectionEntry } from 'astro:content';
import { TOPIC_ORDER, slugifyTag, type TopicKey } from '../data/taxonomy';

export type BlogEntry = CollectionEntry<'blog'>;

export function sortPosts(posts: BlogEntry[]) {
	return [...posts].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function getFeaturedPost(posts: BlogEntry[]) {
	return posts.find((post) => post.data.featured) ?? posts[0];
}

export function getPostsByTopic(posts: BlogEntry[], topic: TopicKey) {
	return sortPosts(posts.filter((post) => post.data.topic === topic));
}

export function getTagCounts(posts: BlogEntry[]) {
	const counts = new Map<string, number>();

	for (const post of posts) {
		for (const tag of post.data.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}

	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([tag, count]) => ({ tag, count, slug: slugifyTag(tag) }));
}

export function getAllTagSlugs(posts: BlogEntry[]) {
	return getTagCounts(posts).map((item) => item.slug);
}

export function getTagNameFromSlug(posts: BlogEntry[], slug: string) {
	return getTagCounts(posts).find((item) => item.slug === slug)?.tag;
}

export function getPostsByTag(posts: BlogEntry[], tag: string) {
	return sortPosts(posts.filter((post) => post.data.tags.includes(tag)));
}

export function getRelatedPosts(posts: BlogEntry[], current: BlogEntry, limit = 3) {
	return sortPosts(
		posts
			.filter((entry) => entry.id !== current.id)
			.map((entry) => {
				const sharedTags = entry.data.tags.filter((tag) => current.data.tags.includes(tag)).length;
				const sameTopic = entry.data.topic === current.data.topic ? 2 : 0;
				return { entry, score: sharedTags * 3 + sameTopic };
			})
			.filter(({ score }) => score > 0)
			.sort((a, b) => b.score - a.score)
			.map(({ entry }) => entry),
	).slice(0, limit);
}

export function getPostNeighbors(posts: BlogEntry[], currentId: string) {
	const sorted = sortPosts(posts);
	const index = sorted.findIndex((post) => post.id === currentId);

	return {
		newer: index > 0 ? sorted[index - 1] : undefined,
		older: index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : undefined,
	};
}

export function getTopicCounts(posts: BlogEntry[]) {
	return TOPIC_ORDER.map((topic) => ({
		topic,
		count: posts.filter((post) => post.data.topic === topic).length,
	}));
}
