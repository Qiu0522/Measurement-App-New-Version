# Room Measurement App (standalone)

A fresh, independent app built around room/unit-based measurement — free-form
named sides, memory of your last selection, auto-copy of sides to new rooms,
and two auto-sort methods (by position or by angle). Completely separate code
and data from the original Field Measurement app — nothing here touches that
app's files or its saved data.

## Deploying

Push this whole folder to a new GitHub repo (or any static host) and open
`index.html`. No build step. Enable GitHub Pages if you want a shareable URL
for testing on other devices.

## What's included

- **Import PDF or image** as a backdrop, or work on a blank canvas
- **Rooms**: add/rename/recolor/delete (delete offers to move points to
  another room first, or a new one, before permanently deleting — with an
  explicit count so you know what you're deleting)
- **Custom side names per room**, remembered as the default until you switch;
  a new room automatically starts with the previous room's sides already in
  place (remove any that don't apply with the small × on each tag)
- **The keypad** — same ported design from the main app (number pad + tap-a-
  fraction, Cancel/OK sized to match)
- **Auto Sort** — pick one or more sides in a room, then either:
  - **Straight wall**: left-to-right / right-to-left / top-to-bottom / bottom-to-top
  - **Curved wall**: clockwise / counterclockwise by angle around the group's
    center (handles the wrap-around seam automatically)
- **Labels** toggle — switch between showing the raw value or the
  `Room-Side-Seq` order label (e.g. `901-1-8`)
- **CSV export** — one row per point: Room, Side, Seq, Label, Value, Excluded
- **Autosaves** to this device's local database (IndexedDB) — saves on every
  change, when the tab is backgrounded/closed, and every 3 minutes as a
  backstop
- **Works offline** once loaded once (service worker caches the app itself)

## What's intentionally left out of this round

- No multi-project "library" — this tool holds exactly **one** project at a
  time. Use **New** (top-left) to clear it and start a different
  building — there's no way to switch back afterward, so make sure you've
  exported any CSV you need first.
- No markup/drawing tools (pen, highlighter, text notes)
- No exporting an annotated PDF
- No backup/restore to move a project between devices

If the room/side/sort logic feels right after testing this, the next step
would be deciding how (or whether) to fold the validated parts into the main
app, or just keep using this as its own separate tool — up to you.

## A few implementation notes

- The angle-sort math is the same logic already verified earlier (center
  point + largest-gap seam detection), re-verified again here with a fresh
  simulation before shipping.
- Every point from every room renders on the same canvas at once (color-coded
  by room) — same as how the main app shows every data type together. Editing
  a point automatically switches the active room to that point's own room, so
  the side panel always matches whichever point you're actually editing.
- Deleting a room, or deleting a side tag that still has points, always shows
  the exact count before anything is permanently removed.
