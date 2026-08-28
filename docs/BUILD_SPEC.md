# Build a production-grade WhatsApp clone (React Native + Expo)

## Role & posture

You are a senior mobile engineer building a complete, working WhatsApp clone — not a demo, not a UI kit. You write code, run it, look at it, and keep fixing it until it is indistinguishable from the real app to someone holding the phone.

You are NOT here to produce a plan document, a "here's how you would build it" outline, or a scaffold full of `// TODO: implement`. Every phase you declare complete must run on a simulator and be verified by a screenshot or a passing test. Do not stop after the first implementation.

## Objective

A cross-platform (iOS + Android) messaging app that reproduces WhatsApp's UI to the pixel and its behavior to the interaction: real accounts, real-time 1:1 and group messaging, media, voice notes, voice/video calls, and a Status/Updates tab — with a real backend, not fixtures.

## Stack (fixed — do not substitute)

* React Native via **Expo SDK 54+**, TypeScript strict, Expo Router (file-based, typed routes)
* **Supabase** for auth (phone OTP), Postgres, Realtime (Postgres changes + broadcast + presence), and Storage for media — ASSUMPTION: chosen for you; if you have a concrete reason to prefer another BaaS, say so in one paragraph before writing code, then proceed with Supabase unless I object
* **Zustand** for client state, **TanStack Query** for server state, **MMKV** for key-value cache
* **expo-sqlite** as the local message store — the UI reads from SQLite, never directly from the network. Realtime writes into SQLite; SQLite drives the list. This is what makes the app feel instant
* **FlashList** for every long list (chats, messages, contacts)
* **Reanimated 3 + Gesture Handler** for every animation and gesture
* `react-native-webrtc` + a Supabase Realtime signalling channel for calls (Expo dev client, not Expo Go)
* `expo-notifications` for push, `expo-audio` for voice notes, `expo-image` for media, `expo-haptics` for feedback
* Nativewind or StyleSheet — your call, but ONE styling system across the whole app

Assume I will create the Supabase project and put `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`. Do not scaffold your own auth server, do not write a custom Node backend, do not add Firebase.

## Visual specification — treat these as exact values

**Source of truth: `design-reference/`.** `design-reference/tide_system/DESIGN.md` holds the full token set (colors, type scale, spacing, shape, component rules) — read it before writing `theme/tokens.ts`. Each `design-reference/<screen>/` holds a `screen.png` and the `code.html` that produced it. The values below are a summary; where they differ from the reference, the reference wins.

WhatsApp 2025+ look, both themes fully implemented, system-following with a manual override in Settings.

**Light**
* App background `#FFFFFF`; grouped/settings background `#F7F8FA`; header `#FFFFFF` with an `#E9EDEF` hairline
* Primary green `#25D366`; pressed `#1FAD55`; FAB `#25D366` with a white glyph
* Outgoing bubble `#D9FDD3`; incoming bubble `#FFFFFF` with a soft shadow, not a border
* Primary text `#111B21`; secondary/timestamp `#667781`; link `#027EB5`
* Chat wallpaper: pale `#EFE7DE` with the faint doodle pattern (ship a tiled asset; do not leave it flat)

**Dark**
* App background `#0B141A`; header and tab bar `#111B21`; elevated sheets `#202C33`
* Outgoing bubble `#005C4B`; incoming bubble `#202C33`
* Primary text `#E9EDEF`; secondary `#8696A0`; separators `#222D34`; accent `#21C063`
* Chat wallpaper: `#0B141A` with the doodle pattern at ~4% opacity

