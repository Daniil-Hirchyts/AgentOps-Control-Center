# Design guidelines — AgentOps Control Center

These rules are binding for `apps/web`.

The product is a professional operations tool used many times a day. It should feel **quiet, dense,
precise and fast** — closer to Linear / Vercel dashboard than to a landing page. Remove anything that
exists only to look "designed".

## 1. No decoration for its own sake

- No decorative icon chips (colored square + icon) in card corners or headings. Icons only where they
  carry meaning or label an icon-only control.
- No "Welcome back, X" headers, motivational subtitles or filler copy ("LLM errors are never auto-approved").
- No gradient / filled logo tiles; a simple wordmark.
- Badges: text + a small status dot, no icon inside every badge, no pastel fill + border + icon combos.
- No charts that show mostly empty data. A chart must earn its place: every visual on a page answers
  a question the user has there (where is this run? how far off is this amount? what waits on me?).
- Cards: not every section needs a card. Group with space first; cards only for grouped, elevated
  content (the pipeline card, the proposal, an invoice sheet, inbox items).
- Never show raw identifiers as UI copy (`flag_invoice_for_review`, `llm_response_valid`). Map to
  human labels ("Flag invoice for review", "Model response validated"). Raw ids may appear in a
  secondary monospace detail.
- Sentence case everywhere ("Run status changed", not "Llm Request" / title case).
- Toasts must not overlap the header controls; bottom-right on desktop, top on mobile, max 3 visible.

## 2. Color (family.co palette)

The palette follows family.co: warm paper neutrals, charcoal ink for text and primary actions, one
blue for live and interactive state, and a small set of graphic hues for avatars and diagrams.

| Role | Light | Notes |
| --- | --- | --- |
| page / subtle / muted | `#FBFAF9` / `#F6F4EF` / `#F2F0ED` | warm stone, never blue-grey; surfaces are white |
| ink | `#343433` | body text and the primary pill button (`bg-ink text-text-on-ink`) |
| accent | `#2F6FE4` (text `#2563D4`) | live pipeline stage, links, focus ring, own message bubbles |
| success / warning / danger | `#44C67F` / `#FFBE4C` / `#D63A31` | text steps `#1F7F49` / `#93620F` / `#C8322B` |
| graphic hues | blue, green, purple, orange, gold, pink + `-pale` | agent avatars, diagram fills, initials |

- Two tiers: primitives (`--neutral-*`, `--ink`, `--accent-*`, `--green-*`, `--amber-*`, `--red-*`,
  `--hue-*`) and **semantic tokens** that components use exclusively (`--color-bg`, `-bg-subtle`,
  `-text`, `-text-secondary`, `-border`, `-ink`, `-text-on-ink`, `-accent-solid`, `-success-*`, …,
  `--color-hue-*`). Tailwind's default palette is reset, so a stray `bg-blue-500` doesn't compile.
- Measured contrast (light): text 12.0, secondary 7.1, tertiary 4.6, white on ink 12.5, white on blue 4.65.
- Primary actions are ink, not blue. Blue is kept for what is live or interactive, so it still means something.
- Status is never carried by color alone (dot + word, icon + word on pipeline stages).
- Dark mode is its own warm charcoal set under `.dark`; ink inverts to `#F3F1EC`.

## 3. Typography

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

## 4. Surfaces

- Concentric radius: outer radius = inner radius + padding. Set: 6 / 8 / 12 / 16 / 24 / 32px. Buttons are
  pills (`rounded-full`), cards 16–24px, large editorial blocks 32px.
- Elevated surfaces use a flat 1px shadow ring (`0 0 0 1px #ece9e4`, `.surface`) over a transparent 1px
  border (kept for forced-colors mode). No soft drop shadows. Hover deepens the ring instead of changing the fill.
- Buttons: primary = ink pill, secondary = light stone pill, ghost for toolbars.
  Tables, dividers and inputs keep real borders.
