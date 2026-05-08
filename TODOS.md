# TODOS

Deferred items from /plan-eng-review on 2026-05-07.
Branch: feat/telegram-public-private (merged to main 2026-05-08)

## Shipped (2026-05-08)

- [x] Onboarding wizard (3-step: token → channel → DJ software + summary)
- [x] QR code component for public channels (with empty state)
- [x] DJ software badge pills (verified/supported/beta) in wizard + Settings
- [x] Landing page refresh with "How it works" section
- [x] README with install instructions + supported software table
- [x] GitHub issue template for DJ software compatibility reports
- [x] Landing page live at https://trackcast.xyz (GitHub Pages, auto-deploy from `site/` on push to main)
- [x] Brand assets moved to repo root (`assets/brand/`) — single source of truth, fixes desktop CI build path
- [x] Live-view QR replaced with share-icon launcher → `https://trackcast.xyz/@<username>` in OS browser
- [x] Onboarding wizard paused (gated off in `App.jsx`, files preserved for re-enable later)

## Shipped (branch: feat/start-button-destination)

- [x] **Live-view destination redesign** — pill toggle replaced with a single ambient label ("→ Private" / "→ Public · next broadcast"). Click flips between the two; auto-reverts to Private on Stop. No green dots, no dropdown, no confirmation modal. Verification dot moved out of the live view.
- [x] **Settings channel section unified** — Priv/Pub pill toggle replaced with a single "Channel" section containing Private and Public sub-rows side-by-side (vertically stacked, both visible at all times). Includes a dim tip line: "Private goes to your trusted listeners — and it's the safe place to test. Public is what the crowd sees."
- [x] Dead `.channel-pill*` CSS removed.
- [x] `showPublicConfirm` modal flow removed (was interrupting Start).

---

## 1. Settings.jsx refactor to share components with wizard

**What:** After the wizard ships and stabilizes, extract shared UI components (token input + verify, channel detect + test, DJ software selector with badges) from both the wizard and Settings.jsx into reusable modules.

**Why:** Right now the wizard will duplicate some UI patterns from Settings.jsx. Once both are working, extracting shared components reduces maintenance -- a bug fix in one place fixes both. DRY matters here because token verification and channel detection are the same logic in both places.

**Pros:**
- Single source of truth for token/channel/software UI
- Bug fixes propagate to both wizard and Settings
- Easier to add new features (e.g., new DJ software) in one place

**Cons:**
- Refactoring a 895-line file is risky -- can introduce regressions
- Wizard and Settings may diverge in UX needs over time (wizard is linear, Settings is random-access)
- Not blocking any user-facing feature

**Context:** Decision D8 from eng review chose "wizard first, refactor later" because Settings.jsx has ~30 interleaved useState hooks with deeply coupled state (fingerprinting, edit-lock, per-slot test gates). Extracting components before the wizard exists would mean refactoring against a moving target. Build the wizard with its own simple state first, then identify the real shared surface area.

**Depends on:** Wizard implementation must be complete and stable first.

---

## 2. Token encryption / keychain storage

**What:** The Telegram bot token is stored in plaintext in the JSON config file on disk. Move it to the OS keychain (macOS Keychain, Windows Credential Manager) or encrypt it at rest.

**Why:** Any process on the user's machine can read the token from the config file. A compromised token lets an attacker send messages as the DJ's bot. For an open source project where users trust you with their credentials, this matters.

**Pros:**
- Tokens protected by OS-level encryption
- Meets basic security expectations for credential storage
- Tauri has keychain plugins available

**Cons:**
- Adds a dependency (tauri-plugin-os or similar keychain integration)
- Increases complexity of config load/save (async keychain access)
- Not a blocker for DJ friends testing in trusted environments

**Context:** Outside voice flagged this during eng review. For v1 with trusted DJ friends, plaintext is acceptable. Before wider open source distribution, this should be addressed. The token grants sendMessage permission to the bot's channels.

**Depends on:** Nothing -- can be done independently.

---

## 3. Windows build validation before open source

**What:** Verify the Windows build actually works end-to-end (install MSI, launch app, complete wizard, broadcast a track). The Mac and Windows Rust backends have diverged -- Windows is missing `tracking_started_at` and has different `save_config` behavior in `lib.rs`.

**Why:** The GitHub Actions workflow builds both DMG and MSI on push to main. If a Windows user downloads the MSI and it crashes, that's a terrible first impression. Better to validate or explicitly label "macOS only" before open sourcing.

**Pros:**
- Prevents broken first impressions for Windows users
- Identifies platform parity gaps before they become bug reports
- Can be done by a Windows-owning DJ friend

**Cons:**
- Requires access to a Windows machine
- May uncover significant porting work
- Blocks Windows distribution but not macOS launch

**Context:** The design doc already recommends "ship macOS now, Windows when a tester needs it." This TODO is about validating that recommendation -- if Windows turns out to work fine, ship both. If not, disable the Windows artifact in CI to avoid confusion.

**Depends on:** Nothing -- can be done independently, but lower priority than wizard.

---

## 4. detect_channels guidance for new bots (partially addressed)

**Status:** Wizard Step 2 now has a manual paste fallback and a hint ("Add your bot to a Telegram channel or group, then detect it below"). The detailed "why detection might fail" copy is still TODO.

**What:** Add UI guidance in the wizard's Step 2 explaining that brand-new bots may return no channels from detect_channels because Telegram's getUpdates API only retains ~100 updates for ~24 hours. The bot needs to receive at least one event in the channel (e.g., being added as admin) before detection works.

**Why:** A DJ creates a fresh bot, adds it to a channel, clicks "Detect" immediately, and gets nothing. The current fallback is a manual paste field, but without an explanation, the DJ thinks something is broken.

