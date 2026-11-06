# Design guidelines — AgentOps Control Center

Distilled from Emil Kowalski's design-engineering skill (emilkowal.ski/skill) and Jakub Krehel's
interface skills (jakub.kr/skills: better-ui, better-typography, better-colors, better-accessibility,
make-interfaces-feel-better). These rules are binding for `apps/web`.

The product is a professional operations tool used many times a day. It should feel **quiet, dense,
precise and fast** — closer to Linear / Vercel dashboard than to a landing page. Remove anything that
exists only to look "designed".

## 1. Remove the slop

- No decorative icon chips (colored square + icon) in card corners or headings. Icons only where they
  carry meaning or label an icon-only control.
- No "Welcome back, X" headers, motivational subtitles or filler copy ("LLM errors are never auto-approved").
- No gradient / filled logo tiles; a simple wordmark.
- Badges: text + a small status dot, no icon inside every badge, no pastel fill + border + icon combos.
- No charts that show mostly empty data. A chart must earn its place.
- Cards: not every section needs a card. Prefer flat sections separated by hairline dividers and
  whitespace; cards only for grouped, elevated content.
- Never show raw identifiers as UI copy (`flag_invoice_for_review`, `llm_response_valid`). Map to
  human labels ("Flag invoice for review", "Model response validated"). Raw ids may appear in a
  secondary monospace detail.
- Sentence case everywhere ("Run status changed", not "Llm Request" / title case).
- Toasts must not overlap the header controls; bottom-right on desktop, top on mobile, max 3 visible.

## 2. Color (better-colors)

- One neutral ramp + one accent ramp + only the status ramps actually rendered. Define in `oklch()`
  as primitives, expose **semantic tokens** (`--color-bg`, `--color-bg-subtle`, `--color-surface`,
  `--color-border`, `--color-text`, `--color-text-secondary`, `--color-text-tertiary`,
  `--color-accent-solid`, `--color-accent-text`, `--color-success`, `--color-warning`,
  `--color-danger`) — components reference semantic tokens only.
- Accent is used sparingly: exactly one filled primary action per view, focus rings, active nav,
  own message bubbles. Everything else neutral.
- Status colors within 15° hue of the accent are not allowed. Status is never carried by color alone
  (dot + text label).
- No `text-white` on a 500-level fill (fails 4.5:1) — use 600+.
- Dark mode: lower accent chroma, re-measure contrast; use one mechanism (`.dark` class).
- Text contrast ≥ 4.5:1, UI boundaries ≥ 3:1.

## 3. Typography (better-typography)

- One family (Inter / system) + one mono (for ids, amounts in tables optional). Load every weight used.
- `antialiased` once on the root.
- Scale: 12 (caption, rarely), 13 (secondary/meta), 14 (UI default), 16 (body / mobile inputs),
  20, 24 (page title). Unitless line-height: 1.5 body, 1.25 headings.
- Headings ≥ 24px: `letter-spacing: -0.015em`. Uppercase micro-labels ≤ 12px: `0.05em`, used rarely.
- `font-variant-numeric: tabular-nums` on all changing numbers, amounts, counts, timestamps, table numeric columns.
- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs.
- Truncation must have a way to see the full text (title attribute / tooltip / detail view).
- Mobile inputs are 16px (no iOS zoom).
- Real typography: `…`, `—`, curly quotes, non-breaking space before units where needed.

## 4. Surfaces (better-ui)

- Concentric radius: outer radius = inner radius + padding. Small set: 6px (controls), 10px (cards), 9999 (pills/avatars).
- Shadows for elevation, borders for structure. Elevated surfaces (popover, dialog, dropdown, floating composer):
  light `0 0 0 1px oklch(0 0 0 / .06), 0 1px 2px -1px oklch(0 0 0 / .06), 0 2px 4px oklch(0 0 0 / .04)`;
  dark `0 0 0 1px oklch(1 0 0 / .08)`. Keep `border: 1px solid transparent` under shadow rings (forced colors).
  Tables, dividers, inputs keep real borders.
- Avatars/images: `outline: 1px solid oklch(0 0 0 / .1); outline-offset: -1px` (dark: white/10).
- Icons: lucide only, `currentColor`, stroke 1.5 next to 400-weight text, 2 next to 600. 16px in UI, 14px in dense rows.
- Optical alignment: buttons with a leading icon get ~2px less padding on the icon side.

## 5. Motion (Emil + better-ui)

- **Frequency decides.** High-frequency actions (typing, nav switches, row hover, tab switch, keyboard actions) → no animation or ≤150ms opacity/background only.
- Easing tokens:
  - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` — enter/exit (default)
  - `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` — on-screen movement
  - `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` — sheets/drawers
  - Never `ease-in` for UI.
- Durations: press 150ms; tooltip 125–200ms; dropdown/popover 150–250ms; dialog/drawer 200–300ms. UI stays < 300ms. Exit faster than enter.
- Press feedback: `scale(0.96)` on `:active` over 150ms ease-out for buttons; never when disabled (`enabled:active:`).
- Never animate from `scale(0)` — start at `scale(0.95)` + `opacity: 0`.
- Popovers/dropdowns scale from their trigger (`transform-origin: var(--radix-*-content-transform-origin)`); dialogs stay centered.
- Only animate `transform`, `opacity`, `filter`. Never `transition: all`; name properties.
- Use CSS transitions (interruptible) for interactive state; keyframes only for run-once entrances.
- New chat message enter: opacity 0→1, translateY 6px→0, blur 2px→0, 200ms `--ease-out`. Only for newly
  arrived messages, never for history load (`initial={false}`).
- Staggered entrance (30–80ms) only for first page load of a list, never on refetch.
- Icon swaps (copy→copied, send→sending): scale .25→1, opacity, blur 4px→0, spring `{duration: .3, bounce: 0}`.
- `prefers-reduced-motion`: keep opacity fades, drop transforms/blur.
- Hover effects only under `@media (hover: hover) and (pointer: fine)` (Tailwind v4 `hover:` already does this).
- `overscroll-behavior: contain` on scroll areas inside dialogs/drawers/chat.

## 6. Accessibility (better-accessibility)

- Native elements: `<button>` for actions, `<a href>`/`<Link>` for navigation, never clickable `<div>`/`<tr>` without a real link inside.
- `:focus-visible` ring, 2px, ≥ 3:1 contrast. Never remove outlines without replacement.
- Hit targets: ≥ 40×40 desktop where density allows, 44×44 on touch.
- Every icon-only button has `aria-label`. Form fields have real `<label>`s; errors via `aria-invalid` + `aria-describedby`; validate on submit.
- Live regions: new messages/toasts announced politely (`role="status"`), errors with `role="alert"` only when urgent.
- Route change: update `document.title`.
- Reflow at 320px, 200% zoom without horizontal scroll.

## 7. Components

- **prompt-kit** (`https://prompt-kit.com/c/<name>.json`) for messaging and agent surfaces:
  `chat-container` (stick-to-bottom scrolling), `message`, `prompt-input` (composer), `scroll-button`,
  `loader`, `text-shimmer` (agent "analyzing…" state), `steps` / `reasoning` (agent run timeline and reasoning).
- **motion-primitives** (`https://motion-primitives.com/c/<name>.json`) only where it adds meaning:
  `animated-background` (segmented filter / nav active indicator), `sliding-number` or `animated-number`
  (KPI counters changing live), `transition-panel` (inbox ↔ detail on mobile).
- Restyle imported components to these tokens; do not keep their demo styling.
