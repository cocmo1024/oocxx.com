# Project Field Notes

Project Field Notes is an independent notebook of anonymized technical postmortems, built with Hugo and the vendored PaperMod theme.

## Scripts

- `npm run dev` starts a local Hugo server.
- `npm run build` builds the static site into `dist`.
- `npm run check` runs the content audit, production build, generated SEO/link audit, and Wrangler dry run.
- `npm run deploy` deploys the built site to Cloudflare Workers.

## Content

Posts live in `content/posts`.

Create a draft with:

```sh
npm run new:post -- posts/my-first-note.md
```

Add a short description, write the post, then set `draft: false` when it is ready. The home page and Writing page show posts newest first; Archive groups them by year and month.

Use `categories` for broad sections, `tags` for specific subjects, and `series` for posts that should be read together. Related writing prioritizes series, then categories and tags.

## Social sharing

Sharing follows one site-wide rule:

- A post with `cover.image` or `images` in its front matter uses that image.
- A post without an image falls back to the shared image configured in `params.images`.
- Do not generate article-specific social cards solely for sharing.

Use `social_image_alt` only when an article image needs a more specific accessible description.

## Advertising

Advertising slots are configured under `params.ads` in `hugo.yaml`. The site includes separate placements for the home feed, section feeds, taxonomy pages, Archive, and the top and bottom of posts. Add an AdSense client and slot IDs to serve live ads; placeholders remain hidden until then.

The theme is vendored under `themes/PaperMod` so deployment does not depend on Git submodule initialization.
