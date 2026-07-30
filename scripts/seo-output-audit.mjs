import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const siteOrigin = "https://oocxx.com";

if (!fs.existsSync(distDir)) {
	console.error("SEO audit blocker: dist/ does not exist. Run the production build first.");
	process.exit(1);
}

function walk(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const filePath = path.join(dir, entry.name);
		return entry.isDirectory() ? walk(filePath) : [filePath];
	});
}

function decodeEntities(value) {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function parseAttributes(tag) {
	const attributes = {};
	const source = tag.replace(/^<[^\s>]+\s*/u, "").replace(/>$/u, "");
	const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;

	for (const match of source.matchAll(pattern)) {
		attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
	}

	return attributes;
}

function tags(html, name) {
	const pattern = name === "*" ? /<[a-z][^>]*>/giu : new RegExp(`<${name}\\b[^>]*>`, "giu");
	return [...html.matchAll(pattern)].map((match) => ({
		raw: match[0],
		attributes: parseAttributes(match[0]),
	}));
}

function firstMeta(html, key, value) {
	return tags(html, "meta").find((tag) => tag.attributes[key]?.toLowerCase() === value.toLowerCase());
}

function firstLink(html, rel) {
	return tags(html, "link").find((tag) =>
		(tag.attributes.rel ?? "")
			.toLowerCase()
			.split(/\s+/u)
			.includes(rel.toLowerCase()),
	);
}

function outputURL(file) {
	const rel = path.relative(distDir, file).replaceAll(path.sep, "/");
	if (rel === "index.html") return `${siteOrigin}/`;
	if (rel.endsWith("/index.html")) {
		return new URL(`/${rel.slice(0, -"index.html".length)}`, siteOrigin).href;
	}
	return new URL(`/${rel}`, siteOrigin).href;
}

function fileForURL(url) {
	const parsed = new URL(url, siteOrigin);
	let pathname;

	try {
		pathname = decodeURIComponent(parsed.pathname);
	} catch {
		pathname = parsed.pathname;
	}

	if (pathname.endsWith("/")) return path.join(distDir, pathname.slice(1), "index.html");
	if (path.extname(pathname)) return path.join(distDir, pathname.slice(1));
	return path.join(distDir, pathname.slice(1), "index.html");
}

function structuredTypes(value, result = new Set()) {
	if (Array.isArray(value)) {
		for (const item of value) structuredTypes(item, result);
		return result;
	}

	if (!value || typeof value !== "object") return result;
	const type = value["@type"];
	if (Array.isArray(type)) type.forEach((item) => result.add(item));
	else if (typeof type === "string") result.add(type);
	for (const child of Object.values(value)) structuredTypes(child, result);
	return result;
}

const htmlFiles = walk(distDir).filter((file) => file.endsWith(".html"));
const pages = [];
const blockers = [];
const warnings = [];
const titleOwners = new Map();
const descriptionOwners = new Map();

for (const file of htmlFiles) {
	const html = fs.readFileSync(file, "utf8");
	const url = outputURL(file);
	const refresh = firstMeta(html, "http-equiv", "refresh");
	const isAlias = Boolean(refresh);
	const robots = firstMeta(html, "name", "robots")?.attributes.content?.toLowerCase() ?? "";
	const noIndex = robots.includes("noindex");
	const canonical = firstLink(html, "canonical")?.attributes.href;
	const title = decodeEntities(html.match(/<title>([\s\S]*?)<\/title>/iu)?.[1]?.trim() ?? "");
	const description = firstMeta(html, "name", "description")?.attributes.content?.trim() ?? "";
	const lang = tags(html, "html")[0]?.attributes.lang ?? "";
	const h1Count = (html.match(/<h1\b/giu) ?? []).length;
	const visible = html
		.replace(/<script\b[\s\S]*?<\/script>/giu, " ")
		.replace(/<style\b[\s\S]*?<\/style>/giu, " ")
		.replace(/<[^>]+>/gu, " ");
	const cjkCount = (visible.match(/[\u3400-\u9fff]/gu) ?? []).length;
	const jsonLdScripts = [...html.matchAll(/<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/giu)];
	const jsonLd = [];

	for (const [index, match] of jsonLdScripts.entries()) {
		try {
			jsonLd.push(JSON.parse(match[1]));
		} catch (error) {
			blockers.push(`${url}: JSON-LD block ${index + 1} is invalid (${error.message})`);
		}
	}

	const types = structuredTypes(jsonLd);
	const indexableCanonical = !isAlias && !noIndex && url !== `${siteOrigin}/404.html`;

	if (!isAlias) {
		if (!robots) blockers.push(`${url}: missing robots directive`);
		if (!canonical) blockers.push(`${url}: missing canonical URL`);
		if (canonical && (!canonical.startsWith(`${siteOrigin}/`) || canonical !== url)) {
			blockers.push(`${url}: canonical mismatch (${canonical})`);
		}
		if (!title) blockers.push(`${url}: missing title`);
		if (!description) blockers.push(`${url}: missing meta description`);
		if (!lang) blockers.push(`${url}: missing html lang`);
		if (indexableCanonical && h1Count !== 1) blockers.push(`${url}: expected exactly one H1, found ${h1Count}`);
		if (cjkCount > 100 && !lang.toLowerCase().startsWith("zh")) {
			blockers.push(`${url}: predominantly Chinese content is declared as ${lang}`);
		}

		for (const [property, label] of [
			["og:title", "Open Graph title"],
			["og:description", "Open Graph description"],
			["og:url", "Open Graph URL"],
			["og:image", "Open Graph image"],
		]) {
			if (!firstMeta(html, "property", property)?.attributes.content) {
				blockers.push(`${url}: missing ${label}`);
			}
		}

		for (const [name, label] of [
			["twitter:card", "Twitter card"],
			["twitter:title", "Twitter title"],
			["twitter:description", "Twitter description"],
			["twitter:image", "Twitter image"],
		]) {
			if (!firstMeta(html, "name", name)?.attributes.content) {
				blockers.push(`${url}: missing ${label}`);
			}
		}

		if (url === `${siteOrigin}/` && !types.has("WebSite")) {
			blockers.push(`${url}: missing WebSite structured data`);
		}
		if (url.includes("/posts/") && url !== `${siteOrigin}/posts/` && !types.has("BlogPosting")) {
			blockers.push(`${url}: missing BlogPosting structured data`);
		}
		if (url === `${siteOrigin}/about/` && !types.has("AboutPage")) {
			blockers.push(`${url}: missing AboutPage structured data`);
		}
	}

	if (indexableCanonical) {
		if (titleOwners.has(title)) blockers.push(`${url}: duplicate title also used by ${titleOwners.get(title)}`);
		else titleOwners.set(title, url);

		if (descriptionOwners.has(description)) {
			blockers.push(`${url}: duplicate description also used by ${descriptionOwners.get(description)}`);
		} else {
			descriptionOwners.set(description, url);
		}

		if (title.length > 65) warnings.push(`${url}: title is long (${title.length} characters)`);
		if (description.length < 45 || description.length > 170) {
			warnings.push(`${url}: description length is ${description.length}`);
		}
	}

	pages.push({ file, html, url, canonical, isAlias, noIndex, indexableCanonical });
}

const pageByURL = new Map(pages.map((page) => [page.url, page]));

for (const page of pages.filter((item) => !item.isAlias)) {
	for (const anchor of tags(page.html, "a")) {
		const href = anchor.attributes.href;
		if (!href || /^(mailto:|tel:|javascript:|data:)/iu.test(href)) continue;

		let target;
		try {
			target = new URL(href, page.canonical ?? page.url);
		} catch {
			blockers.push(`${page.url}: invalid link ${href}`);
			continue;
		}

		if (target.origin !== siteOrigin) continue;
		const targetFile = fileForURL(target);
		if (!fs.existsSync(targetFile)) {
			blockers.push(`${page.url}: broken internal link ${href}`);
			continue;
		}

		if (target.hash) {
			const targetPage = pageByURL.get(target.href.replace(target.hash, ""));
			if (!targetPage || !targetPage.file.endsWith(".html")) continue;
			let fragment = target.hash.slice(1);
			try {
				fragment = decodeURIComponent(fragment);
			} catch {
				// Keep the original fragment so the missing target is reported.
			}
			const targetIds = new Set(tags(targetPage.html, "*").map((tag) => tag.attributes.id).filter(Boolean));
			if (!targetIds.has(fragment)) blockers.push(`${page.url}: missing fragment target ${href}`);
		}
	}
}

const sitemapPath = path.join(distDir, "sitemap.xml");
if (!fs.existsSync(sitemapPath)) {
	blockers.push("Missing sitemap.xml");
} else {
	const sitemap = fs.readFileSync(sitemapPath, "utf8");
	const sitemapURLs = new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/gu)].map((match) => decodeEntities(match[1])));
	const expectedURLs = new Set(pages.filter((page) => page.indexableCanonical).map((page) => page.url));

	for (const url of expectedURLs) {
		if (!sitemapURLs.has(url)) blockers.push(`${url}: indexable canonical page is missing from sitemap`);
	}
	for (const url of sitemapURLs) {
		if (!expectedURLs.has(url)) blockers.push(`${url}: sitemap includes a non-indexable or non-canonical URL`);
	}
}

console.log(`SEO audit scanned ${pages.length} HTML files (${pages.filter((page) => page.indexableCanonical).length} indexable canonical pages).`);

if (warnings.length > 0) {
	console.log(`\nWarnings (${warnings.length}):`);
	for (const warning of warnings) console.log(`- ${warning}`);
}

if (blockers.length > 0) {
	console.error(`\nBlockers (${blockers.length}):`);
	for (const blocker of blockers) console.error(`- ${blocker}`);
	process.exit(1);
}

console.log("Titles, descriptions, canonicals, language, social metadata, structured data, sitemap, and internal links passed.");
