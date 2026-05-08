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

## 6. Generate visual mockups for wizard, QR, and badges (superseded)

**Status:** Wizard, QR, and badges are now implemented. Visual mockups are no longer needed for initial build — but could still be useful for design iteration if the shipped UI needs polish.

**What:** Run the gstack designer (`$D variants`) to generate visual mockups of the onboarding wizard, QR code placement on the Live tab, and badge styling. Requires setting up the OpenAI API key first (`$D setup`).

**Why:** The design review (D1-D9) defined layout, placement, colors, and states in text. Visual mockups let you see the actual design before building it. Building UI from mockups is faster and more accurate than building from text descriptions.

**Pros:**
- See the wizard card layout before writing any code
- Validate that QR placement below controls looks right visually
- Catch design issues before they become code issues

**Cons:**
- Requires OpenAI API key (cost)
- Mockup generation takes a few minutes per variant set
- Mockups are aspirational, actual implementation may differ

**Context:** Design review ran without mockups because the OpenAI API key was not configured. All 7 review passes completed with text-only specifications. The design decisions (D1-D9) are sufficient to build from, but mockups would provide additional visual confidence.

**Depends on:** OpenAI API key must be configured (`~/.claude/skills/gstack/design/dist/design setup`).
