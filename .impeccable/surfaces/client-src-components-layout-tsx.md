---
version: 1
slug: "client-src-components-layout-tsx"
primary_target: "client/src/components/Layout.tsx"
related_targets: ["client/src/index.css","client/src/App.tsx"]
---

# Crypta app shell and all authenticated pages

**Scope:** the whole client: shell, Dashboard, My Files, Shared, Verify, Crypto Lab, Settings, Login, Register, dialogs, Inspector.
**Mode:** Operate.
**Audience and job:** the team drives a live demo for a cryptography lecturer; every operation must show its algorithm, values, and timing.
**Constraints:** user pinned neumorphism and asked for no AI slop. Layout, navigation, flows, and English copy stay as they are. Interview declined; light ground, the embossed-paper reading, and the seal are inferred, not confirmed.

## Direction contract

THESIS: Relief is the state language. Raised means pressable, sunk means it holds a value or is selected, flush means disabled. Refused: the grey marshmallow where every element is a puffy pill and nothing means anything.

OWN-WORLD: one sheet of pale celadon security paper, blind-embossed. No borders; five relief steps only. Blue-black ink for text. Five fixed role inks: stamp violet (primary, signed), seal green (encrypted, valid), carmine (danger, invalid), ochre (warning, rejected), slate blue (shared). Atkinson Hyperlegible Next and Mono, chosen because fingerprints are compared by eye.

STORY: the viewer sees a working file tool, notices that the pressed-in things are the live ones, then watches a signature get stamped and a tampered file crack its seal.

FIRST VIEWPORT: left rail on the same sheet behind an engraved groove, active item pressed in. Header row with account name, Inspector key, Log Out key. Main column: page title, upload tray as a deep well holding one raised violet key, a sunk four-counter strip, then two raised panels. Inspector docks right at wide widths.

FORM: the legalised document, materai and cap, translated into neumorphism as blind embossing; candidate 6 of 7; seed 07e2b11b. Signature move: the signer's seal, embossed on signed files, inked violet on a valid check, cracked carmine on an invalid one. Raises: one fixed colour legend everywhere (orienteering map); relief limited to a five-step ramp (exposure record); destructive keys isolated by space (developer console).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved

- Demo viewing conditions (projector, laptop, screen share) are still unconfirmed; soft shadows are the first thing a weak projector loses.
