import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";
import { TOPIC_ORDER } from "./data/taxonomy";

const blog = defineCollection({
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.string().optional(),
		topic: z.enum(TOPIC_ORDER),
		tags: z.array(z.string()).default([]),
		featured: z.boolean().default(false),
		readerGoal: z.string().optional(),
		quickAnswer: z.string().optional(),
	}),
});

export const collections = { blog };
