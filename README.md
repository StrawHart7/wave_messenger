# Wave Messenger

A production-grade mobile messenger (WhatsApp-class UX) built with React Native + Expo.

> Status: **Phases 1-3** — theme system and primitives; Supabase schema with RLS, phone-OTP auth
> and onboarding; SQLite store, chat list, conversation, optimistic outbox and realtime.
> Phases 4-8 in [PLAN.md](PLAN.md).

## Stack

| Layer | Choice |
|---|---|
| App | React Native, Expo SDK 54+, TypeScript strict, Expo Router |
| Backend | Supabase — phone-OTP auth, Postgres + RLS, Realtime, Storage |
| Local store | expo-sqlite (source of truth for the UI) + MMKV |
| State | Zustand (client) + TanStack Query (server) |
| Lists | FlashList |
| Motion | Reanimated 3 + Gesture Handler |
| Calls | react-native-webrtc over a Supabase Realtime signalling channel |

## Repository layout

```
app/                Expo Router — (auth)/, (tabs)/, chat/[id]
components/         ui/ primitives, auth/, chat/ (bubbles, rows, composer)
db/                 SQLite: schema, connection, chat and message queries
hooks/              useLiveQuery (SQLite -> React), useChats, useMessages
theme/              tokens.ts (mirrors DESIGN.md), fonts.ts, ThemeProvider
services/           supabase, auth, phone, contacts, media, storage seam,
                    messageState, grouping, chatList, realtime/, sync/
stores/             session (Zustand)
supabase/migrations/  schema + RLS, storage buckets + policies
PLAN.md             8 phases, exit criteria per phase, risk register
design-reference/   Stitch-generated screens: screen.png + code.html per screen
  tide_system/      DESIGN.md — the design system (tokens, type, spacing, components)
docs/
  BUILD_SPEC.md     What to build, how to verify it, what is out of scope
  UI_BRIEF.md       The visual brief the reference screens were generated from
```

`design-reference/` is the visual source of truth. Every screen implemented must be compared
against its `screen.png` and iterated on until near-identical — see the loop in `docs/BUILD_SPEC.md`.

## How the data flows

The UI reads from SQLite and nothing else. Sending writes an optimistic row and returns; the
outbox drains it to Supabase in the background; realtime writes what comes back into SQLite;
`useLiveQuery` re-reads and the screen updates. One direction, one source of truth — which is
why the app renders instantly offline and why an app kill mid-send loses nothing.

## Design system

Tokens live in `design-reference/tide_system/DESIGN.md` and get mirrored once into `theme/tokens.ts`.
Never hardcode a color, radius or spacing value in a component.

Key values: primary `#25D366` · outgoing bubble `#D9FDD3` (light) / `#005C4B` (dark) ·
read ticks `#53BDEB` · bubble radius `7.5px` · list item height `72px` · edge margin `16px` ·
type Be Vietnam Pro.

## Getting started

```bash
npm install
cp .env.example .env   # fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run verify         # typecheck + lint + tests
npx expo start
```

### Supabase

Create a project, then apply the migrations in order (SQL editor, or `supabase db push`):

```
supabase/migrations/0001_init.sql     tables, RLS policies, public_profiles view, triggers
supabase/migrations/0002_storage.sql  avatars / media / status buckets and their policies
```

Then enable **Phone** auth with an SMS provider. The app runs without credentials — it shows the
auth flow and reports a clear error on submit — so the project stays developable before the
backend exists.

**No builds.** EAS builds, `expo run:*` and `expo prebuild` are off the table while the project
is in test mode. Anything needing a native module (MMKV, WebRTC) sits behind a driver seam —
see `services/storage.ts` — so it can be swapped in when a development build exists.

## Scope

In: 1:1 and group chat, media, voice notes, reactions and replies, presence and typing, receipts,
voice and video calls, Status/Updates, privacy settings enforced server-side.

Out: end-to-end encryption, payments, Business features, channel publishing, store release config.
