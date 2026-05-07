# Design System -- TrackCast

## Product Context
- **What this is:** Desktop app for DJs to broadcast live sets to Telegram and save set history
- **Who it's for:** All DJs -- bedroom, club, radio, hobbyist
- **Space/industry:** DJ tools, music broadcasting
- **Project type:** Tauri desktop app (macOS + Windows)
- **Memorable thing:** "It just works" -- but with a techy identity that's distinctively TrackCast, not generic Apple-like

## Aesthetic Direction
- **Direction:** Refined Industrial -- analog warmth meets digital precision
- **Decoration level:** Minimal -- no gradients, no decorative elements. Subtle grain texture and glow reserved for "alive" states only
- **Mood:** Premium tool that chose to be technical. Not a hackathon prototype, not a design template. Confident, warm, precise.
- **Anti-patterns:** No Apple-like rounded everything (generic in the AI era). No purple gradients. No centered-everything layouts. No switching to sans-serif for "clean" -- the monospace IS the identity.

## Typography

**One family. Different weights. No font switching.**

- **Display/Hero:** IBM Plex Mono 600, 44px, letter-spacing: -1.5px -- artist name, hero moments. Large and present.
- **UI Labels:** IBM Plex Mono 500, 10-11px, uppercase, letter-spacing: 0.8px -- tabs, buttons, section headers
- **Body:** IBM Plex Mono 300, 13px -- settings descriptions, help text. Light weight for readability in longer text.
- **Data:** IBM Plex Mono 400, 11-12px, font-variant-numeric: tabular-nums -- timestamps, BPM, keys. Columns align.
- **Set list artist:** IBM Plex Mono 500, 13px -- slightly larger than title for scanning at speed
- **Set list title:** IBM Plex Mono 300, 12px -- secondary to artist
- **Loading:** Google Fonts / Bunny Fonts CDN: `IBM Plex Mono` weights 300, 400, 500, 600, 700

### Why IBM Plex Mono over JetBrains Mono
Same monospace identity, more refined execution. IBM Plex Mono is slightly wider, cleaner at small sizes, and has a better weight range (300-700 with real optical difference). JetBrains Mono is a developer's font; IBM Plex Mono is a designer's monospace. The character is similar but the polish is higher.

### Type Scale
| Role | Weight | Size | Spacing | Case |
|------|--------|------|---------|------|
| Display (artist) | 600 | 44px | -1.5px | Normal |
| Section title | 600 | 16px | -0.3px | Normal |
| Tab / Button | 500 | 10-11px | 0.8px | Uppercase |
| Body | 300 | 13px | 0.2px | Normal |
| Set list artist | 500 | 13px | 0.1px | Normal |
| Set list title | 300 | 12px | normal | Normal |
| Data (time, BPM) | 400 | 11-12px | normal | Normal |
| Eyebrow label | 500 | 10px | 0.8px | Uppercase |
| Tag / pill | 400 | 9px | 0.3px | Normal |

## Color

**Approach:** Restrained -- amber accent + warm neutrals. Color is rare and meaningful.

### Night Mode (default)
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | #0A0908 | Main background (warm black, not neutral) |
| `--bg-1` | #121110 | Surface (cards, settings rows, inputs) |
| `--bg-2` | #1A1918 | Elevated (hover states, active surfaces) |
| `--bg-3` | #222120 | Highest elevation (dropdowns, popovers) |
| `--amber` | #E88010 | Primary accent -- interactive elements, active tab, current track |
| `--amber-soft` | rgba(232,128,16,0.08) | Amber tint backgrounds (current row, active pill) |
| `--amber-border` | rgba(232,128,16,0.25) | Amber border for active pills |
| `--green` | #22C55E | Live/active states only (live dot, broadcast running, start button) |
| `--green-soft` | rgba(34,197,94,0.35) | Green glow for live dot |
| `--red` | #EF4444 | Stop/error/destructive |
| `--text` | #D8D4D0 | Primary text (warm off-white, like studio lighting) |
| `--text-mid` | #888888 | Secondary text (titles, descriptions) |
| `--text-dim` | #555555 | Tertiary text (timestamps, labels, placeholders) |
| `--border` | #2A2824 | Standard border (warm-tinted) |
| `--border-sub` | #1E1C1A | Subtle border (row dividers) |

### Day Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | #3A3A3A | Main background (warm gray, never white) |
| `--bg-1` | #464646 | Surface |
| `--bg-2` | #545454 | Elevated |
| `--bg-3` | #5E5E5E | Highest elevation |
| `--amber` | #F0940A | Slightly brighter amber for legibility on lighter backgrounds |
| `--green` | #2DD964 | Brighter green for day contrast |
| `--red` | #F05545 | Brighter red for day contrast |
| `--text` | #E8E8E8 | Primary text |
| `--text-mid` | #B0B0B0 | Secondary text |
| `--text-dim` | #8A8A8A | Tertiary text |
| `--border` | #5E5E5E | Standard border |
| `--border-sub` | #4A4A4A | Subtle border |

### Color Semantics
- **Amber:** Interactive elements (buttons, links, active states), configured/done indicators in settings, current track highlight
- **Green:** Reserved exclusively for "alive" states -- live dot, actively broadcasting, start broadcast button
- **Red:** Stop actions, errors, destructive operations
- **No other accent colors.** The palette is intentionally narrow.

## Spacing

