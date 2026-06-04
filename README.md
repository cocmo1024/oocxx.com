# OOCXX

OOCXX is a minimal Astro personal blog deployed on Cloudflare Workers.

## Scripts

- `npm run dev` starts local development.
- `npm run build` builds the site.
- `npm run check` runs the production build, TypeScript, and a Wrangler dry run.
- `npm run audit:content` checks basic frontmatter and article structure.

## Content

Blog posts live in `src/content/blog`. The site intentionally keeps a small surface area:

- `/`
- `/blog/`
- `/about/`
- `/rss.xml`
- `/blog/[slug]/`
