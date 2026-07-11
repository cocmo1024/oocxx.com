# OOCXX

OOCXX is a minimal personal blog built with Hugo and the vendored PaperMod theme.

## Scripts

- `npm run dev` starts a local Hugo server.
- `npm run build` builds the static site into `dist`.
- `npm run check` runs the content audit, Hugo production build, and Wrangler dry run.
- `npm run deploy` deploys the built site to Cloudflare Workers.

## Content

Posts live in `content/posts`.

Create a draft with:

```sh
npm run new:post -- posts/my-first-note.md
```

Add a short description, write the post, then set `draft: false` when it is ready. The home page and Writing page show posts newest first; Archive groups them by year and month.

The theme is vendored under `themes/PaperMod` so deployment does not depend on Git submodule initialization.
