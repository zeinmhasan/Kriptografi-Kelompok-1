---
name: Crypta
description: Secure File Storage & Digital Signature Platform, set as blind-embossed security paper.
colors:
  ground: "oklch(0.905 0.014 165)"
  well: "oklch(0.88 0.016 165)"
  line: "oklch(0.8 0.022 170)"
  ink: "oklch(0.25 0.03 265)"
  ink-soft: "oklch(0.37 0.03 262)"
  ink-muted: "oklch(0.46 0.025 255)"
  stamp: "oklch(0.42 0.17 290)"
  stamp-lit: "oklch(0.48 0.18 290)"
  seal: "oklch(0.42 0.095 165)"
  alert: "oklch(0.44 0.17 22)"
  warn: "oklch(0.44 0.095 70)"
  share: "oklch(0.43 0.1 245)"
typography:
  title:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
  data:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  key: "10px"
  well: "12px"
  card: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "28px"
components:
  button-primary:
    backgroundColor: "{colors.stamp}"
    textColor: "#ffffff"
    rounded: "{rounded.key}"
    padding: "8px 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.stamp-lit}"
  button-key:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    padding: "8px 14px"
    height: "36px"
  button-key-pressed:
    backgroundColor: "{colors.well}"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.card}"
  well:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.well}"
---

# Design System: Crypta

## Overview

**Creative North Star: "The Blind-Embossed Document"**

One sheet of pale celadon security paper, pressed rather than printed. Nothing has a border. Shape comes from relief alone, lit from the top left, so the interface is neumorphic in the strict sense: every element is the paper itself, raised or sunk. The look comes from legalised documents, where the stamp and the embossed seal are what make a signature count.

Relief is the state language, and it is the rule that keeps the soft look from turning into undifferentiated marshmallow. **Raised means pressable. Sunk means it holds a value or is currently selected. Flush means disabled.** A viewer learns this once and can read any screen.

The one signature move is the signer's seal, built from real data (signer name, head and tail of the key fingerprint, signing date). It sits embossed and uninked on a signed file, inked violet when a verification passes, and cracked carmine when it fails.

**Key Characteristics:**
- Single light celadon ground; no borders anywhere.
- Five relief steps and no other shadows.
- Five fixed role inks; each colour means one thing everywhere.
- Hyperlegible type chosen because fingerprints and hashes are compared by eye.
- Dense, operational layout; the world never changes navigation or controls.

## Colors

A cool paper ground with blue-black ink and five role inks, each used only for its meaning.

### Primary
- **Stamp Violet** (oklch(0.42 0.17 290)): primary actions, the signed state, selection text, progress bars. It is the stamp-pad ink and the only colour that asks to be pressed.

### Secondary
- **Seal Green** (oklch(0.42 0.095 165)): encrypted, valid, success.
- **Carmine** (oklch(0.44 0.17 22)): destructive actions, invalid signatures, errors.
- **Ochre** (oklch(0.44 0.095 70)): warnings and rejected tamper results.
- **Slate Blue** (oklch(0.43 0.1 245)): shared.

### Neutral
- **Celadon Paper** (oklch(0.905 0.014 165)): the ground and every raised surface.
- **Celadon Well** (oklch(0.88 0.016 165)): the fill of sunk surfaces, inputs, and the selected state.
- **Groove** (oklch(0.8 0.022 170)): the engraved line used as a divider.
- **Ink / Ink Soft / Ink Muted** (oklch(0.25 0.03 265), (0.37 0.03 262), (0.46 0.025 255)): text. Computed contrast on the ground is 12.1, 7.9 and 5.4; every role ink is at least 6.0 on the ground.

### Named Rules
**The One Meaning Rule.** A role ink is never borrowed for decoration. Green is not "nice", violet is not "brand"; each marks exactly the state named above.

**The Tinted Neutral Rule.** Greys carry the ground's hue. Pure grey and pure black do not appear.

## Typography

**Body and Title Font:** Atkinson Hyperlegible Next (variable, self-hosted via @fontsource)
**Data Font:** Atkinson Hyperlegible Mono (variable, self-hosted)

**Character:** Built for telling similar characters apart, which is the exact job of comparing a key fingerprint or a hash. Slashed zeros show in every number.

### Hierarchy
- **Title** (600, 1.5rem, 1.25): page titles.
- **Body** (400, 0.875rem, 1.5): all running text, capped at 68ch.
- **Label** (400, 0.75rem): field terms and hints, in Ink Muted.
- **Data** (mono, 0.75rem, 1.625): hex, hashes, fingerprints, counters, durations, always with tabular figures.

### Named Rules
**The Data-Only Mono Rule.** Mono is for hex, numbers and measured values. It is never used to make a word look technical.

