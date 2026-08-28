---
name: Tide System
colors:
  surface: '#f5faff'
  surface-dim: '#d1dbe4'
  surface-bright: '#f5faff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eaf5fe'
  surface-container: '#e5eff8'
  surface-container-high: '#dfeaf2'
  surface-container-highest: '#d9e4ec'
  on-surface: '#131d23'
  on-surface-variant: '#3c4a3d'
  inverse-surface: '#283238'
  inverse-on-surface: '#e8f2fb'
  outline: '#6c7b6b'
  outline-variant: '#bbcbb9'
  surface-tint: '#006d2f'
  primary: '#006d2f'
  on-primary: '#ffffff'
  primary-container: '#25d366'
  on-primary-container: '#005523'
  inverse-primary: '#3de273'
  secondary: '#006686'
  on-secondary: '#ffffff'
  secondary-container: '#68cffe'
  on-secondary-container: '#005773'
  tertiary: '#006d33'
  on-tertiary: '#ffffff'
  tertiary-container: '#3bd172'
  on-tertiary-container: '#005426'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#66ff8e'
  primary-fixed-dim: '#3de273'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005322'
  secondary-fixed: '#c0e8ff'
  secondary-fixed-dim: '#70d2ff'
  on-secondary-fixed: '#001e2b'
  on-secondary-fixed-variant: '#004d66'
  tertiary-fixed: '#6efe98'
  tertiary-fixed-dim: '#4ee07f'
  on-tertiary-fixed: '#00210b'
  on-tertiary-fixed-variant: '#005225'
  background: '#f5faff'
  on-background: '#131d23'
  surface-variant: '#d9e4ec'
typography:
  nav-title:
    fontFamily: Be Vietnam Pro
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 22px
  chat-name:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 20px
  message-body:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 20px
  timestamp:
    fontFamily: Be Vietnam Pro
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  button-text:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  section-header:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  edge-margin: 16px
  stack-xs: 4px
  stack-sm: 8px
  stack-md: 12px
  bubble-padding-h: 12px
  bubble-padding-v: 8px
  list-item-height: 72px
  avatar-size-lg: 48px
  avatar-size-sm: 32px
---

## Brand & Style

The design system is engineered for a utility-first mobile messenger experience that prioritizes speed, privacy, and clarity. It follows a **Modern Corporate** aesthetic with strong influences from mobile-native communication standards, emphasizing high-density information layouts and familiar interaction patterns.

The brand personality is efficient and reliable. It avoids unnecessary decorative elements, opting instead for functional surfaces, precise iconography, and a clear visual hierarchy. The emotional response should be one of "invisible utility"—the interface recedes to let the conversation take center stage.

Key stylistic markers include:
- **Flat Surface Architecture:** Use of tonal backgrounds instead of heavy shadows to define depth.
- **Micro-interactions:** Focus on status indicators (ticks) and subtle haptic feedback triggers.
- **Utility-First:** Visual priority is given to unread states, message status, and active call indicators.

## Colors

The color system utilizes a functional palette optimized for long-duration reading and high-contrast accessibility.

- **Primary Action:** Vivid Green (#25D366) is reserved for the most important actions: FABs (Floating Action Buttons), unread badges, and active toggle states.
- **Messaging Bubbles:** In light mode, outgoing messages use a pale green tint (#D9FDD3) to differentiate from the pure white incoming bubbles. In dark mode, a deep teal (#005C4B) is used for outgoing content.
- **System States:** Message delivery is tracked via a specific semantic set:
    - **Pending:** Grey clock icon.
    - **Sent/Delivered:** Grey single/double ticks.
    - **Read:** Blue double ticks (#53BDEB).
- **Surface Hierarchy:** Backgrounds use subtle shifts in grey/teal-greys to separate the chat list from the navigation bars and settings groups.

## Typography

This design system uses a dense but comfortable typographic scale designed for mobile screens. **Be Vietnam Pro** is selected for its contemporary feel and excellent legibility at small sizes.

- **Weights:** Usage is strictly limited to Regular (400) for message content, Medium (500) for list titles, and Semi-Bold (600) for navigation headers and primary buttons.
- **Hierarchy:** The system prioritizes the "Chat Name" and "Message Body" roles. 
- **Alignment:** Bubbles use standard leading, while labels and timestamps are tightly tracked to save vertical space.
- **Mobile Specifics:** On mobile devices, the primary reading size is locked at 15px/16px to maximize the amount of text visible per "screen-fold" in a conversation thread.

## Layout & Spacing

The layout follows a **Fluid Grid** model with fixed horizontal margins of 16px. 

- **Vertical Rhythm:** A strict 4px/8px baseline grid is used. Elements within a chat list item (name, snippet, time) are spaced with 4px, while the items themselves are separated by hairline dividers.
- **Chat Interface:** Message bubbles occupy up to 75% of the screen width. A 12px horizontal padding inside bubbles ensures text doesn't feel cramped against the bubble tails.
- **Density:** This is a high-density system. List items are 72px tall to allow for 8-9 conversations to be visible on a standard mobile viewport.
- **Safe Areas:** Adhere strictly to mobile OS safe-area insets for the message input field and the top navigation bar.

## Elevation & Depth

This design system avoids traditional shadows in favor of **Tonal Layers** and **Hairline Outlines**.

- **Depth via Color:** The navigation bar and input area are often defined by a background color that slightly differs from the main canvas (e.g., #F7F8FA against #FFFFFF).
- **Separators:** 0.5px to 1px hairline borders (#E9EDEF in light, #232D36 in dark) are the primary tool for defining sections in settings and chat lists.
- **Floating Elements:** The only element permitted to use a shadow is the Floating Action Button (FAB) or high-level Modals. The shadow should be minimal: `0px 4px 12px rgba(0, 0, 0, 0.08)`.
- **Active States:** Selection is indicated by a subtle grey background fill rather than an elevation change.

## Shapes

The shape language is "Soft" but disciplined, creating a professional yet approachable feel.

- **Message Bubbles:** A specific 7.5px corner radius is used for all four corners. If a bubble "tail" is used, the corner adjacent to the screen edge is kept at 0px or 2px.
- **Cards/Containers:** Standard cards in settings or info panes use an 8px radius.
- **Full Round:** Avatars, unread badges, and primary action buttons (pills) always use a 100% (pill) radius to distinguish them from content containers.
- **Icons:** 1.7px stroke weight with rounded caps and joins to match the soft-cornered UI.

## Components

### Buttons
- **Primary:** Pill-shaped, #25D366 background, white text. No shadow.
- **Ghost:** Text-only for secondary actions in navigation bars (e.g., "Edit", "Cancel").

### Message Bubbles
- **Outgoing:** Right-aligned, colored (#D9FDD3 light / #005C4B dark). Includes integrated timestamp and tick status in the bottom right corner.
- **Incoming:** Left-aligned, white or dark grey (#202C33).

### Inputs
- **Chat Input:** A full-width bar with a 20px+ corner radius (pill-shaped). Contains icon buttons for attachments and camera on the left/right edges.
- **Search:** Subtle grey background, 10px radius, with an inline magnifying glass icon.

### Avatars
- Always circular. Includes a 1px inner border for white avatars to prevent blending into light backgrounds.

### Badges
- **Unread Count:** Small circular badge in Primary Green (#25D366) with white centered text. 
- **Status Dot:** 10px circle located at the bottom-right of avatars for online presence.

### Icons
- 1.7px stroke line icons. Avoid filled icons unless indicating an active/selected state in the Bottom Tab Bar.