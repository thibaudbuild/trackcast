# TrackCast

Broadcast your DJ set live to Telegram and save a clean set history.

## Repository Layout

- `apps/mac` - Tauri shell, macOS sidecars, icons, and build config
- `apps/windows` - Tauri shell, Windows sidecars, icons, and build config
- `packages/app` - Shared React frontend used by both desktop apps
- `site/` - Static landing page and onboarding guide
- `assets/brand/` - Shared brand assets (logo, wordmark, web fonts) used by both the desktop app (via Vite alias `@brand`) and the site (deployed alongside `site/` by `.github/workflows/deploy-site.yml`)

## Common Commands

```bash
npm install
npm run dev:mac
npm run build:mac
npm run build:windows
npm run site
```

## Working Rules

Never make code changes without explicit user confirmation first. When the user
asks a question or shares an idea, treat it as a discussion — give your opinion,
propose options, and wait for approval before touching any files.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