**Base unit:** 8px
**Density:** Comfortable -- more breathing room than current, but stays data-dense where it counts

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight gaps (icon-to-text, dot-to-label) |
| `--space-2` | 8px | Standard gap (tag spacing, inline elements) |
| `--space-3` | 12px | Row padding, input padding |
| `--space-4` | 16px | Section internal padding |
| `--space-5` | 20px | Container padding (now-playing, settings) |
| `--space-6` | 24px | Between settings groups |
| `--space-7` | 32px | Between major sections |
| `--space-8` | 48px | Page-level vertical rhythm |

### Key spacing decisions
- **Set list rows:** 12px vertical padding (stays tight for data density)
- **Now-playing section:** 32px top padding, 28px bottom -- this is the hero moment, give it room
- **Settings rows:** 14px vertical padding, grouped with shared border
- **Section gaps:** 32px between major sections (tabs-to-content, controls-to-setlist)
- **Container padding:** 20px horizontal (left/right of content area)

## Layout
- **Approach:** Grid-disciplined, single column, vertically stacked
- **Max content width:** Window-bound (desktop app)
- **Now-playing as poster:** Artist name at 44px with generous vertical space. Treat the now-playing section like an album cover moment, not a data row.
- **Settings:** Grouped rows with shared borders (like iOS settings, but sharp corners)

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | 6px | Standard (buttons, inputs, cards, settings groups) |
| `--radius-sm` | 5px | Small (tags, metadata pills, inner elements) |
| `--radius-pill` | 9999px | Pills only (channel switcher, status dots) |

**Sharp, not round.** The 6px radius is technical and intentional. Not broken-looking (0px), not soft (12px+). This is a tool, not a toy.

## Texture
- **Grain:** CSS noise overlay at 2% opacity on all backgrounds. Not visible at first glance, but gives every surface material quality -- like matte paper or brushed metal.
- **Implementation:** SVG feTurbulence filter as pseudo-element `::before` on background containers

## Glow
- **Live dot only:** 3px box-shadow radius, 35% opacity, using `--green-soft`
- **Breathing animation:** 3s ease-in-out infinite, opacity 1.0 to 0.4
- **Broadcasting wash:** Barely-visible amber gradient at top of now-playing section when live: `linear-gradient(180deg, rgba(232,128,16,0.025) 0%, transparent 50%)`
- **Nothing else glows.** No input focus glow, no button glow. Glow = alive.

## Motion
- **Approach:** Minimal-functional. Smooth, not flashy.
- **Micro transitions (hover, focus):** 150ms ease-out
- **State changes (tab switch, toggle):** 250ms ease-out
- **Layout shifts (panel reveal, section expand):** 400ms cubic-bezier(0.16, 1, 0.3, 1)
- **No bounce, no spring physics, no parallax.** This is a utility, not a showcase.

## Key Interactive States

### Start Broadcast Button
- IBM Plex Mono 500, 11px
- Background: `--green` (#22C55E night / #2DD964 day)
- Text: dark (#000 or #080808)
- Border-radius: 5px
- Padding: 8px 20px
- The single most important action. Green = go.

### Stop Broadcast Button
- IBM Plex Mono 500, 11px
- Background: transparent
- Border: 1.5px solid `--red`
- Text: `--red`
- Border-radius: 5px

### Input Focus
- Border transitions to `--amber` on focus
- No glow, no ring. Just the border color change.
- Transition: 150ms

### Settings Row Hover
- Background transitions to `--bg-2`
- Transition: 150ms

## Scrollbar
- Width: 3px
- Track: transparent
- Thumb: `--border` (night: #2A2824, day: #5E5E5E)
- Thumb hover: `--text-dim`
- Border-radius: 9999px on thumb

## Modal / Dialog
- Background: `--bg-1`
- Border: 1px solid `--border`
- Border-radius: `--radius` (6px)
- Backdrop: rgba(0,0,0,0.6) with backdrop-filter: blur(4px)
- Max width: 360px
- Padding: 20px

## Disabled States
- Opacity: 0.4
- Cursor: not-allowed
- No hover effects when disabled

## Selection / Highlight
- Text selection background: `--amber-soft`
- Current track row: `--amber-soft` background, artist text in `--amber`

## Checkbox
- Size: 14x14px
- Border-radius: 3px
- Checked: `--amber` background, dark checkmark
- Unchecked: `--bg-2` background, `--border` border

## Focus Ring
- None visible. Focus is communicated through border color change to `--amber` only.
- Accessibility: rely on border change, not an outer ring

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-07 | Keep techy monospace identity | Apple-like rounded design is generic in the AI/vibe-coding era. The monospace identity is TrackCast's differentiator. |
| 2026-05-07 | IBM Plex Mono over JetBrains Mono | Same identity, more refined. Better weight range, cleaner at small sizes. |
| 2026-05-07 | Keep amber (#E88010) | Signature color. Warm, distinctive, not interchangeable with system blue. |
| 2026-05-07 | Warm-tinted backgrounds | #0A0908 instead of #080808. Adds material quality without losing the dark identity. |
| 2026-05-07 | Glow reserved for live states | Reduce neon from everywhere to live dot only. Glow means "alive." |
| 2026-05-07 | Poster now-playing | Artist name at 44px with breathing room. The hero moment of the app. |
| 2026-05-07 | 6px radius (not rounded) | Sharp enough to feel technical, soft enough to not look broken. |
| 2026-05-07 | Green = alive, amber = interactive/done | Tight color semantics. Green never means "success/configured" -- only "live/active." |
| 2026-05-07 | Day mode stays warm gray | #3A3A3A base, never white. Consistent identity across modes. |
| 2026-05-07 | Subtle grain texture | 2% opacity noise overlay. Premium material signal. |
