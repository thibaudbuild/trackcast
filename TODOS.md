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

## Shipped (2026-05-09)

- [x] **Live-view destination redesign** — pill toggle replaced with a single ambient label ("→ Private" / "→ Public · next broadcast"). Click flips between the two; auto-reverts to Private on Stop. No green dots, no dropdown, no confirmation modal.
- [x] **Settings channel section unified** — Priv/Pub pill toggle replaced with a single "Channel" section containing Private and Public sub-rows, both always visible, with a dim tip line explaining the asymmetry. Detect/test buttons hidden in the locked/verified state.
- [x] **MainView export removed** — redundant with History tab. Share icon moved to the right side in live state, sitting alongside the runtime.
- [x] **History page polish** — three sort modes collapsed to two ("By date" / "A–Z"); deduplicated day headers; per-day fold/unfold with set count; expand caret on each row; rename moved from name-click to dedicated pencil icon (resolves click conflict); humanized dates (Today/Yesterday/...); icon-consistent action buttons; better empty state copy.
- [x] **Setup draft persistence (TODO 9 / ISSUE-001)** — `<Settings>` now stays mounted across tab switches in `App.jsx`; hidden via `display:none` when on Live or History. Drafts survive a Live/Display detour without forcing the wizard back on.
- [x] **Live-tab setup banner (TODO 10 / ISSUE-002)** — clickable inline banner above the controls bar shows "Finish Setup to start broadcasting →" when the minimum (token + DJ software + private channel + Traktor helper if applicable) isn't met. Click switches to Setup. No tooltip pattern, in line with the no-tooltips preference.
- [x] **Private channel marked as required** — small "required" tag next to the Private slot label in Settings, so users understand Private is the mandatory minimum and Public is optional.

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

## 7b. Contact section polish (site)

**What:** The landing page contact section needs work. Current state is placeholder-level. Replace with either a working contact form (e.g. Formspree/Formspark, no backend needed) or accurate direct links (email, Telegram, socials). Also consider adding a shortcut to contact/support from within the desktop app itself (e.g. Help menu or Settings footer linking to the site contact page or opening a direct channel).

**Why:** A landing page with a broken or vague contact section erodes trust. DJs evaluating the tool want to know there's a human behind it. An in-app shortcut reduces friction for users who hit a wall and need help.

**Depends on:** Nothing -- can be done independently.

---

## 8. History page — deferred polish

Three items left over from the 2026-05-09 History pass that didn't make sense to ship until the data argues for them.

- **Search** — matters once a DJ has 50+ saved sets. Premature to add now.
- **Total stats footer** — e.g. "12 sets · 247 tracks". Cute, not load-bearing.
- **Inline-expand vs side-panel** — current inline-expand pushes content down for long sets. Switch to a side panel only if real users complain about a 100-track set being unwieldy.

---

## 9. Bare Setup tab loses unsaved input on tab switch

Surfaced by /qa on 2026-05-09. With the onboarding wizard paused (TODO 0 / shipped 2026-05-08), new users land directly on the Setup tab. Typing a bot token / channel and switching to Live before pressing Save wipes the draft, because `<Settings>` is conditionally mounted in `App.jsx:397-409` and re-initializes from saved `config` on remount.

**Resolution path:**
- Re-enabling the wizard fixes this for the first-run case (the wizard owns the draft).
- If the wizard is permanently gone, lift the Setup draft into `App.jsx` or persist to `localStorage` in `Settings.jsx`. Don't bother fixing locally until that direction is decided.

**Severity:** medium — only bites users who explore tabs before saving; doesn't affect anyone who follows the wizard flow.

**Evidence:** `.gstack/qa-reports/qa-report-trackcast-app-2026-05-09.md` (ISSUE-001).

---

## 10. Disabled Live-tab buttons offer no path forward

Surfaced by /qa on 2026-05-09. On Live, `Connect` and `▶ Start broadcasting` are disabled until Setup is saved, but neither has a `title`, `aria-label`, or inline hint. `Share channel` already has `title="Set up a public channel to share"` — pattern is half-applied. User dislikes hover tooltips, so the fix should either (a) leave the buttons enabled and surface a one-shot inline message on click ("Save your bot token in Setup first"), or (b) replace the disabled state with a subtle prompt that routes to Setup. Don't add tooltips.

**Severity:** medium — first 30 seconds of new-user experience.

**Evidence:** `.gstack/qa-reports/qa-report-trackcast-app-2026-05-09.md` (ISSUE-002).

---

## 11. "With set name" template lets you save with empty Set Name — won't fix (by design)

Surfaced by /qa on 2026-05-09. On Display, picking the **With set name** template while leaving **Set name** blank produces a Telegram message like `🎵  · Klaven — Why They Hide Their Bodies` (leading separator, double space).

**Decision (2026-05-09):** Closed as won't-fix. By design, any template can save with whatever the user has typed (or not typed) — adding per-template validation contradicts the "templates are free-form" intent. If a DJ doesn't fill set name, the rendered line being slightly off is on them. See TODO 13 — the broader question is whether the template feature itself earns its keep.

**Evidence:** `.gstack/qa-reports/qa-report-trackcast-app-2026-05-09.md` (ISSUE-004).

---

## 14. Convert remaining hard-coded font-sizes to type-scale variables

