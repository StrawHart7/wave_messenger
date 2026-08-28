# What was deliberately skipped or approximated

`docs/BUILD_SPEC.md` asks the build to finish with an honest list of what was not
done. This is that list. Nothing here is an oversight — each entry is a decision,
with the reason.

## The big one: nothing has been run

**No part of this app has executed.** There is no Supabase project, so the six
migrations are unapplied and no account has ever signed in; nothing has been
launched on a simulator or a device. The project has been in no-build mode
throughout at the user's instruction, to conserve Expo build quota.

What *is* verified: `npm run verify` — `tsc --noEmit`, ESLint, and 232 Jest tests
covering every pure module (message state, grouping, chat-list rules, waveforms,
reactions, attachments, group permissions, status lifecycle, call state, settings
and preferences).

What that cannot tell you: whether a bubble is 2px off, whether the audio session
opens, whether the FlashList scroll anchor behaves, whether a call connects. The
verification loop the spec asks for — build, screenshot, diff against
`design-reference/`, fix, repeat — has never run. **Treat every screen as
unreviewed against its reference image.**

To change that: create the Supabase project, fill `.env`, apply
`supabase/migrations/` in order, enable phone auth with an SMS provider, then
`npx expo start`.

## Calls

- **Incoming calls do not reach a killed app.** A killed app has no socket, so no
  amount of local-notification code helps. Real ringing needs a push notification
  plus CallKit (iOS) and ConnectionService (Android): a development build, an
  APNs/FCM key, and a server-side trigger. What ships works in the foreground, and
  in the background while the socket is alive.
- **Group calls are refused, not half-built.** A mesh of peer connections is
  different engineering, and it waits until 1:1 is proven on hardware.
- **No TURN server is configured.** `.env.example` carries the variables. Without
  them roughly one call in five fails to connect — always the ones on mobile data,
  never the ones on the office wifi where it gets tested.
- **WebRTC needs a development build.** `react-native-webrtc` is native and absent
  from Expo Go; every call surface says so rather than failing silently.

## Messaging

- **No end-to-end encryption.** Explicitly out of scope from the first prompt.
  Messages are protected by RLS and TLS, not by keys the server cannot read. The
  group-info screen's "Encryption" row in the reference is therefore not built.
- **Location and poll attachments are stubs.** A map surface and a vote model are
  each their own feature, not a variation on sending a file. Contact sharing *is*
  built (phase 5).
- **Message editing and starred messages** are not built; neither is in the spec's
  feature list.
- **Search is a filter over the local chat list**, not a message-content search.
  Searching message bodies across chats wants an FTS index, which is a schema
  decision worth making deliberately rather than in a polish pass.

## Status

- **Expired storage objects are orphaned.** `delete_expired_status()` sweeps the
  rows hourly under pg_cron; the objects behind them need a scheduled Edge
  Function, which is not written. Expired posts are unreadable regardless — the
  RLS policy filters `expires_at`.
- **pg_cron may not be enabled.** Both sweeps (status, stale calls) schedule
  themselves only when the extension exists, and raise a notice otherwise, rather
  than failing the migration on a fresh project.
- **The status ring is continuous, not segmented per post.** Instagram segments it;
  WhatsApp does not, and arcs around a 48px circle are hairlines nobody can read.

## Privacy

- **Typing indicators cannot be enforced server-side the way a table row can.**
  A Realtime broadcast payload has no RLS. The enforcement is therefore that the
  setting stops the *outgoing* broadcast — nothing leaves the device — with the
  receiving-side filter as a second line. Presence, which is durable, *is* enforced
  by a trigger that refuses to store it.
- **Blocking hides and prevents; it does not erase.** A blocked person's existing
  messages stay in the thread. Retroactively deleting history is a different and
  more destructive decision than the button implies.
- **"Report" does nothing.** There is no moderation backend to report to, and a
  button that pretends to file a report is worse than one that is honestly absent.
  It is left visible to match the reference and does not claim to have worked.

## Platform and build

- **MMKV is replaced by a driver seam over AsyncStorage** (`services/storage.ts`).
  MMKV is native; swapping it in is a one-file change once a development build
  exists.
- **TanStack Query is not used.** The stack listed it, but the architecture makes
  it redundant: the UI reads from SQLite and `useLiveQuery` is a
  `useSyncExternalStore` over a write revision. A second cache layer would be a
  second source of truth to keep in step.
- **Communities is still a stub.** It is in the tab bar because the reference has
  four tabs, and out of scope everywhere else in the spec.
- **The app icon and splash assets are placeholders.**

## Design

- **Bubble radius is 12px, not the 7.5px in `DESIGN.md`'s prose.** The polished
  conversation screens draw 12, and the source-of-truth hierarchy puts the screens
  above the prose.
- **Wallpapers are solid tints, not photographs.** A set of images would add
  megabytes to the bundle for something most people change once.
- **Font-size preference is stored but not yet applied** to the type scale; wiring
  it through `ThemeProvider.type()` is a small change that was not made because it
  cannot be checked without running the app.
- **The reference's desktop split-pane layouts are ignored.** Every reference
  screen renders a phone and a tablet pane side by side; this is a phone app.
