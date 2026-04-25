import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const blogDir = path.join(root, 'src', 'content', 'blog');

const blockerPatterns = [
	{ pattern: /high-value traffic/i, reason: 'traffic-first wording' },
	{ pattern: /traffic page/i, reason: 'search-engine-first page framing' },
	{ pattern: /created primarily to attract visits/i, reason: 'explicit search-engine-first framing' },
	{ pattern: /keyword-only/i, reason: 'thin keyword-only framing' },
	{ pattern: /SEO hack/i, reason: 'shortcut-focused SEO framing' },
];

function walk(dir) {
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((entry) => {
			const filePath = path.join(dir, entry.name);
			if (entry.isDirectory()) return walk(filePath);
			return /\.(md|mdx)$/.test(entry.name) ? [filePath] : [];
		});
}

function readFrontmatter(text) {
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return { data: {}, body: text };

	const data = {};
	for (const line of match[1].split(/\r?\n/)) {
		const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (field) data[field[1]] = field[2].replace(/^['"]|['"]$/g, '');
	}

	return {
		data,
		body: text.slice(match[0].length),
	};
}

function countWords(text) {
	return (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
}

const files = walk(blogDir);
const blockers = [];
const warnings = [];

for (const file of files) {
	const rel = path.relative(root, file).replaceAll(path.sep, '/');
	const text = fs.readFileSync(file, 'utf8');
	const { data, body } = readFrontmatter(text);
	const words = countWords(body);
	const h2Count = (body.match(/^##\s+/gm) ?? []).length;
	const internalLinks = (body.match(/\]\(\/blog\//g) ?? []).length;

	for (const key of ['title', 'description', 'pubDate', 'topic']) {
		if (!data[key]) blockers.push(`${rel}: missing ${key}`);
	}

	for (const { pattern, reason } of blockerPatterns) {
		if (pattern.test(text)) blockers.push(`${rel}: ${reason}`);
	}

	if (data.title && data.title.length > 90) warnings.push(`${rel}: title is long (${data.title.length})`);
	if (data.description && (data.description.length < 70 || data.description.length > 180)) {
		warnings.push(`${rel}: description length is ${data.description.length}`);
	}
	if (words < 500) blockers.push(`${rel}: body is too thin (${words} words)`);
	if (h2Count < 4) warnings.push(`${rel}: fewer than 4 H2 sections`);
	if (internalLinks < 2) warnings.push(`${rel}: fewer than 2 internal blog links`);
}

console.log(`Content audit scanned ${files.length} blog posts.`);

if (warnings.length > 0) {
	console.log(`\nWarnings (${warnings.length}):`);
	for (const warning of warnings) console.log(`- ${warning}`);
}

if (blockers.length > 0) {
	console.error(`\nBlockers (${blockers.length}):`);
	for (const blocker of blockers) console.error(`- ${blocker}`);
	process.exit(1);
}

console.log('No content quality blockers found.');
