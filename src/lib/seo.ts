import {
	SITE_AUTHOR,
	SITE_DESCRIPTION,
	SITE_LANGUAGE,
	SITE_TITLE,
	SITE_URL,
} from "../consts";

export type SchemaObject = Record<string, unknown>;

export type BreadcrumbItem = {
	name: string;
	item?: string;
};

export type ItemListEntry = {
	name: string;
	url: string;
};

export const PERSON_SCHEMA_ID = `${SITE_URL}/#person`;
export const WEBSITE_SCHEMA_ID = `${SITE_URL}/#website`;

function compactSchema<T extends SchemaObject>(schema: T): T {
	return Object.fromEntries(
		Object.entries(schema).filter(([, value]) => value !== undefined && value !== null),
	) as T;
}

export function absoluteUrl(path: string) {
	try {
		return new URL(path).toString();
	} catch {
		return new URL(path, SITE_URL).toString();
	}
}

export function getPersonSchema() {
	return compactSchema({
		"@type": "Person",
		"@id": PERSON_SCHEMA_ID,
		name: SITE_AUTHOR,
		url: SITE_URL,
		description: SITE_DESCRIPTION,
	});
}

export function getWebsiteSchema() {
	return compactSchema({
		"@type": "WebSite",
		"@id": WEBSITE_SCHEMA_ID,
		url: SITE_URL,
		name: SITE_TITLE,
		description: SITE_DESCRIPTION,
		inLanguage: SITE_LANGUAGE,
		author: { "@id": PERSON_SCHEMA_ID },
		publisher: { "@id": PERSON_SCHEMA_ID },
	});
}

export function getPageSchema({
	type = "WebPage",
	url,
	name,
	description,
	breadcrumbId,
	mainEntityId,
	image,
}: {
	type?: string;
	url: string;
	name: string;
	description: string;
	breadcrumbId?: string;
	mainEntityId?: string;
	image?: string;
}) {
	return compactSchema({
		"@type": type,
		"@id": `${url}#webpage`,
		url,
		name,
		description,
		inLanguage: SITE_LANGUAGE,
		isPartOf: { "@id": WEBSITE_SCHEMA_ID },
		breadcrumb: breadcrumbId ? { "@id": breadcrumbId } : undefined,
		mainEntity: mainEntityId ? { "@id": mainEntityId } : undefined,
		primaryImageOfPage: image
			? {
					"@type": "ImageObject",
					url: image,
				}
			: undefined,
	});
}

export function getBreadcrumbSchema(pageUrl: string, items: BreadcrumbItem[]) {
	return {
		"@type": "BreadcrumbList",
		"@id": `${pageUrl}#breadcrumb`,
		itemListElement: items.map((entry, index) =>
			compactSchema({
				"@type": "ListItem",
				position: index + 1,
				name: entry.name,
				item: entry.item ? absoluteUrl(entry.item) : undefined,
			}),
		),
	};
}

export function getItemListSchema(id: string, items: ItemListEntry[]) {
	return {
		"@type": "ItemList",
		"@id": id,
		itemListOrder: "https://schema.org/ItemListUnordered",
		numberOfItems: items.length,
		itemListElement: items.map((entry, index) => ({
			"@type": "ListItem",
			position: index + 1,
			url: absoluteUrl(entry.url),
			name: entry.name,
		})),
	};
}

export function buildSchemaGraph(...parts: Array<SchemaObject | SchemaObject[] | undefined>) {
	return parts.flatMap((part) => {
		if (!part) {
			return [];
		}

		return Array.isArray(part) ? part : [part];
	});
}
