import type { CollectionEntry } from "astro:content";

export type BlogEntry = CollectionEntry<"blog">;

export function sortPosts(posts: BlogEntry[]) {
	return [...posts].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function getFeaturedPost(posts: BlogEntry[]) {
	return posts.find((post) => post.data.featured) ?? posts[0];
}

export function getPostNeighbors(posts: BlogEntry[], currentId: string) {
	const sorted = sortPosts(posts);
	const index = sorted.findIndex((post) => post.id === currentId);

	return {
		newer: index > 0 ? sorted[index - 1] : undefined,
		older: index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : undefined,
	};
}

export function getReadingMinutes(wordCount?: number) {
	if (!wordCount || wordCount < 1) {
		return undefined;
	}

	return Math.max(1, Math.round(wordCount / 450));
}
