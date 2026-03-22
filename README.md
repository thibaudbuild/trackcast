# TrackCast

Broadcast your DJ set live + save your tracklist automatically.

## Setup on macOS

### 1. Install prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Restart your terminal, then verify
rustc --version

# Install Node.js (if not already installed)
# Download from https://nodejs.org or:
brew install node
```

### 2. Download Unbox binary

Go to https://github.com/erikrichardlarson/unbox/releases and download the macOS binary.

Rename it based on your Mac's chip:
- Apple Silicon (M1/M2/M3): `unbox-aarch64-apple-darwin`
- Intel: `unbox-x86_64-apple-darwin`

Place it in `src-tauri/binaries/` and make it executable:

```bash
chmod +x src-tauri/binaries/unbox-*
```

### 3. Install dependencies and run

```bash
# Install Node dependencies
npm install

# Run in dev mode
cargo tauri dev
```

### 4. Build for distribution

```bash
cargo tauri build
```

The `.dmg` will be in `src-tauri/target/release/bundle/dmg/`.

## Setup on Windows (HP Victus)

### 1. Install prerequisites

- Install Node.js LTS
- Install Rust (MSVC toolchain): https://rustup.rs
- Install Visual Studio C++ Build Tools (Desktop development with C++)

### 2. Download Unbox Windows binary

Go to https://github.com/erikrichardlarson/unbox/releases and download:

- `unbox-x86_64-pc-windows-msvc.exe` (Victus Intel/AMD)

Place it in:

- `src-tauri/binaries/unbox-x86_64-pc-windows-msvc.exe`

### 3. Install dependencies and run

```bash
npm install
npm run tauri dev
```

### 4. Build installer

```bash
npm run tauri build
```

Installers are generated in:

- `src-tauri/target/release/bundle/msi/`
- `src-tauri/target/release/bundle/nsis/`

## Project structure

```
trackcast/
├── src/                          # React frontend
│   ├── App.jsx                   # Main app (routing, state)
│   ├── styles.css                # Dark theme CSS
│   └── components/
│       ├── Onboarding.jsx        # First-launch setup flow
│       ├── MainView.jsx          # Now playing + history + controls
│       └── Settings.jsx          # Config editor
├── src-tauri/                    # Rust backend (Tauri)
│   ├── src/
│   │   ├── lib.rs                # App setup + Tauri commands
│   │   ├── main.rs               # Entry point
│   │   ├── unbox.rs              # Unbox sidecar + WebSocket listener
│   │   ├── telegram.rs           # Telegram Bot API client
│   │   ├── history.rs            # Set history + export
│   │   └── state.rs              # App state + config persistence
│   ├── binaries/                 # Unbox sidecar binary (you add this)
│   ├── tauri.conf.json           # Tauri config
│   └── Cargo.toml                # Rust dependencies
├── package.json
└── vite.config.js
```
