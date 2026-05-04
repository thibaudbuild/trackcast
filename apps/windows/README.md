# TrackCast Windows

This package owns the Windows Tauri shell and build configuration.

Shared UI source lives in:

```txt
../../packages/app
```

Windows-specific files live here:

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
npm run dev:windows
npm run tauri:windows:build
```

The Vite output is generated in `apps/windows/dist` and is ignored by Git.
Release builds should be published through GitHub Releases.
