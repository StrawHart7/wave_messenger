# UI screen generation brief — "Wave" messenger (WhatsApp-grade mobile app)

> Swap the product name "Wave" for your own before generating. Everything else is ready to paste.
> Run it three times: once for **Sheet A (design system)**, once for **Sheet B (light screens)**, once for **Sheet C (dark screens)** — see *Output* at the bottom. Generating all 16 screens in one image will mush the detail.

---

Generate an image of a complete mobile app UI design system and screen set for **Wave** — a fast, private, everyday messaging app for family, friends and small groups. Not a startup concept, not a dribbble poster: this should look like screenshots pulled straight from a shipped app used by a billion people.

Wave lets people: message 1:1 and in groups, send photos and videos, record voice notes, react to and reply to individual messages, make voice and video calls, share 24-hour status updates, see who's online and typing, and manage granular privacy settings.

## Design Style

* Utility-first messaging aesthetic — dense, fast, familiar. Function reads before decoration
* One vivid green accent against neutral surfaces. Color appears only on the send button, the FAB, unread badges, active toggles, and the outgoing bubble. Everything else is greyscale
* Flat surfaces, hairline separators, almost no shadow except a soft one under the FAB and message bubbles
* Small radius everywhere: `7.5px` bubbles, `8px` cards, full-round only on pills, avatars and the FAB
* Comfortable but tight rows — a chat list shows ~9 conversations on screen without feeling cramped
* System typography (SF Pro / Roboto). Regular and medium weights only; no display type, no serifs
* Simple line icons, ~1.7px stroke, rounded caps
* The chat wallpaper is a very faint tiled doodle pattern of small line-drawn objects, never a photo or a gradient
* **NOT** a purple/blue SaaS palette. **NOT** big rounded 20px iMessage bubbles. **NOT** glassmorphism, neumorphism, or gradient mesh backgrounds. **NOT** an illustrated onboarding-heavy "friendly startup" look. **NOT** oversized whitespace or editorial layouts — this is a tool, not a magazine

## Color Palette

**Light**
* `#FFFFFF` primary surface, `#F7F8FA` grouped/settings background
* `#25D366` primary green, `#1FAD55` pressed
* `#D9FDD3` outgoing bubble, `#FFFFFF` incoming bubble
* `#111B21` primary text, `#667781` secondary text and timestamps, `#E9EDEF` separators
* `#027EB5` links, `#53BDEB` blue read-receipt ticks
* `#EFE7DE` chat wallpaper base with the doodle pattern in a slightly darker warm grey

**Dark**
* `#0B141A` app background, `#111B21` header and tab bar, `#202C33` sheets and incoming bubbles
* `#005C4B` outgoing bubble, `#21C063` accent
* `#E9EDEF` primary text, `#8696A0` secondary text, `#222D34` separators
* `#0B141A` chat wallpaper with the doodle pattern at ~4% white

## Typography & recurring elements

* Chat-list name 17px medium, preview 14.5px `#667781` truncated to one line, timestamp 11px right-aligned
* Message text 16px, timestamp 11px bottom-right *inside* the bubble
* Tick glyphs recur everywhere and must be drawn correctly: small clock = pending, one grey check = sent, two grey checks = delivered, two blue `#53BDEB` checks = read
* Avatars: 49px chat list, 40px in group message rows, 32px in headers, 96px on info screens
* Separators are inset — they start at the text, not the screen edge
* Recurring micro-labels: "online", "last seen today at 14:32", "typing…", "0:14", "Today", "Yesterday", "Unread messages", "1 new message"

## Screens

Draw each as a realistic iPhone-sized frame with a status bar. Fill every one with plausible real content — real-sounding names, real message text, believable timestamps — never lorem ipsum and never `<placeholder>`.