## Layout

A fixed left rail (14rem) and a sticky 4rem header share the sheet with a centred main column (max 64rem). The rail and header are separated from the page by an engraved groove, not a surface change. At 1280px and wider the Inspector docks as a 26rem column beside the page; below that it lifts over the page. On narrow screens the rail becomes a horizontally scrolling strip with a faded right edge. Spacing steps are 8, 16 and 28px; related content sits tight and groups are separated by 28px.

## Elevation & Depth

Depth is relief, not shadow. Every shadow is a pair: a light edge to the upper left and a dark edge to the lower right, tinted to the ground.

### Shadow Vocabulary
- **Float** (`-6px -6px 18px light, 12px 16px 38px dark`): the Inspector overlay on narrow screens and toasts.
- **Raised** (`-5px -5px 12px light, 6px 6px 14px dark`): panels, and keys on hover.
- **Key** (`-2px -2px 5px light, 3px 3px 7px dark`): resting buttons and small controls.
- **Sunk** (`inset 2px 2px 5px dark, inset -2px -2px 5px light`): inputs, selected items, pressed keys, badges.
- **Sunk Deep** (`inset 4px 4px 10px dark, inset -4px -4px 10px light`): the upload tray.

### Named Rules
**The Five-Step Rule.** No shadow exists outside this list. A new state is expressed by choosing a step, never by inventing one.

**The No-Stack Rule.** A raised panel never sits on a raised panel. Inside a raised panel, content is flush or sunk.

## Shapes

Soft but not pill-shaped: keys 10px, wells 12px, panels 16px. Circles are reserved for the lock mark, step numbers and the seal. Dividers are engraved grooves (a dark line over a one-pixel light line). A transparent 1px border exists on interactive surfaces only so that forced-colors and high-contrast modes can draw an outline; it is invisible otherwise.

## Components

### Buttons
- **Shape:** 10px radius, minimum height 36px.
- **Key (default):** Celadon Paper fill, Key relief. Hover moves to Raised; pressed or expanded moves to Sunk on the Well fill; disabled goes flush with muted text.
- **Primary:** Stamp Violet fill with white text. Hover lightens to Stamp Lit; pressed goes Sunk.
- **Destructive:** a normal key with carmine text, separated from neighbours by space (right-aligned on desktop, its own row on mobile).

### Inputs / Fields
- **Style:** Well fill, Sunk relief, 10px radius, no border.
- **Focus:** a 2px Stamp Violet outline with no offset. **Disabled:** 60% opacity.
- **Error:** shown as a Well-filled alert in carmine text above the action, with `role="alert"`.

### Navigation
- **Style:** text keys on the paper. The current page is pressed in (Sunk on Well) with violet text; hover raises a Key.
- **Mobile:** a scrolling strip with a faded right edge.

### Segmented control and selected rows
Unselected segments are raised keys; the selected one is pressed in. Selected rows in lists follow the same rule.

### Badges and counters
Badges are small sunk labels coloured by role ink. The dashboard counters are one sunk well divided by engraved grooves.

### Signer's Seal (signature component)
A 120-unit circular seal with RSA-PSS · SHA-256 along the top arc, the head and tail of the key fingerprint along the bottom, and the signer and date in the centre. Embossed (an uninked disc with one light and one dark edge), inked Stamp Violet and pressed in with a short rotation on a valid verification, and carmine and split along a diagonal on an invalid one.

### Inspector trace
Steps are a numbered timeline: sunk step numbers on an engraved line, an algorithm badge, a duration, a sunk progress bar scaled to the slowest step, and data in mono.

## Do's and Don'ts

### Do:
- **Do** let relief carry state: raised to press, sunk for a value or the selected item, flush for disabled.
- **Do** draw every shadow from the five-step list.
- **Do** keep one meaning per role ink, and keep text at 4.5:1 or better on both Celadon Paper and Celadon Well.
- **Do** put fingerprints and hashes in the data font and group fingerprints in fours.
- **Do** leave visible space around destructive keys.

### Don't:
- **Don't** add a visible border; use an engraved groove or a relief step.
- **Don't** place a raised panel on a raised panel.
- **Don't** use a role ink for decoration or reuse one for a second meaning.
- **Don't** use gradients, glass, or glow; depth here is paper relief only.
- **Don't** make light-on-light relief carry meaning without a text or icon label: relief edges are low contrast by nature, so every control keeps a visible label.

## Known drift (not canonised)
- The Inspector's file-name line was removed because it duplicated the history select and acted as a kicker.
- The scale of the paper-and-seal metaphor beyond the seal itself (no paper grain, no ruled lines) is a deliberate omission for an operating screen, not an unfinished part.