**Geometry & type**
* Bubbles: `7.5px` radius, `2px` on the tail corner of a grouped run; max width 75% of screen; padding `8px 12px`; `4px` vertical gap inside a run, `8px` between runs from different senders
* Message body 15px/20px regular; timestamp 11px/14px; chat-list name 16px/20px medium; nav title 17px/22px semibold; section header 13px/18px; button text 14px/18px semibold
* Avatars: 48px in the chat list, 40px in group message rows, 32px in headers, 96px on info screens; chat-list rows are 72px tall; edge margin 16px on a 4/8px baseline grid
* List-row separators inset to start at the text, never at the screen edge
* Tick states inside the bubble, right of the timestamp: clock (pending) → single grey `#667781` (sent) → double grey (delivered) → double blue `#53BDEB` (read)
* Bottom tab bar with Chats / Updates / Communities / Calls; active pill behind the icon on Android
* Font: **Be Vietnam Pro** (via `expo-font`/`@expo-google-fonts/be-vietnam-pro`), weights 400/500/600 only

**NOT** a generic Material chat template. **NOT** rounded-20px iMessage bubbles. **NOT** a purple or blue accent anywhere. **NOT** centered headers on Android. **NOT** an app that only looks right in light mode.

## Screens & behavior to build

Build every screen listed. Under each, the components and the interactions are both requirements.

1. **Onboarding** — welcome, country picker + phone entry, 6-digit OTP with auto-advancing boxes and a resend timer, profile setup (name + avatar via image picker with crop)
2. **Chats tab** — search bar that collapses on scroll; filter chips (All / Unread / Favorites / Groups); rows with avatar, name, last-message preview with sender prefix and media icon, timestamp, unread badge, muted/pinned icons; swipe row to Archive; long-press context menu (Pin, Mute, Delete, Mark unread); Archived row at top; FAB to new chat
3. **Conversation** — the hardest screen, get it right:
   * Header: back + avatar + name + presence line ("online" / "last seen today at 14:32" / "typing…"), video-call, voice-call, overflow menu
   * Inverted FlashList, date separators, "Unread messages" divider, per-sender name colors in groups
   * Bubble types: text with inline link and emoji handling, image/video with progress overlay, voice note with waveform + playback-speed toggle, document card, contact card, location, sticker, GIF, deleted-message tombstone, system messages
   * Reply-swipe (drag a bubble right → composer shows the quoted preview); long-press → reaction bar (👍 ❤️ 😂 😮 😢 🙏 + plus) and action sheet (Reply, Forward, Copy, Star, Delete, Info)
   * Composer: auto-growing input, emoji/GIF button, attachment sheet (Gallery, Camera, Document, Contact, Location, Poll), camera shortcut, mic button that becomes a send button when text is present, hold-to-record voice note with slide-to-cancel and lock-to-hands-free
   * Typing indicator, scroll-to-bottom pill with unread count, read receipts propagating live
4. **New chat / contacts** — device contacts matched against registered users, alphabetical sections, "Invite" rows for non-users, New group / New community entry points
5. **Group creation & Group info** — member picker with chips, subject + icon, then an info screen with description, media grid, mute, encryption row, member list with admin badges, add/remove, exit
6. **Contact info** — avatar hero that collapses on scroll, media/links/docs grid, mute, block, report
7. **Updates tab** — Status: "My status" row, Recent and Viewed sections, ring-avatar list; full-screen status viewer with segmented progress bars, tap-to-advance, hold-to-pause, swipe-up viewer list, reply composer; status composer for photo, video, and text-on-color. Channels can be a static list — do not build channel publishing
8. **Calls tab + call UI** — history rows with in/out/missed arrows, tap to call back; full-screen outgoing and incoming call UI with ringing state, mute/speaker/video toggles, camera switch, PiP self-view, duration timer, group-call grid; system-style incoming call notification
9. **Settings** — profile edit, Account, Privacy (last seen, profile photo, read receipts — with the toggles actually enforced server-side, not just stored), Chats (theme, wallpaper picker), Notifications, Storage with per-chat usage bars

Adapt where a detail doesn't map cleanly onto Expo, but never silently drop an item — list anything you skipped and why at the end of the phase.

## Data & realtime rules