1. **Phone number entry** — country dropdown row, phone field with prefix, small legal line, green "Next" button
2. **OTP verification** — 6 separate digit boxes with the caret in the third, "Resend code in 0:42", auto-detected-SMS hint
3. **Profile setup** — circular avatar picker with a camera badge, name field, green continue button
4. **Chats list (main screen)** — search pill at top; filter chips "All / Unread / Favorites / Groups" with All active; an "Archived · 3" row; ~9 conversation rows mixing 1:1 and groups, some with green unread badges, one pinned with a pin glyph, one muted with a crossed bell, previews showing sender prefix ("Marco: "), a camera icon + "Photo", a mic icon + "0:24"; green FAB with a new-message glyph bottom-right; bottom tab bar Chats (active, badge 4) / Updates / Communities / Calls
5. **Chats list — swipe & long-press state** — one row dragged left revealing the Archive action, and a context menu open over another row (Pin, Mute, Delete, Mark as unread)
6. **1:1 conversation** — header with back, avatar, name, "online"; wallpaper visible between bubbles; a "Today" date separator; a run of grouped outgoing bubbles with tails only on the last; a quoted-reply bubble with the green left bar and truncated original; a photo bubble with the timestamp overlaid on the image; a voice-note bubble with waveform, play button, "0:18" and a "1×" speed chip; two blue-tick and one grey-tick message; composer with emoji button, "Message" placeholder, attach clip, camera, and a round green mic button
7. **Conversation — reaction & action state** — a bubble lifted with the emoji reaction bar above it (👍 ❤️ 😂 😮 😢 🙏 ⊕) and the action sheet below (Reply, Forward, Copy, Star, Delete, Info); the rest of the screen dimmed
8. **Conversation — recording a voice note** — the composer replaced by a red pulsing dot, running timer "0:07", "‹ slide to cancel", and a lock chevron above the mic
9. **Group conversation** — 3-line header ("Design crew" + member-name list, "Anna is typing…"), incoming bubbles with 40px avatars and per-sender colored names, one message with a reaction pill (👍 3) hanging off the bubble corner, a system message "Sam added Leo", and a "Unread messages" divider
10. **Attachment sheet open** — the conversation dimmed behind a bottom sheet grid: Gallery, Camera, Document, Contact, Location, Poll — each a colored round icon with a label
11. **Group info** — collapsed hero with 96px group avatar, name, "Group · 8 members"; description block; rows for Media/links/docs with a 3-thumbnail preview, Mute, Encryption, Disappearing messages; "Add member" row; member list with "You" and two "Admin" badges; red "Exit group" and "Report group"
12. **Updates tab** — "My status" row with a + badge and "Tap to add status update"; "Recent updates" with 3 ring-avatar rows (unviewed = green ring, viewed = grey ring) and "12 minutes ago"; a "Channels" section below with 3 channel rows and a follow button
13. **Status viewer (full-screen)** — a photo filling the frame, 4 segmented progress bars at top with the second partly filled, author avatar + name + "35m ago", a dark gradient at the bottom, "Reply" input pill and a swipe-up chevron with "142 views"
14. **Calls tab + in-call** — split this frame in two: left, the calls list with in/out/missed arrow glyphs, names, "Today, 09:12", and phone/video icons on the right; right, an active video call — full-bleed remote video, rounded PiP self-view top-right, name and "07:42" timer, and a bottom control row (speaker, video off, mute, flip camera, red end-call)
15. **Incoming call** — full-screen blurred avatar background, large 120px avatar, name, "Wave video call", slide-to-answer or decline/accept round buttons
16. **Settings** — profile row with avatar, name and status line; grouped rows with leading icons: Account, Privacy, Chats, Notifications, Storage and data, Help, Invite a friend; footer "from Wave"
17. **Privacy settings detail** — rows "Last seen and online", "Profile photo", "About", "Status" each with a right-aligned value ("Everyone", "My contacts"), toggle rows for "Read receipts" and "Typing indicators", and a "Blocked contacts · 2" row

Cover all 17. If two fit naturally in one frame (calls list + in-call above), pair them; do not invent extra screens to pad the sheet.

## Output

Produce three images, all sharing one design system:

* **Sheet A — design system**: the palette swatches with hex labels, type scale, the tick states, bubble anatomy in both themes, avatar sizes, icon set, buttons, chips, badges, and the tab bar in active/inactive states
* **Sheet B — light mode**: screens 1–17 as a tidy grid of iPhone frames on a neutral `#EDEDED` backdrop, each labeled underneath in small grey text
* **Sheet C — dark mode**: screens 4, 6, 7, 9, 11, 12, 14, 16 redrawn in the dark palette on a `#1A1A1A` backdrop

## Direction

This should look like a real screenshot set from a mature messaging app that a billion people already have installed — confident, fast, neutral, restrained, familiar, dense with real content, unmistakably functional rather than decorative. Nothing on screen should look "designed"; it should look *used*. High-fidelity iPhone mockups, pixel-accurate spacing, crisp text, no marketing chrome.