**What:** ~30 selectors in `packages/app/src/styles.css` still use literal `font-size: 11px / 12px / 13px` instead of the type-scale variables (`--fs-tab`, `--fs-body`, `--fs-data`, `--fs-data-sm`). They're at-spec today, but a future global bump via `:root` won't reach them — they need a manual edit each time.

**Affected areas (not exhaustive):** set-list rows (artist/title), channel-detect items, settings preview, settings save row, history day items, wizard step body, destination meta variants, plus a few one-offs.

**Why:** The type-scale CSS variables shipped 2026-05-09 (DESIGN.md update). The first sweep covered the elements that needed visible bumps + the most user-visible body/input/button selectors. The leftover literals are technically correct but defeat the "bump in one place" benefit going forward.

**Pros:** Future type-scale tuning becomes a one-line `:root` change for everything. Zero behavior change today.

**Cons:** ~30 mechanical edits with low risk; need to map each selector to the right role (some are ambiguous between `--fs-data` and `--fs-data-sm`, or `--fs-body` vs `--fs-tab`).

**Depends on:** Nothing. Mechanical sweep, ~5–10 min.

---

## 13. Reconsider templates feature

**What:** The Display tab offers four template presets (Default, With set name, Minimal, Custom) for the Telegram broadcast line. Question whether this configuration surface earns its keep, or whether a single editable string with `{artist}` / `{title}` / `{set_name}` tokens (no presets) would be just as good.

**Why:** During the 2026-05-09 review the feature's purpose felt unclear. Most DJs probably never change the default. The presets add UI weight and the "With set name" preset surfaced an empty-state quirk (TODO 11). If real testers ignore the presets, simplification is the right call.

**Decision path:**
- (a) Keep as-is.
- (b) Reduce to 1–2 presets + free-text custom.
- (c) Drop presets; one editable string with token chips, that's it.

**Depends on:** Tester feedback. Not an MVP problem — revisit after first round of testers tells us how they actually use it.

---

## 12. Theme toggle barely lightens the UI

Surfaced by /qa on 2026-05-09. The "Toggle theme" button flips `documentElement.dataset.theme` between night and day, but the day theme is functionally another dark variant — only the top nav lightens. Could be intentional (two warm/cool dark modes for DJ environments), in which case the control should be relabeled. Otherwise, finish the day theme.

**Severity:** low — cosmetic, doesn't break anything.

**Evidence:** `.gstack/qa-reports/qa-report-trackcast-app-2026-05-09.md` (ISSUE-003).

---

## 15. Logo rework — replace amber waveform bars with lowercase Geist "t" + green dot

**What:** Replace the current "five amber waveform bars + green dot" mark with a lowercase amber `t` set in **Geist Medium**, on a sharp 6px-radius warm-black tile (`#0A0908`), with a solid green `#22C55E` dot at the tittle-of-i position (above-right of the t crossbar). Variant F from `~/.gstack/projects/thibaudbuild-trackcast/designs/logo-icon-20260509/board.html`.

**Why:** Current waveform bars are a generic "audio app" signifier — overlaps visually with Spotify, Apple Podcasts, system EQ icons. Doesn't differentiate at dock size. The lowercase t monogram (a) makes the icon wear the product's name, (b) preserves the green broadcast dot which is the only distinctive element of the current mark, (c) doesn't collide with Traktor (capital, italicized, blocky) since ours is lowercase + tile-housed.

**Decision recap (design-shotgun 2026-05-10):** Geist Medium beat IBM Plex Mono for the icon. Sharp 6px tile beat bare-on-warm-black. Solid dot beat glow halo.

**DESIGN.md tension to resolve:** DESIGN.md says "monospace IS the identity" but Geist won the icon comparison. Cleanest resolution: **Geist for the brand mark + wordmark, IBM Plex Mono stays for app UI.** Many brands run a wordmark font separate from a UI font (Linear, Vercel). Update DESIGN.md to reflect this split before regenerating assets.

**Asset replacement list:**
- `assets/brand/logo-mark.png` — bare mark (just t + dot, no tile) for use in wordmark lockups
- `assets/brand/logo.png` — full app icon (t + dot on 6px tile)
- `assets/brand/logo-lockup-on-dark.png` — bare mark + Geist wordmark
- `assets/brand/logo-lockup-on-light.png` — bare mark + Geist wordmark
- `assets/brand/wordmark-geist-medium.svg` — already correct, keep as-is
- New: `assets/brand/logo-mark.svg` — vector source-of-truth for all PNG exports
- `apps/mac/icons/*` — Tauri Mac icon set (regenerate from `logo.png`)
- `apps/windows/icons/*` — Tauri Windows icon set
- `site/apple-touch-icon.png` and any favicons in `site/`

**Pros:**
- Distinctive at dock size (current bars blur into other audio apps)
- Wears the product's name, not just its category
- Preserves the green-dot "alive" signal
- The existing `wordmark-geist-medium.svg` is now the correct file by accident

**Cons:**
- Asset regeneration touches both Tauri builds + the site
- Requires updating DESIGN.md to acknowledge the Geist/Plex split
- A future taste shift back to monospace would mean redoing this

**Decision artifacts:**
- Comparison board: `~/.gstack/projects/thibaudbuild-trackcast/designs/logo-icon-20260509/board.html`
- Approved spec: `~/.gstack/projects/thibaudbuild-trackcast/designs/logo-icon-20260509/approved.json`

**Depends on:** Nothing technical. Deferred post-MVP — purely a polish + branding pass once core product stabilizes.