* Schema at minimum: `profiles`, `chats`, `chat_members`, `messages`, `message_receipts`, `reactions`, `attachments`, `status_posts`, `status_views`, `calls`. Row Level Security on every table — a user reads only chats they belong to. Write the policies; do not leave RLS off "for now"
* Optimistic send: the message hits SQLite and the UI in `pending` state before the network call; reconcile on server ack; the retry queue survives an app restart and an airplane-mode toggle
* Realtime: new messages, receipts, reactions, and presence/typing (broadcast + presence channels; typing debounced and auto-expiring after 5s)
* Media: compress client-side, upload to Storage with progress, store the path not a signed URL, generate thumbnails, cache aggressively through expo-image
* Pagination: 40 messages per page, cursor-based, scroll-back with no visual jump

## Method — how you work

1. **Phase the work** and finish phases in order. After each, the app must run and be verifiable: (1) project + navigation + theme tokens, (2) auth + profile, (3) chat list + conversation with real messaging, (4) media + voice notes, (5) groups + info screens, (6) Status/Updates, (7) calls, (8) settings + privacy enforcement + polish pass
2. **Extract design tokens once**, in `theme/tokens.ts`, from the hex values above. Never hardcode a color, radius, or spacing value in a component. If you catch yourself typing `#25D366` outside that file, stop and fix the token
3. **Run and look, every phase.** Start the app (`npx expo start`, iOS simulator preferred), navigate to what you just built, take screenshots. Compare them against `design-reference/<screen>/screen.png` — the Stitch reference set is the visual source of truth and outranks this document wherever they disagree. Each folder also has a `code.html` you can read for exact structure and values. Then: list every visual difference you can see → fix them → screenshot again → compare again → repeat. Be strict about small things: bubble tail shape, tick color and size, header height, avatar diameter, the exact grey of a timestamp, separator inset
4. **Verify behavior, not just pixels.** For messaging, prove it: run two sessions (simulator plus a second device or browser session), send a message, and show me it arriving live, the ticks turning blue, and the typing indicator firing — screenshots or a log of the realtime events
5. **Write tests where they pay**: message-state reducer, optimistic-send reconciliation, offline queue, receipt logic, date grouping. Run them; never leave a failing test behind
6. **When something is ambiguous**, pick the behavior real WhatsApp has, note it in one line as an ASSUMPTION, and keep moving. Do not stop to ask me about details you can decide
7. **When I'm vague or wrong**, push back: 2–3 concrete options, your recommendation, and the trade-off. Do not agree with me by default
8. **Commit per phase**, with a message describing what is now demonstrably working

## Out of scope — do not build

* End-to-end encryption / Signal protocol. Use TLS + RLS, and treat the encryption rows in the UI as cosmetic
* Payments, Communities beyond a stub tab, Business features, channel publishing, Meta AI
* App Store / Play Store release config, production push certificates, CI/CD, analytics, crash reporting
* A custom backend server, a web client, a desktop client
* The WhatsApp name, logo, or wordmark anywhere user-facing — pick a placeholder product name and your own green icon

## Definition of done

The app runs on both an iOS and an Android simulator from a clean `npm install`, and:

* Two real accounts can register, find each other, and exchange text, photos, and voice notes in a 1:1 and a group chat, in real time, with correct tick progression and typing indicators
* Killing the app and reopening it restores the full conversation instantly from SQLite, offline
* A voice call and a video call connect between two devices
* A status post is published, viewed, and shows up in the viewer list
* Light and dark mode are both complete — no unstyled or wrong-colored surface in either
* Screenshots of Chats, Conversation, Group info, Status viewer, and Call UI in both themes are near-identical to the spec / reference images
* `npx tsc --noEmit` is clean, lint is clean, tests pass

Finish with: a README covering setup and the Supabase schema migration, the screenshot set, and a short list of everything you deliberately skipped or approximated.
