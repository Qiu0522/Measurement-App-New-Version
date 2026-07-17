# Flexible Room Prototype

Standalone test build for the "room number + custom side naming + position/angle
auto-sort" workflow discussed for apartment/balcony-style measurements. This is
fully separate from the main Field Measurement app — no shared code, no shared
data, safe to test without any risk to the app already in use.

## How to use it

Just open `index.html` directly in a browser (double-click it, or push this
folder to a new GitHub repo and enable GitHub Pages — either works, no build
step needed).

1. **Room / Unit** — start with room "901" already there. Add more with
   "+ 新房间", rename or delete as needed.
2. **面 (side)** — name your own sides (面1, 面2...). Whichever one you tap
   stays selected as the default for new points until you tap another one.
3. **Click on the canvas** to drop a point — you'll be asked for a test value.
   Optionally upload a floor plan image first as a visual backdrop.
4. **Auto Sort panel** (right side / below on mobile) — pick position-based
   (left-right / right-left / top-bottom / bottom-top) or angle-based
   (clockwise / counterclockwise) sorting, tick which sides to apply it to,
   and hit Sort. Labels update live in the format `room-side-seq`
   (e.g. `901-1-8`).

## What's intentionally simplified for speed

- Uses plain `prompt()`/`confirm()` dialogs for entering values and renaming —
  not the nicer keypad/modal UI from the main app.
- No PDF import — optional plain image upload only, for visual reference.
- Data is saved to this browser's local storage only (per-device, not
  synced) — good enough for testing the logic, not meant for real field use.
- No offline install / service worker — just a plain page.

## What's carried over exactly as designed/verified

- The angle-sort algorithm (center point + largest-gap seam detection) is the
  literal same logic already verified against test cases in the main app
  conversation — same math, same behavior.
- The "side tags remember last selection" behavior matches how the main app's
  side selection already works.

If this feels right after testing, the plan is to fold the validated parts
(free-form side naming with memory, room-based grouping, sort method choice)
into the main app as an additional mode, without touching the existing
compass-based (N/E/S/W) workflow already in use there.
