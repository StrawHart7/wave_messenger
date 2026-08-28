# Wave Messenger — Implementation Plan

Sequential phases. **A phase is done when its exit criteria are demonstrably met** — app running, screenshot compared against `design-reference/`, tests green. Never start phase N+1 with phase N unverified.

Reference documents: [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md) (what and how), [design-reference/tide_system/DESIGN.md](design-reference/tide_system/DESIGN.md) (tokens — the source of truth).

---

## Target architecture

```
app/                      Expo Router — file-based routes
  (auth)/                 phone, otp, profile-setup
  (tabs)/                 chats, updates, communities, calls
  chat/[id].tsx           conversation
  chat/[id]/info.tsx      contact / group info
  status/[userId].tsx     full-screen status viewer
  call/[id].tsx           active call
  settings/               index, privacy, chats, notifications, storage
components/
  chat/                   Bubble, MessageList, Composer, ReactionBar, VoiceNote…
  ui/                     Avatar, Badge, ListRow, Pill, Sheet, Ticks…
theme/                    tokens.ts, ThemeProvider, useTheme
db/                       schema.sql (SQLite), migrations, queries, mappers
services/
  supabase.ts             client
  realtime/               messages, presence, typing, calls signalling
  sync/                   outbox, receipts, reconciliation
  media/                  compression, upload, cache
stores/                   Zustand: session, chats, drafts, call
supabase/migrations/      Postgres schema + RLS policies
```

**The one architectural rule everything else follows:** the UI reads from SQLite only. Network and realtime write into SQLite; SQLite emits to the UI. No screen ever awaits a network call to render.

---

## Phase 1 — Foundation

Expo + TypeScript strict + Expo Router skeleton, dev client build (WebRTC and MMKV need native modules — Expo Go will not work from phase 7 onward, so establish the dev client now).

- `theme/tokens.ts` transcribed from `DESIGN.md`: colors (light + dark), typography roles, spacing, radii, elevation. Nothing hardcoded anywhere else, ever.
- `ThemeProvider` + `useTheme()`, system-following with a manual override persisted in MMKV.
- Be Vietnam Pro loaded via `@expo-google-fonts/be-vietnam-pro` (400/500/600), splash held until fonts resolve.
- Primitives: `Avatar`, `Badge`, `ListRow`, `Pill`, `Ticks`, `Sheet`, `Icon` (1.7px stroke set).
- Bottom tab bar with the four tabs, correct active/inactive treatment, empty placeholder screens.
- ESLint + Prettier + `tsc --noEmit` + Jest wired into `npm run verify`.

**Exit:** `npm run verify` green (typecheck + lint + 10 tests), theme resolves both schemes and
persists a preference, tab bar and app bar built from tokens.

> **Done, with one criterion outstanding.** The original exit criterion "boots on iOS and Android
> simulators" is unmet: the project is in no-build mode, so nothing has been run on a device or
> simulator yet. Everything else is verified. Carry this forward — the first `expo start` will
> surface runtime issues (font loading, Reanimated plugin, router entry) that static checks cannot.

## Phase 2 — Backend & auth

- Supabase project, `supabase/migrations/0001_init.sql`: `profiles`, `chats`, `chat_members`, `messages`, `message_receipts`, `reactions`, `attachments`, `status_posts`, `status_views`, `calls`.
- RLS on every table from the start. Core predicate: a user reads a row only if they are a member of the chat it belongs to. Write the policies with the schema, not after.
- Phone OTP auth; session persisted in MMKV; auth-state routing guard in `app/_layout.tsx`.
- Screens: phone entry, OTP, profile setup → against `phone_entry_polished`, `otp_verification_polished`, `profile_setup_polished`.
- Contact sync: hash device numbers, match registered users, cache locally.

**Exit:** two real accounts register on two devices, land on an empty Chats tab, and survive an app restart without re-authenticating. RLS verified by attempting a cross-account read and getting zero rows.

> **Code complete, verification outstanding.** Everything above is written and passes
> `npm run verify` (32 tests). Nothing has been run against a live Supabase project — no
> credentials yet — so the migrations are unapplied and no account has ever signed in. To close
> this phase: create the project, put the URL and anon key in `.env`, apply
> `supabase/migrations/`, enable phone auth with an SMS provider, then register two accounts and
> attempt a cross-account read.
>
> Deviations from the plan, both deliberate:
> - Session persistence uses the `services/storage.ts` seam (AsyncStorage today), not MMKV — no
>   dev build. Supabase's auth-storage contract matches the seam exactly.
> - Contact sync ships as two modules: pure normalisation in `services/contacts.ts`, device and
>   network work in `services/contactSync.ts`. Native imports cannot be unit-tested.

## Phase 3 — Messaging core *(the phase that decides whether this app feels real)*

