# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Wave Messenger — a WhatsApp-class mobile messenger (React Native + Expo + Supabase). **Phase 1 (foundation) is in place**: Expo Router shell, the theme system, and the UI primitives. Phase 2 (Supabase schema + auth) is next — see `PLAN.md`.

Read before doing anything:

| File | Role |
|---|---|
| `PLAN.md` | 8 phases with exit criteria. Work is sequential — do not start phase N+1 until phase N's exit criteria are demonstrably met |
| `docs/BUILD_SPEC.md` | What to build, the verification loop, and the closed out-of-scope list |
| `design-reference/tide_system/DESIGN.md` | The design system — colors, type roles, spacing, shape, component rules |
| `design-reference/<screen>/` | `screen.png` (the visual target) + `code.html` (exact structure and values) for 22 screens |

## Source-of-truth hierarchy

`design-reference/` > `docs/BUILD_SPEC.md` > everything else. Where the spec prose and a reference screenshot disagree, the screenshot wins. Deviating from `design-reference/` requires a written reason in the phase summary — "it was easier in React Native" is not one.

## The one architectural rule

**The UI reads from SQLite only.** Network fetches and Supabase Realtime events write into `expo-sqlite`; SQLite emits to the UI. No screen ever awaits a network call to render. This is what makes the app feel instant and what makes offline work without a separate code path — it is not an optimization to add later.

Corollaries:
- Sending a message inserts into SQLite in `pending` state before any network call; the server ack reconciles it. The outbox retry queue persists across app restarts and airplane-mode toggles.
- The message-state reducer is pure and unit-tested. Realtime handlers are thin wrappers that feed it.

## Non-negotiables

- **RLS ships with the table.** Never add a Postgres table in `supabase/migrations/` without its Row Level Security policies in the same migration. Core predicate: a user reads a row only if they belong to the chat it hangs off.
- **Privacy toggles are enforced server-side.** Hiding "last seen" must stop the data leaving the server, not hide a label in the UI.
- **No hardcoded design values.** Every color, radius, spacing and type role comes from `theme/tokens.ts`, which mirrors `DESIGN.md`. A literal `#25D366` anywhere outside that file is a bug.
- **Do not run builds.** No EAS builds, no `expo run:android` / `expo run:ios`, no `expo prebuild` — the user is conserving build quota. Verification is `npm run verify` (typecheck + lint + jest) plus reading the code against `design-reference/`. A development build is required eventually (WebRTC, MMKV), but only when the user asks for it; until then prefer dependencies that run without one, behind a driver seam (see `services/storage.ts`).
- **Do not stop at the first implementation.** Every screen goes through the loop: build → run → screenshot → list every difference against `design-reference/<screen>/screen.png` → fix → screenshot again.

## Layout

Present today:

```
app/            _layout.tsx (fonts + providers), (tabs)/ with four stub screens
components/ui/  Text, Avatar, Badge, Pill, ListRow, Ticks, Screen — plus the barrel
theme/          tokens.ts, fontFamilies.ts, fonts.ts, ThemeProvider.tsx
services/       storage.ts (driver seam)
```

Arriving in later phases: `app/(auth)/`, `app/chat/[id]`, `app/status/[userId]`, `app/call/[id]`,
`app/settings/`, `components/chat/`, `db/` (SQLite), `services/realtime|sync|media`, `stores/`
(Zustand), `supabase/migrations/`.

Two conventions worth knowing before writing a component:
- `components/ui/Text` takes `variant` (type role) and `tint` (color) — **not** `role`/`color`,
  which collide with React Native's ARIA props and silently resolve to `never`.
- `theme/fontFamilies.ts` holds family *names*; `theme/fonts.ts` holds the *binaries* and is
  imported only by the root layout. Keep that split or every test drags .ttf files in.

## Stack (fixed — do not substitute)

Expo SDK 54+, TypeScript strict, Expo Router · Supabase (phone OTP, Postgres+RLS, Realtime, Storage) · expo-sqlite + MMKV · Zustand + TanStack Query · FlashList for every long list · Reanimated 3 + Gesture Handler · react-native-webrtc over a Supabase Realtime signalling channel · Be Vietnam Pro (400/500/600 only).

Do not add Firebase, do not write a custom Node backend, do not scaffold auth — `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are provided in `.env`.

## Commands

```bash
npm run verify            # tsc --noEmit + lint + jest — the gate for every phase
npx expo start            # dev server only; never `expo run:*` or EAS
npx tsc --noEmit          # typecheck alone
npx jest path/to/file.test.ts -t "test name"   # a single test
```

## Git

`main` only; commit per phase with a message describing what is now *demonstrably working*, and push after each phase. HTTPS pushes to this remote need `http.version=HTTP/1.1` and a large `http.postBuffer` (already set in the local config) — the design-reference PNGs time out over HTTP/2 otherwise.

## Working style expected here

When something is ambiguous, pick the behavior real WhatsApp has, record it as a one-line `ASSUMPTION` in the phase summary, and keep going. When the user is vague or wrong, offer 2–3 concrete options with a recommendation and the trade-off rather than agreeing by default.
