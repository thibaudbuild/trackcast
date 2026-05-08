# Repository Structure

TrackCast is organized as a small monorepo.

## Why `apps/mac` and `apps/windows`

Both folders are desktop builds, but the platform names make the repo easier to
scan. Someone looking for macOS signing, sidecars, icons, or bundle config goes
straight to `apps/mac`. Someone looking for the Windows installer path goes to
`apps/windows`.

## Why `packages/app`

The React UI should not be copied twice. Both desktop apps point Vite at the
same shared app package:

```txt
packages/app
```

That keeps product UI, copy, settings, history, and live behavior aligned across
platforms.

## Why `site`

The landing page is its own product surface. It should be easy to work on,
preview, and deploy without opening the desktop app folders.

The site is fully self-contained: HTML, CSS, and brand assets all live under
`site/`. It deploys to https://trackcast.xyz automatically on every push to
`main` that touches `site/`, via `.github/workflows/deploy-site.yml` (GitHub
Pages). The custom domain is pinned by `site/CNAME`.

## Why `docs`

`docs` keeps repository documentation that is useful to anyone reading the
project (structure notes, build guides, changelogs). Personal notes and
working drafts stay local only and are not committed.

## Builds

Generated outputs are ignored:

- `dist`
- `node_modules`
- `src-tauri/target`
- `.dmg`, `.msi`, `.exe`, `.app`

Publish installable builds through GitHub Releases.