- SQLite schema + query layer + reactive subscriptions feeding FlashList.
- Chats list: search, filter chips, unread badges, pin/mute/archive, swipe actions, long-press menu, FAB → against `chat_list_polished` and `chat_list_interaction_light`.
- Conversation: inverted FlashList, date separators, grouped bubble runs with tails, quoted replies via swipe, composer, scroll-to-bottom pill → against `1_1_conversation_polished`.
- Outbox: optimistic insert in `pending`, server ack reconciliation, retry queue persisted across restarts and airplane-mode toggles.
- Realtime: new messages, typing (broadcast, debounced, 5s expiry), presence, receipt propagation with correct tick progression.
- Cursor pagination, 40/page, no scroll jump.

**Tests:** message-state reducer, outbox reconciliation, offline queue, receipt transitions, date grouping.

**Exit:** two devices exchange text in real time; ticks go clock → grey → double grey → blue; typing indicator fires; force-quit and reopen restores the full thread instantly with the network off.

## Phase 4 — Rich content

- Media: pick/capture, client-side compression, upload with progress, thumbnails, `expo-image` cache, full-screen viewer.
- Voice notes: hold-to-record with slide-to-cancel and lock, waveform, playback with speed toggle → against `recording_voice_note_light`.
- Attachment sheet (Gallery, Camera, Document, Contact, Location, Poll) → against `attachment_sheet_light`.
- Reactions: long-press bar, reaction pills on bubbles, action sheet → against `reaction_action_state_light`.
- Remaining bubble types: document, contact, location, sticker/GIF, deleted tombstone, system messages.

**Exit:** every bubble type renders correctly in both themes; a 12 MB video and a 45s voice note both send, upload with visible progress, and play back on the other device.

## Phase 5 — Groups

- Group creation flow (member picker with chips, subject, icon).
- Group conversation: sender avatars, per-sender name colors, 3-line header with member list and typing attribution, "Unread messages" divider → against `group_conversation_polished`.
- Group info: media grid, mute, member list with admin badges, add/remove, exit → against `group_info_light`.
- Contact info screen with collapsing hero.
- Membership changes as system messages; admin permissions enforced in RLS, not just hidden in the UI.

**Exit:** a 3-member group exchanges messages, an admin adds and removes a member, a non-admin is refused server-side.

## Phase 6 — Updates / Status

- Updates tab: My status row, Recent/Viewed sections with ring avatars → against `updates_status_light`.
- Status composer: photo, video, text-on-color.
- Full-screen viewer: segmented progress, tap-advance, hold-pause, swipe-up viewer list, reply-to-status routing into the conversation.
- 24h expiry (scheduled cleanup + client-side filtering; never rely on the client alone).

**Exit:** a status is posted, seen by the second account, appears in the viewer list, and disappears after expiry.

## Phase 7 — Calls

- WebRTC peer connection, signalling over a Supabase Realtime channel (offer/answer/ICE), TURN configured.
- Outgoing, incoming, and active call UI, PiP self-view, controls, duration timer → against `incoming_call_light` and `calls_active_call_light`.
- Calls tab history with in/out/missed glyphs.
- CallKit / ConnectionService-style incoming notification via `expo-notifications`.
- Group call grid (deferred to last — 1:1 must be solid first).

**Exit:** voice and video calls connect between two physical devices on different networks, with audio and video both directions and a correctly logged history row.

## Phase 8 — Settings, privacy & polish

- Settings tree and Privacy detail screen → against `settings_privacy_polished`.
- Privacy toggles **enforced in RLS and in the realtime payloads**: hiding last seen must actually stop the data leaving the server, not just hide the label.
- Wallpaper picker, notification preferences, storage usage per chat.
- Full polish pass: every screen re-screenshotted in both themes and diffed against `design-reference/`; haptics; accessibility labels; empty, loading and error states everywhere.

**Exit:** the full definition-of-done checklist in `docs/BUILD_SPEC.md` passes.

---

## Working rules

1. **Screenshot loop, every phase.** Build → run → screenshot → list every difference against `design-reference/<screen>/screen.png` → fix → repeat. Do not stop at the first implementation.
2. **Commit per phase**, message describing what is now demonstrably working. Push after each phase.
3. **Ambiguity:** pick the behavior real WhatsApp has, note it as an `ASSUMPTION` line in the phase summary, keep moving.
4. **Never defer RLS.** A table ships with its policies or it does not ship.
5. **Deviation from `design-reference/` requires a written reason** in the phase summary. "It was easier in React Native" is not one.

## Risk register

| Risk | Mitigation |
|---|---|
| WebRTC + Expo native config is the classic time sink | Dev client from phase 1; spike a bare 1:1 audio call early, before building any call UI |
| Realtime + SQLite reconciliation gets subtly wrong under bad networks | Reducer is pure and unit-tested; test with airplane mode and forced app kills every phase |
| Phone OTP costs and rate limits during development | Supabase test numbers in dev; real SMS only at phase verification |
| Inverted FlashList + Reanimated gestures fight each other | Isolate the message list in a spike before wiring reply-swipe and long-press together |
| Scope creep from WhatsApp's long tail of features | The out-of-scope list in `docs/BUILD_SPEC.md` is closed; additions need an explicit decision |
