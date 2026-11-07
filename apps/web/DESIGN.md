# Design guidelines — AgentOps Control Center

Distilled from Emil Kowalski's design-engineering skill (emilkowal.ski/skill) and Jakub Krehel's
interface skills (jakub.kr/skills: better-ui, better-layout, better-typography, better-colors,
better-accessibility, make-interfaces-feel-better). These rules are binding for `apps/web`.

The product is a professional operations tool used many times a day. It should feel **quiet, dense,
precise and fast** — closer to Linear / Vercel dashboard than to a landing page. Remove anything that
exists only to look "designed".

## 1. Remove the slop

- No decorative icon chips (colored square + icon) in card corners or headings. Icons only where they
  carry meaning or label an icon-only control.
- No "Welcome back, X" headers, motivational subtitles or filler copy ("LLM errors are never auto-approved").
- No gradient / filled logo tiles; a simple wordmark.
- Badges: text + a small status dot, no icon inside every badge, no pastel fill + border + icon combos.
- No charts that show mostly empty data. A chart must earn its place: every visual on a page answers
  a question the user has there (where is this run? how far off is this amount? what waits on me?).
- Cards: not every section needs a card. Group with space first; cards only for grouped, elevated
  content (the pipeline figure, the proposal, an invoice sheet, inbox items).
- Never show raw identifiers as UI copy (`flag_invoice_for_review`, `llm_response_valid`). Map to
  human labels ("Flag invoice for review", "Model response validated"). Raw ids may appear in a
  secondary monospace detail.
- Sentence case everywhere ("Run status changed", not "Llm Request" / title case).
- Toasts must not overlap the header controls; bottom-right on desktop, top on mobile, max 3 visible.

## 2. Color (better-colors)

Generated in OKLCH (culori) as Radix-style 12-step ramps where each step has a job: 1–2 backgrounds,
3–5 interactive fills, 6–8 borders, 9–10 solid fills, 11–12 text. Constant hue per ramp, chroma
peaking mid-ramp and easing off at both ends so the light steps don't go chalky and the dark ones
don't go muddy.

| Ramp | Hue | Notes |
| --- | --- | --- |
| neutral | 80 (warm stone) | chroma ≤ 0.008, reads as paper rather than blue-grey |
| accent | 218 (petrol) | one accent; ≥ 40° from every status hue |
| success / warning / danger | 152 / 72 / 25 | only the steps that are rendered |

- Two tiers: primitives (`--neutral-1…12`, `--accent-*`, `--green-*`, `--amber-*`, `--red-*`) and
  **semantic tokens** that components use exclusively: `--color-bg`, `-bg-subtle`, `-bg-muted`,
  `-bg-surface`, `-text`, `-text-secondary`, `-text-tertiary`, `-border`, `-border-control`,
  `-accent-solid`, `-accent-text`, `-success-*`, `-warning-*`, `-danger-*`. Tailwind's default palette
  is reset, so a stray `bg-blue-500` doesn't compile.
- Measured contrast (light / dark): text 16.6 / 16.9, secondary 7.1 / 9.0, tertiary 4.6 / 5.3,
  text on accent 5.8 / 5.7, control borders 3.4 / 3.0.
- Accent is used sparingly: one filled primary action per view, focus rings, active nav, the live
  stage of a pipeline, own message bubbles. Everything else neutral.
- Status is never carried by color alone (dot + word, icon + word on pipeline stages).
- Dark mode is its own set of values under `.dark`, not an inversion; accent text moves to step 11.

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

- Concentric radius: outer radius = inner radius + padding. Small set: 6px (controls), 8–12px (cards), 9999 (pills/avatars).
- Elevated surfaces use a shadow ring (`--shadow-border`, `.surface`) over a transparent 1px border (kept for
  forced-colors mode). Hover deepens the ring (`--shadow-border-hover`) instead of changing the fill.
  Tables, dividers and inputs keep real borders.
- Avatars/images: `outline: 1px solid oklch(0 0 0 / .1); outline-offset: -1px` (dark: white/10).
- Icons: lucide only, `currentColor`, stroke 1.5 next to 400-weight text, 2 next to 600. 16px in UI, 14px in dense rows.
- Optical alignment: buttons with a leading icon get ~2px less padding on the icon side.
- Build the missing primitive instead of falling back to the browser's: `Select` (Radix) replaces
  `<select>`, `DatePicker` (react-day-picker in a popover) replaces `<input type="date">`.

## 4b. Layout (better-layout)

- Group with space, not lines: gaps between groups are at least twice the gaps inside them. Section
  headings carry no rules; lists of cards use `space-y-*`, not `divide-y`.
- Logical properties only (`ms/me/ps/pe`, `start/end`, `text-start`, `border-s`), so the layout
  mirrors in RTL. Centring with `left-1/2 -translate-x-1/2` is the one exception.
- Components that live in different widths size themselves with container queries (`@container`,
  `@md:`, `@3xl:`), not viewport breakpoints: the pipeline track and board work in a 22rem aside and a
  full page alike.
- Grid tracks are `minmax(0,1fr)` so long content truncates instead of blowing out the column. Full
  height uses `100dvh`; anchored scrolling leaves room for the header with `scroll-padding`.
- Tables shed columns by priority as width drops; no horizontal page scroll at 320px.

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
  Agent surfaces also use `tool` (each agent step as a call with input, output and state),
  `chain-of-thought` (read → compare → recommend), `system-message` (gate and outcome banners) and
  `thinking-bar` (live analysis).
- Restyle imported components to these tokens; do not keep their demo styling.

## 8. Pipeline visuals

The agent's work is shown as one pipeline everywhere: intake → analyze → **human review** (the gate)
→ execute → recorded. `features/agents/pipeline.ts` derives every stage's state from the run DTO; all
visuals read from it, so they cannot disagree.

- **Agent line** (`pipeline-machine.tsx`): an isometric bench drawn with the Anatomy kit
  (wheresryan22/anatomy, MIT, vendored in `components/iso`). The invoice sheet rides a carriage under
  the model gantry, waits at a boom gate with a key switch, is stamped by the press once approved, or
  drops into the reject bin. One lit accent; everything else in three neutral tones; painter's order
  back to front. Holds still under `prefers-reduced-motion`.
- **Track** (`pipeline-track.tsx`): the same five stages as icon + word, connector flowing into the live
  stage; `compact` renders five segments for tables, cards and lists.
- **Board** (`pipeline-board.tsx`): the overview places every run in its stage lane, with runs that
  left the line (failed, rejected) on an off-ramp underneath.
- **Evidence**: risk gauge, deviation bar against the vendor's typical amount and the 3× limit, a
  table-sized `DeviationMini`, and an invoice sheet. The new-case dialog previews the likely verdict
  from the same thresholds as the mock agent.