- Avatars/images: `outline: 1px solid oklch(0 0 0 / .1); outline-offset: -1px` (dark: white/10).
- Icons: lucide only, `currentColor`, stroke 1.5 next to 400-weight text, 2 next to 600. 16px in UI, 14px in dense rows.
- Optical alignment: buttons with a leading icon get ~2px less padding on the icon side.
- Build the missing primitive instead of falling back to the browser's: `Select` (Radix) replaces
  `<select>`, `DatePicker` (react-day-picker in a popover) replaces `<input type="date">`.

## 4b. Layout

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
- Tables have no row rules. The table bleeds 12px past the content edge on both sides, so cell text
  lines up with the page while the rounded row hover has room and is never clipped.
- Forms do not scroll. A long form is split into two groups side by side in a wide dialog
  (`md:max-w-4xl`); on a phone the same groups become two steps ("Step 1 of 2") with Continue and Back.
  Related inputs join into one control (amount and currency). Short choices sit side by side.
- Long lists show what matters first and say what is hidden: the contact list groups Online and
  Offline (people seen online this session first, then A to Z) and shows five offline people behind
  "Show n more". The open conversation and anyone with unread messages are never hidden. Rows never
  move because of a click or a read: the order depends only on presence and names.
- Scrollbars are hidden everywhere. Every scroll area still scrolls with wheel, touch and keyboard,
  and a sideways area says so on phones ("Swipe sideways to see the whole diagram.").

## 5. Motion

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

Animation inventory (each one passed the frequency / purpose / speed check):

| Element | Motion | Why |
| --- | --- | --- |
| Sidebar hide / show | width 240ms `--ease-drawer`, content fades; the floating pill scales in from .96 with a 4px blur | The layout changes size, so show where it went |
| Fresh approval in the inbox | `animate-row-in` once, only for approvals that arrived over the socket | A new item should be noticed |
| Pipeline stages | node and connector colours ease over 200ms | State changes live while you watch |
| Empty states | `animate-fade-up` (300ms, 12px, blur 4px) | Rare, softens a blank page |
| Learn page headers | fade up with a 100ms stagger, first section last | Visited rarely, sets the reading order |
| Diagrams | packets travel along links, steps light up in order, a pulse ring on live state changes | The motion is the explanation |

Left still on purpose: nav active state, row hover, tab switches and anything started from the keyboard.

## 6. Accessibility

- Native elements: `<button>` for actions, `<a href>`/`<Link>` for navigation, never clickable `<div>`/`<tr>` without a real link inside.
- `:focus-visible` ring, 2px, ≥ 3:1 contrast. Never remove outlines without replacement.
- Hit targets: ≥ 40×40 desktop where density allows, 44×44 on touch.
- Every icon-only button has `aria-label`. Form fields have real `<label>`s; errors via `aria-invalid` + `aria-describedby`; validate on submit.
- Live regions: new messages/toasts announced politely (`role="status"`), errors with `role="alert"` only when urgent.
- Route change: update `document.title` and move focus to `<main id="main" tabIndex={-1}>` (not on
  first load), so screen readers announce the new view.
- A "Skip to content" link is the first focusable element and appears on focus.
- Diagrams: parts are focusable buttons with `aria-pressed`; players are `role="toolbar"` with arrow
  keys; the current step is announced from an `aria-live` caption; the traffic log is `role="log"`.
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

- **Pipeline card** (`pipeline-card.tsx`): one line saying where the run is and why, above the track.
  Used on the run page and the reviewer's approval page.
- **Track** (`pipeline-track.tsx`): the same five stages as icon + word, connector flowing into the live
  stage; `compact` renders five segments for tables, cards and lists.
- **Board** (`pipeline-board.tsx`): the overview places every run in its stage lane, with runs that
  left the line (failed, rejected) on an off-ramp underneath.
