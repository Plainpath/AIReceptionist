# Base app changelog (chalon-plumbing branch)

This branch is scoped to Chalon Plumbing customisations only (white-label
branding, plumbing-specific price book/wording/trade config, etc.).

If any change made here is actually a generic improvement to the base
Tradie Quotes app — a bug fix, a new capability, a schema change, anything
that should also exist back on `tradie-quotes-app` — log it below so it can
be ported/cherry-picked back when we return to that branch. Plumbing-only
customisation (branding, copy, trade-specific data) does not need an entry.

Format: date, one-line description, files touched, commit hash once
committed.

## Log

- **2026-09-29** — Replaced the bottom tab bar with a two-tier kebab (3-dot) menu
  navigation: a top-left menu on every main screen is the app's primary
  navigation (role-gated section list), and an optional top-right kebab per
  screen surfaces page-specific quick actions. Generic nav pattern, not
  plumbing-specific — worth porting back to `tradie-quotes-app`.
  Files: `mobile/src/components/AppHeader.tsx` (new), `mobile/src/navigation/{types,RootNavigator}.tsx`
  (flattened Tabs into a single Stack), `mobile/src/screens/{Dashboard,Calendar,Money,ClientList,Timesheet,BusinessSetup}Screen.tsx`,
  removed `mobile/src/navigation/TabBarIcon.tsx` (dead code).
  Commit: (pending — see next `git log` on this branch)

- **2026-09-30** — Quote builder: line price is now editable (tap the rate to
  type a new one), and the price book is now a single "Price book" button
  that opens a multi-select sheet (works the same for Flat price, Itemised,
  and Labour + materials) — replaces the old drag-card gesture UX, which was
  fiddly especially on web/desktop testing. Generic quote-builder UX fix, not
  plumbing-specific — worth porting back to `tradie-quotes-app`.
  Files: `mobile/src/screens/QuoteBuilderScreen.tsx`, removed
  `mobile/src/components/PriceBookCard.tsx` (dead code, no longer used).
  Commit: (pending — see next `git log` on this branch)
