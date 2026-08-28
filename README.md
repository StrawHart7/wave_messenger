# Wave Messenger

A production-grade mobile messenger (WhatsApp-class UX) built with React Native + Expo.

> Status: repository initialized. No application code yet — next step is Phase 1 of [PLAN.md](PLAN.md).

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
PLAN.md             8 phases, exit criteria per phase, risk register
design-reference/   Stitch-generated screens: screen.png + code.html per screen
  tide_system/      DESIGN.md — the design system (tokens, type, spacing, components)
docs/
  BUILD_SPEC.md     What to build, how to verify it, what is out of scope
  UI_BRIEF.md       The visual brief the reference screens were generated from
```

`design-reference/` is the visual source of truth. Every screen implemented must be compared
against its `screen.png` and iterated on until near-identical — see the loop in `docs/BUILD_SPEC.md`.

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
npx expo start
```

A development build is required (not Expo Go) — `react-native-webrtc` and MMKV need native modules.

## Scope

In: 1:1 and group chat, media, voice notes, reactions and replies, presence and typing, receipts,
voice and video calls, Status/Updates, privacy settings enforced server-side.

Out: end-to-end encryption, payments, Business features, channel publishing, store release config.
