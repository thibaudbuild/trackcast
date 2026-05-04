# TrackCast

Broadcast your DJ set live to Telegram and save a clean set history.

## Repository Layout

```txt
apps/
  mac/        Tauri shell, macOS sidecars, icons, and build config
  windows/    Tauri shell, Windows sidecars, icons, and build config
packages/
  app/        Shared React frontend used by both desktop apps
site/         Static landing page and onboarding guide
assets/
  brand/      Logo, wordmark, and web fonts used by the site
docs/         Product notes, setup notes, and archived explorations
```

The daily app work happens in `packages/app`. Platform-specific build work
happens in `apps/mac` or `apps/windows`.

## Common Commands

```bash
npm install
npm run dev:mac
npm run build:mac
npm run build:windows
npm run site
```

Use `npm run vite:mac` only when you want the frontend dev server without the
Tauri shell.

The site is served from the repository root at:

```txt
http://127.0.0.1:8787/site/
```

## Releases

Generated installers and archives should not be committed to the repository.
Publish macOS and Windows builds through GitHub Releases instead.
