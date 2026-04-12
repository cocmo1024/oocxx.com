import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_AUTHOR, SITE_DESCRIPTION, SITE_LANGUAGE, SITE_TITLE, SITE_URL } from "../consts";
import { sortPosts } from "../lib/content";

export async function GET(context) {
	const posts = sortPosts(await getCollection("blog"));
	const site = context.site ?? SITE_URL;
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site,
		xmlns: {
			atom: "http://www.w3.org/2005/Atom",
		},
		customData: `<language>${SITE_LANGUAGE.toLowerCase()}</language><copyright>${new Date().getFullYear()} ${SITE_AUTHOR}</copyright><atom:link href="${new URL("/rss.xml", site).toString()}" rel="self" type="application/rss+xml" />`,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			categories: post.data.tags,
			link: `/blog/${post.id}/`,
		})),
	});
}