**Pros:**
- Reduces support questions from first-time users
- Sets correct expectations about the detection flow
- Small copy change, minimal code

**Cons:**
- More text in the wizard (risk of overwhelming a beginner)
- The timing issue is a Telegram API limitation, not a bug

**Context:** Outside voice identified this during eng review. The manual paste fallback already handles the failure case functionally -- this is about the UX messaging around it. Could be as simple as "Just added the bot? Click Detect. If nothing shows up, paste your channel's @username below."

**Depends on:** Wizard implementation (Step 2 must exist first).

---

## 5. Invite link support for QR codes

**What:** Support Telegram invite links (t.me/+abcdef123) as a QR code source, not just public @usernames. This lets DJs with private channels generate QR codes by pasting their channel's invite link.

**Why:** The current QR implementation (per D9) derives the URL from public_chat_id when it starts with @. Private channels with only a numeric ID have no scannable URL. Supporting invite links closes this gap without requiring a public channel.

**Pros:**
- QR codes work for both public and private channels
- No Rust changes needed -- invite link is just a string stored in config
- Enables the venue QR flow for DJs who prefer private channels

**Cons:**
- Needs a new config field (invite_link or similar) in state.rs
- Invite links can be revoked, making printed QR codes dead links
- Adds complexity to the "which URL do we encode?" logic

**Context:** D9 chose to derive QR URLs from existing fields to avoid Rust changes for v1. This TODO extends that with invite link support for v1.1. The design doc's "Private channel constraint" section describes the prompt that appears when no shareable link exists -- this TODO replaces that prompt with actual functionality.

**Depends on:** QR code implementation must ship first.

---

## 7. Public share page at `/@<username>` (site)

**What:** Site agent ships a public web page at `https://trackcast.xyz/@<username>` that the desktop app links to from the share icon in the controls bar. The page renders a fullscreen-friendly QR code for `t.me/<username>`, the channel handle, and works on phone, tablet, venue screen, and prints cleanly from the browser.

**Why:** A QR on the DJ's laptop is useless to the crowd. The DJ needs the QR on a *different* surface — phone in hand, tablet on the booth, venue display, or printed poster. A single public URL covers all of those: open it on whatever screen the crowd will see, or AirDrop / save-image / ⌘P from there. Reusing the browser's native primitives (copy URL, save image, print) means we don't rebuild any of that inside TrackCast.

**App side (shipped 2026-05-08):** QR icon in the controls bar opens `https://trackcast.xyz/@<username>` via the OS browser. Disabled when no public channel set. Big in-app QR component removed; `qrcode.react` dep dropped.

**Site contract:**
- Route: `/@<username>` — `@` matches Telegram convention exactly
- Renders: large QR encoding `https://t.me/<username>`, the `@<username>` handle, dark background matching the brand
- Mobile-friendly (DJ may load it on a phone) and prints cleanly (⌘P → poster)
- 404 / friendly error if the username is malformed; no need to validate that the channel actually exists (Telegram handles that on tap)
- GitHub Pages constraint: routing for `/@<username>` paths needs to work with the static-site setup (likely a `404.html` redirect trick or per-username generated pages)

**Pros:**
- One artifact covers phone, tablet, venue screen, print
- No new dependencies in the app (no QR library, no image generation)
- Plug-and-play once the site ships — no app changes needed beyond domain swap

**Cons:**
- Until the site ships, the icon links to a 404 (acceptable: nothing was shareable before either)
- Public web page means anyone with the username can hit it (same exposure as the public Telegram channel itself)

**Depends on:** Site agent shipping the route. Branding/typography should match the existing landing page.

---

## 8. History page polish (in progress, branch: feat/start-button-destination)

Design review of `HistoryView.jsx` identified seven legibility/discoverability issues. Implementing in order. Each is a small, isolated change.

### 1. Deduplicated date headers in flat sort
**What:** In `newest` (Latest) mode, the primary label is the date — so 4 sets played the same evening repeat the date 4 times. Show the date once at the top of each day's group, then implicit for following sets. Mac Messages-style implicit grouping.

**Knock-on:** This collapses `Latest` and `Grouped` into the same display, just always-expanded. So the three sort modes (`Latest` / `Grouped` / `Name`) reduce to two: **By date** (deduplicated headers, newest first) and **A–Z** (alphabetical by custom name).

### 2. Expand caret on each row
**What:** Whole row is clickable to expand the track list, but there's no visual cue. Add a small ▾ caret on the right side of the row (next to the action buttons), rotated 180° when open. Resolves discoverability.

### 3. Rename: pencil icon + fix click conflict
**What:** The set name is a button with `title="Rename set"` — invisible affordance. Two changes:
- Pencil icon ✎ next to the name, visible on row hover
- Clicking the name should NOT enter rename mode (footgun against expand). Instead: rename triggered by the pencil icon. Name click does the same as row click (expand).

### 4. Humanize date format
**What:** Replace ISO `2026-05-08` with human strings: "Today" / "Yesterday" / "May 8, 2026". Times stay in HH:MM mono.

### 5. Sort label clarity
**What:** With #1 collapsing to two modes, the labels become **By date** and **A–Z**. The custom dropdown UI stays (no need to change).

### 6. Trash vs export visual consistency
**What:** `export` is a text button, delete is an icon. Make both icons (with tooltips), or both labels. Going with both as text labels — clearer, especially for the destructive delete.

### 7. Empty state copy
**What:** "No saved sets yet" → "No sets yet — start broadcasting from the Live tab to save your first set." Gives a next step.

### Deferred (not now)
- Search (matters at 50+ sets)
- Total stats footer ("12 sets · 247 tracks")
- Inline-expand vs side-panel for very long sets
