# TrackCast macOS

This package owns the macOS Tauri shell and build configuration.

Shared UI source lives in:

```txt
../../packages/app
```

macOS-specific files live here:

```txt
src-tauri/
  binaries/
  icons/
  resources/
  tauri.conf.json
```

## Commands

```bash
npm run dev
npm run build
npm run tauri dev
npm run tauri build
```

From the repository root, use:

```bash
npm run dev:mac
npm run tauri:mac:build
```

The Vite output is generated in `apps/mac/dist` and is ignored by Git.
Release builds should be published through GitHub Releases.
