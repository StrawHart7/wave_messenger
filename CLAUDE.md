# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Wave Messenger — a WhatsApp-class mobile messenger (React Native + Expo + Supabase). **Phases 1-6 are in place**: Expo Router shell, theme system and UI primitives; Supabase schema with RLS, phone-OTP auth and onboarding; the SQLite store, chat list, conversation, outbox and realtime; media, voice notes, reactions, replies and the attachment sheet; groups, membership, admin permissions and the info screens; status with its composer, full-screen viewer and 24-hour lifetime. Phase 7 (calls) is next — see `PLAN.md`.

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
app/                 _layout.tsx (fonts, providers, AuthGate, useAppSync)
  (auth)/            phone, otp, profile-setup
  (tabs)/            chats (live), updates/communities/calls stubs
  chat/[id]/         index.tsx (conversation), info.tsx (group info)
  contact/[id].tsx   contact info, collapsing hero
  status/            compose.tsx, [userId].tsx (full-screen viewer)
  new-chat.tsx       people picker + New group entry
  new-group.tsx      two-step creation (participants -> subject & icon)
  add-members.tsx    add to an existing group
  archived.tsx       archived chats
components/ui/       Text, Avatar, AvatarStack, Badge, Pill, ListRow, Ticks, TextField,
                     OtpInput, Screen
components/auth/     AuthGate (routing guard), CountryPicker
components/chat/     Bubble, ChatRow, Composer, MediaBubble, VoiceNoteBubble,
                     VoiceRecorder, AttachmentSheet, MessageActions, SwipeToReply,
                     TypingBubble, ContactBubble
components/group/    ContactPicker, SelectionChips, MemberRow, InfoSection, TextPrompt
components/status/   StatusAvatar (ring), SegmentedProgress, ViewerSheet
db/                  schema.ts, client.ts (connection + revision), chats.ts, messages.ts,
                     members.ts, profiles.ts, status.ts, attachments.ts (attachments + reactions)
hooks/               useLiveQuery, useChats, useConversation, useMembers, useSignedUrls,
                     useStatus, useVoiceRecorder, useAppSync
theme/               tokens.ts, fontFamilies.ts, fonts.ts, ThemeProvider.tsx
services/            storage, supabase, auth, phone, contacts (pure), contactSync,
                     media, messageState, grouping, chatList, attachments, waveform,
                     reactions, groups (pure), groupSync, chatSync, contactCard,
                     status (pure), statusSync
services/realtime/   messages.ts (postgres_changes), presence.ts (typing + presence),
                     membership.ts (chat_members + chats), status.ts
services/sync/       outbox.ts (text), uploads.ts (media), bootstrap.ts (server -> SQLite)
stores/              session.ts (Zustand)
supabase/migrations/ 0001_init.sql (schema + RLS), 0002_storage.sql (buckets + policies),
                     0003_groups.sql (admin guards + system-message triggers),
                     0004_status.sql (view-insert guard + expiry sweep)
```

Arriving in later phases: `app/call/[id]`, `app/settings/`.

Conventions worth knowing before writing code here:
- `components/ui/Text` takes `variant` (type role) and `tint` (color) — **not** `role`/`color`,
  which collide with React Native's ARIA props and silently resolve to `never`.
- `theme/fontFamilies.ts` holds family *names*; `theme/fonts.ts` holds the *binaries* and is
  imported only by the root layout. Keep that split or every test drags .ttf files in.
- **Native imports poison tests.** A module that imports `expo-contacts`, `expo-crypto` or any
  other native module cannot be unit-tested under jest-expo. Pure rules go in their own module
  (`services/phone.ts`, `services/contacts.ts`); the native side sits next to it
  (`services/contactSync.ts`). Follow that split for every new service.
- The client reads the `public_profiles` view, never the `profiles` table: the privacy settings
  are applied inside the view, so a hidden avatar or last-seen is null before it leaves Postgres.
- **Every local write goes through `db/client.ts`'s `mutate()`.** It bumps a revision that
  `useLiveQuery` (a `useSyncExternalStore` over SQLite) watches. Writing to the database outside
  `mutate()` means the screen never updates.
- Messages are keyed locally by `client_id`, not the server id — a message exists before the
  server has seen it. Reconciliation matches on `client_id`; matching on content or timestamp is
  how duplicates appear.
- Delivery state only ever moves forward (`services/messageState.ts`). Receipts arrive out of
  order; without that rule the ticks flicker blue then grey.
- **FlashList v2 has no `inverted` and no `estimatedItemSize`.** Chat lists render chronologically
  with `maintainVisibleContentPosition.startRenderingFromBottom` and load older messages through
  `onStartReached`.
- **Media uploads before the message is enqueued** (`services/sync/uploads.ts`). A message row
  with no object behind it renders as a broken bubble on the other device and cannot be repaired.
- Per-page joins, never per-bubble queries: `useConversation` fetches attachments and reactions
  for the whole page in two queries and joins them in memory.
- The `react-hooks` lint rules are strict here and usually right: no `setState` inside an effect
  body, no `Date.now()` or ref reads during render, and dependency arrays must be simple
  expressions. When one fires, the fix is a better design (submit from the event handler, read
  duration from the recorder, render a child that initialises its state on mount, collapse an
  array dependency to a string first) rather than a disable comment.
- **Realtime and the outbox start once, at the root** (`hooks/useAppSync.ts`), not on a screen.
  An outbox that only drains while the chat list is mounted is not an outbox.
- **Realtime is not a sync strategy on its own.** It carries what happens while connected;
  `services/sync/bootstrap.ts` carries everything from before — `pullChats` on session ready,
  `pullMessages` when a conversation opens.
- **Membership changes are narrated by Postgres**, not the client (`0003_groups.sql`). The person
  being removed has to see "Anna removed you" too, and by then they are running no code that
  could have written it.
- Group management is enforced by triggers, not only by policies: RLS cannot compare OLD and NEW,
  which is exactly what "a member may update their own row but not their own `role`" needs.
- Sender name colours come from `colors.messaging.senderTints`, indexed by a hash of the user id
  (`senderTintIndex`). Indexing by list position would repaint everyone when one person joins.
- **Status expiry is enforced twice, on purpose.** The RLS policy filters `expires_at > now()`,
  which is what makes an expired post unreadable; the client filter is what makes it disappear
  from a screen that is already open. Neither alone is enough.
- **Time-driven state needs a clock.** `useLiveQuery` re-reads on SQLite writes, and nothing is
  written when a deadline passes — `useStatus`'s minute clock is what moves it.
- Full-screen playback progress rides a Reanimated shared value, never React state: re-rendering
  a video surface every frame to move a progress bar is how a smooth screen becomes a stuttering
  one.

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
