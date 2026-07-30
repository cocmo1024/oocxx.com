import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contentDir = path.join(root, "content");

function walk(dir) {
	if (!fs.existsSync(dir)) return [];

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
		if (field) data[field[1]] = field[2].replace(/^['"]|['"]$/g, "");
	}

	return {
		data,
		body: text.slice(match[0].length),
	};
}

function countReadableUnits(text) {
	const latinWords = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
	const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
	return latinWords + Math.round(cjkChars / 2);
}

const files = walk(contentDir).filter(
	(file) =>
		file.includes(`${path.sep}posts${path.sep}`) &&
		!["index.md", "_index.md"].includes(path.basename(file).toLowerCase()),
);
const blockers = [];
const warnings = [];

for (const file of files) {
	const rel = path.relative(root, file).replaceAll(path.sep, "/");
	const text = fs.readFileSync(file, "utf8");
	const { data, body } = readFrontmatter(text);
	const units = countReadableUnits(body);
	const h2Count = (body.match(/^##\s+/gm) ?? []).length;

	for (const key of ["title", "description", "summary", "date", "content_language"]) {
		if (!data[key]) blockers.push(`${rel}: missing ${key}`);
	}

	if (data.title && data.title.length > 34) warnings.push(`${rel}: title is long (${data.title.length})`);
	if (data.description && (data.description.length < 24 || data.description.length > 100)) {
		warnings.push(`${rel}: description length is ${data.description.length}`);
	}
	if (units < 240) warnings.push(`${rel}: body is short (${units} readable units)`);
	if (h2Count < 2) warnings.push(`${rel}: fewer than 2 H2 sections`);
}

console.log(`Content audit scanned ${files.length} posts.`);

if (warnings.length > 0) {
	console.log(`\nWarnings (${warnings.length}):`);
	for (const warning of warnings) console.log(`- ${warning}`);
}

if (blockers.length > 0) {
	console.error(`\nBlockers (${blockers.length}):`);
	for (const blocker of blockers) console.error(`- ${blocker}`);
	process.exit(1);
}

console.log("No content quality blockers found.");
