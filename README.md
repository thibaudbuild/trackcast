# TrackCast

Broadcast your DJ set live to Telegram and save a clean set history.

TrackCast reads the currently playing track from your DJ software, posts
real-time updates to a Telegram channel, and keeps a clean set history you
can export at the end of the night.

## Install

1. Download the latest `.dmg` from [GitHub Releases](https://github.com/thibaudbuild/trackcast/releases/latest)
2. Drag TrackCast to Applications
3. Open TrackCast — the onboarding wizard walks you through bot setup

**Requirements:** macOS 13+ (Apple Silicon). Windows build coming soon.

## Supported DJ Software

| Software | Status | Notes |
|----------|--------|-------|
| Rekordbox | Verified | Full support, real-time track detection |
| Traktor Pro 3/4 | Supported | Requires helper plugin install (guided in-app) |
| Serato DJ Pro | Supported | Track detection via history file |
| VirtualDJ | Beta | Basic functionality, report issues |
| Mixxx | Beta | Basic functionality, report issues |
| DJUCED | Beta | Basic functionality, report issues |
| djay Pro | Beta | Basic functionality, report issues |
| Denon DJ | Beta | Basic functionality, report issues |

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

## Development

```bash
npm install
npm run dev:mac        # Full Tauri dev (frontend + native shell)
npm run build:mac      # Production macOS build
npm run build:windows  # Production Windows build
npm run site           # Serve the landing page locally
```

Use `npm run vite:mac` only when you want the frontend dev server without the
Tauri shell.

The site is served from the repository root at `http://127.0.0.1:8787/site/`.

## Releases

Generated installers and archives should not be committed to the repository.
Publish macOS and Windows builds through GitHub Releases instead.

## Contributing

1. Fork the repo and create a feature branch
2. `npm install` and `npm run dev:mac` to get the dev environment running
3. Make your changes in `packages/app` (frontend) or `apps/mac` (native)
4. Open a PR with a clear description of what changed and why

For DJ software compatibility reports, use the [issue template](https://github.com/thibaudbuild/trackcast/issues/new?template=dj-software-report.yml).