- **Evidence**: risk gauge, deviation bar against the vendor's typical amount and the 3× limit, a
  table-sized `DeviationMini`, and an invoice sheet. The new-case dialog previews the likely verdict
  from the same thresholds as the mock agent.

## 9. People and agents

- **People** get round portraits (`public/avatars/<username>.webp`, generated for the four demo users in
  a flat, warm style that matches the palette). Anyone else gets initials on a pale hue picked from a
  hash of the username. A presence dot sits on the avatar; the user's own avatar has no test id.
- **Agents** get rounded-square pattern avatars (`components/shared/agent-avatar.tsx`), one hue and one
  pattern each, so a square always means software and a circle always means a person. The names are
  defined once in `features/agents/agents.ts`: Invoice Risk Analyst, Run Orchestrator, Approval
  Gatekeeper, Case Action Executor, Realtime Relay. Audit entries and agent calls show the agent's
  name instead of "System".

## 10. Shell

- Sidebar grouped as Work / Collaborate / Learn, active item a white pill. The connection status
  appears only when something is wrong; when connected it is a screen-reader-only label.
- The sidebar can be hidden (button in its header, or `[`), with the slide described in Motion. When
  hidden, a floating vertical pill keeps the show button, every nav item as an icon with a tooltip and badge dot, notifications and
  the user menu. The choice is remembered per browser.

## 11. Learn pages

`/learn/concept` presents AgentOps as a platform for supervising and validating AI agents (messaging
is one part of it, used by the two people who decide), then the five ideas it puts to work (agentic AI,
human in the loop, tool calling, observability, WebSocket), what is simulated, who is involved, the four
case scenarios and the life of a case. `/learn/architecture` explains the system: the map of devices, proxy, server, database and
model; which channel (REST or WebSocket) carries what; sequence diagrams for a message, the approval
loop and sign-in; and the run state machine. Diagrams are hand-placed SVG in `features/learn/diagrams/`
using the same tokens, with one line style per channel (REST solid ink, WebSocket dashed blue, SQL
green, model dotted purple). They scroll sideways inside their frame on a phone.

The diagrams are live and interactive. Each one starts playing when it scrolls into view and loops
until the reader pauses, steps or picks a step; it waits while off screen or while a part is pointed
at, and never starts by itself with reduced motion. Live regions stay quiet during autoplay. Wires
end exactly on their boxes, arrowheads keep one size (`markerUnits="userSpaceOnUse"`) and labels
carry a surface-coloured halo so lifelines never cut through them.

- **System map**: hover or focus a part to see what it does and dim everything unrelated; click to
  pin it. Your own REST calls and socket frames (recorded by `stores/traffic.ts` from `lib/api.ts` and
  the realtime provider) travel across the map as packets and fill a traffic log. "Replay a message"
  and "Replay an approval" animate the two main flows, and the map replays them in turn on its own
  (a pause button stops it). The people online are shown under the map.
- **Sequences**: Play, pause, step with the arrow keys or click a step. The current arrow carries a
  travelling dot and the actors involved are outlined.
- **Run state machine**: plays every path in turn (approved, rejected, no action, model fails); pick
  one to loop it. Each state shows how many runs are in it right now; operators can click a state to
  open those runs.

## 12. App icon

A dark ink square (radius 9 of 32) with an open ring and a gold dot at its gap: a loop with a person
at the point where it can be stopped. `components/shared/logo.tsx` draws it with theme tokens; the
favicon, `apple-touch-icon.png`, `icon-512.png` (maskable) and `manifest.webmanifest` use the same shape.

## 13. Writing

- Errors say what failed and what to do next: "Unable to load this case. Check your connection, then
  try again." Never "Something went wrong", "Could not", "Please" or "successfully".
- Buttons start with a verb and name the result: "Create case", "Try again", "Show 12 more".
- Placeholders show an example value, never the label again.
- Plain words over jargon on screen; technical names (REST, WebSocket) only on the Learn pages.

