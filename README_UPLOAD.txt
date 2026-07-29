FIELD MEASUREMENT VERSION 6.11.3-NEW

VERSION 6.11.3-NEW — AUTO SORT METHOD SMART-DEFAULT + "NO AREA" RESTRUCTURE
- Auto Sort now defaults to "Curved wall" (angle-based) instead of
  "Straight wall" whenever a project has custom (non-N/E/S/W) side
  labels. The straight-wall method hardcodes which literal axis N/E/S/W
  run along, which only holds for real compass geometry — once sides are
  renamed to something like 1/2/3/4, that assumption may no longer match
  the actual shape and can silently sort wrong without erroring. Angle-
  based has no such assumption. This is only a starting suggestion: the
  moment you pick a method yourself in a project, that choice sticks for
  the rest of the session, project after project reopen included.
- Restructured the Area Picker: "No Area" is no longer a row in the same
  list as real areas. It's now a separate "✕ No area for new points"
  control above the list, visually distinct rather than styled as a peer
  of actual named areas — matching how a point with no area was already
  treated as a quiet default everywhere else (the label, CSV export).
- Verified live: method defaults to angle after a side rename, reverts
  to respecting an explicit choice once one is made, and the Area Picker
  list contains zero rows when no areas are defined (previously it always
  showed at least the "No Area" row). Full regression suite re-run clean
  afterward.
- sw.js CACHE_VERSION bumped to v1-v2-36-method-default-area-ui.

FIELD MEASUREMENT VERSION 6.11.2-NEW

VERSION 6.11.2-NEW — IMPORT FILE: SELECT MULTIPLE FILES AT ONCE
- Library > Import File now lets you select several .fmfile.json files in
  one go from the file picker, instead of one at a time.
- Every selected file is processed, even if one of them fails — a
  corrupt or unrecognized file no longer blocks the rest of the batch.
  One combined summary reports how many imported successfully and lists
  exactly which files (if any) failed and why.
- This is in addition to the existing bundled-multi-project single-file
  format, which still works the same as before.
- Verified live: exported two projects, deleted them, then re-imported
  both at once from a single file-picker selection — both reappeared
  correctly with one summary alert. Also tested a mixed batch (one valid
  file + one corrupt file): the valid one imported successfully and the
  corrupt one was reported clearly, without losing the good import.
- sw.js CACHE_VERSION bumped to v1-v2-35-multi-file-import.

FIELD MEASUREMENT VERSION 6.11.1-NEW

VERSION 6.11.1-NEW — ORDER LABEL: RENAME REFRESH FIX + AREA IN THE LABEL
- Found and fixed a real bug: renaming a side (e.g. N -> "1") updated the
  side-picker buttons and Auto Sort's dropdown immediately, but did
  nothing to the labels of points already placed on the canvas — they
  kept showing their old text until some unrelated redraw happened to
  touch them. Renaming now immediately refreshes every point's label.
- The on-canvas order label already used the "Side-Seq" dash format (e.g.
  "N-1") and already respected a renamed side's custom label — that part
  was working, just invisible while the refresh bug hid it.
- Area is now included directly in the order label when a point has one,
  merged onto the same line as the (up to 6-character) area name, e.g.
  "Room 1-N-3". A point with no area shows exactly the plain "N-3" —
  untouched — so "no area" stays a quiet default rather than a visible
  state of its own.
- Matching that same idea, CSV export's Area column now shows blank for
  points with no area instead of the literal text "No Area".
- Verified live: renaming a side updates an already-placed point's label
  immediately with no reload needed; an area-tagged point's label merges
  correctly with truncation ("Room 101" -> "Room 1-1-2"); CSV shows blank
  for no-area points and the full untruncated name for tagged ones. Full
  regression suite re-run clean afterward.
- sw.js CACHE_VERSION bumped to v1-v2-34-area-label-fix.

FIELD MEASUREMENT VERSION 6.11-NEW

VERSION 6.11-NEW — AREA: AN OPTIONAL LABEL ON TOP OF THE EXISTING SYSTEM
- Added Area as a lightweight, optional tag layered on top of the
  existing Data Type + Side system — not a replacement for it. Side
  assignment, the compass sort logic, and on-canvas point labels (e.g.
  "N3") all work exactly as before regardless of whether Areas are used
  at all.
  - Toolbar "Area" picker button next to Data Type. Pick a "current
    area" (or "No Area") and new points inherit it automatically — same
    pattern as picking a current Side.
  - Manage Areas modal: add, rename inline, or delete. Deleting an area
    never deletes or reassigns points — it just clears the tag, leaving
    them as "No Area".
  - Rename Sides modal: give N/E/S/W custom display labels (e.g. "Front
    Wall"). This is purely cosmetic — it changes what a human reads in
    the side picker, Auto Sort's side dropdown, and CSV headers/values;
    it does not touch the underlying letter codes, sort direction
    conventions, or point-label format.
  - Auto Sort gained an optional Area filter. Scoping a sort to one area
    leaves every other point on that same side — a different area, or no
    area — completely untouched, even when their points are physically
    interleaved along the same wall. (Reuses the same "fixed anchor"
    merge logic already proven by Auto Sort Review's per-point partial
    apply.)
  - CSV export gained an optional "Area" column, which only appears at
    all if the project actually has areas defined.
  - Review mode gained an optional Area filter, mirroring the existing
    Data Type filter, hidden unless the project has areas.
- All of the above stays completely out of the way for anyone who never
  uses Areas: the Area/Rename Sides UI adds one small toolbar button, and
  every dropdown/column that depends on areas existing stays hidden until
  an area is actually created.
- Verified live: area tagging and persistence, Area-scoped Auto Sort with
  two areas' points interleaved on the same wall (the harder case), CSV
  export with both the Area column and a renamed side flowing through
  correctly together with the fraction-protection from 6.10.5, and the
  Review Area filter's show/hide and point-filtering behavior. Re-ran the
  full existing regression suite (stress test, partial apply, curved-wall
  sort, method choice, no-data message, state reset) against a
  non-Area project to confirm zero behavior change for existing usage.
- sw.js CACHE_VERSION bumped to v1-v2-33-area-feature.

FIELD MEASUREMENT VERSION 6.10.6-NEW-3

VERSION 6.10.6-NEW-3 — FIXED UI STATE LEAKING BETWEEN PROJECTS
- Full-screen modals can't leak between projects since their backdrop
  blocks the Library button while they're open. But several lighter
  things that DON'T block navigation were staying "on" after returning
  to Library and opening a different project, including:
  - The Export and Markup dropdown menus staying open.
  - Review mode, batch-assign mode, and Show Order Labels staying on.
  - A leftover search term in the Preview CSV sidebar.
  - Various mid-gesture flags (pinch, drag, tap-to-reorder, drawing a
    markup stroke) that should never survive past the interaction that
    set them.
  - Undo/Redo history and button states from the previous project.
- closeProject() now resets all of this to its default state before the
  Library screen shows, so every project starts clean regardless of
  what was left open in whatever was open before it.
- Verified live: opened the Export menu, switched to Review mode, turned
  on batch-assign, and left text in the search box — then returned to
  Library and opened a new project. All four were correctly back to
  default, confirmed via undo/redo, mode buttons, and menu open-state
  checks.
- sw.js CACHE_VERSION bumped to v1-v2-32-state-reset-fix.

FIELD MEASUREMENT VERSION 6.10.6-NEW-2

VERSION 6.10.6-NEW-2 — FIXED CROSS-TALK WITH THE PRODUCTION APP'S "OPEN IN
ANOTHER TAB" WARNING
- The database/cache/localStorage isolation from the previous build
  wasn't quite complete: the "This app is open in more than one tab or
  window" detection uses its own BroadcastChannel, named
  "field-measurement-tabs" — a hardcoded name, not tied to the database
  name, and BroadcastChannel is scoped by name across the WHOLE origin,
  not per-app. So if this build and the production app were ever open at
  the same time on the same domain, they'd detect each other through
  this channel and both show the "multiple tabs" warning, even though
  their data was already completely separate.
- This build's channel is now named "field-measurement-tabs-new" instead,
  so it no longer cross-talks with the production app's tab detection at
  all. Detecting two real tabs of THIS SAME build still works correctly
  — that safety feature is unchanged, just no longer confused with the
  other app.
- Verified: a message on the old channel name no longer triggers the
  banner in this build, while opening two real tabs of this build still
  correctly warns as before.
- sw.js CACHE_VERSION bumped to v1-v2-31-tab-detection-fix.

FIELD MEASUREMENT VERSION 6.10.6-NEW

VERSION 6.10.6-NEW — SEPARATE APP: ISOLATED FROM THE PRODUCTION DATABASE
- This build is now a fully separate app from the current production
  version, so it's safe to run side-by-side without any risk to existing
  data:
  - IndexedDB database renamed from "FieldMeasurementV4" to
    "FieldMeasurementV4_New" — a completely separate store; this build
    will never read, write, or overwrite anything in the production
    database, and vice versa.
  - Cache Storage name changed to a "field-measurement-NEW-..." prefix,
    separate from production's "field-measurement-combined-..." prefix.
  - The "last backup" localStorage key is now "fm_new_lastBackupAt",
    separate from production's "fm_lastBackupAt", in case both are ever
    hosted on the same domain.
  - App title, home-screen title, and the in-app header now read "Field
    Measurement (New)" so it's visually unmistakable from the production
    app if both are installed at once (e.g. as separate home-screen
    icons on an iPad).
  - manifest.json name/short_name updated to match ("Field Measurement
    (New)" / "FM New").
- Practical effect: this build starts with an empty library the first
  time it's opened -- it does NOT see your existing production projects,
  since it's reading from a different database entirely. That's
  intentional. Use it to test freely; your production data and app are
  completely untouched no matter what happens here.
- Verified live: confirms only "FieldMeasurementV4_New" exists in
  IndexedDB after creating a project, with zero references to the old
  production database name anywhere in the code.

FIELD MEASUREMENT VERSION 6.10.6

VERSION 6.10.6 — CSV EXPORT: ADDED A CALCULATION-READY DECIMAL COLUMN
- The text-protected Measurement column from 6.10.5 fixed fractions
  turning into dates, but as text it can't be summed or averaged
  directly in Excel.
- CSV export now also includes a "[Data Type] Measurement (Decimal)"
  column with the same measurement converted to a plain number (e.g.
  "26 3/8" -> 26.375, "-1/2" -> -0.5). This is a genuine number with no
  "/" in it at all, so there's no date-misread risk and nothing special
  needed to protect it -- it's ready to sum, average, or otherwise
  calculate with immediately. Selecting that column in Excel and applying
  Format Cells > Fraction will display it the same way it's entered in
  the app (e.g. "26 3/8") while it stays numeric underneath.
  "X" (missing) measurements are left blank in this column, same as
  before.
- The original Measurement column (readable text, protected from being
  misread as a date) is unchanged and still included alongside it.
- sw.js CACHE_VERSION bumped to v1-v2-30-decimal-column.

FIELD MEASUREMENT VERSION 6.10.5

VERSION 6.10.5 — CSV EXPORT: FRACTIONS NO LONGER TURN INTO DATES IN EXCEL
- Any measurement containing a fraction (e.g. "26 3/8", "-1/2") was being
  auto-detected by Excel as a date when the CSV was opened, silently
  replacing it with a date serial number. Reformatting that cell as a
  fraction afterward didn't recover the original measurement — it just
  displayed the date's serial number as a fraction, which is the "becomes
  a large number" symptom, because by that point the real text is
  already gone.
- The Measurement column in CSV exports now writes any value containing
  "/" as a text-literal formula (e.g. ="26 3/8"), which tells Excel to
  treat it as plain text and display it exactly as typed, with no date
  or number reinterpretation. Plain numeric measurements (no fraction)
  are unaffected and stay as normal values.
- Verified against the app's actual fraction keypad output ("26 3/8",
  "36", "-1/2") by inspecting the real exported CSV bytes.
- sw.js CACHE_VERSION bumped to v1-v2-29-csv-fraction-fix.

FIELD MEASUREMENT VERSION 6.10.4

VERSION 6.10.4 — AUTO SORT: VISIBLE MESSAGE WHEN THERE'S NO DATA TO SORT
- Clicking "Sort" with a data type/side combination that has no assigned
  points previously appeared to do nothing: the Auto Sort modal stayed
  open (correctly), but the feedback ("No matching assigned points to
  sort.") only went to the status bar, which sits underneath the modal
  and was never visible while it was open.
- The Auto Sort modal now shows a clear inline message ("No data: there
  are no assigned points for [Data Type] on [Side].") right above the
  Sort/Cancel buttons whenever there's nothing to sort, so it's actually
  seen. The message clears automatically as soon as you change the Data
  Type or Side dropdown.
- sw.js CACHE_VERSION bumped to v1-v2-28-no-data-message.

FIELD MEASUREMENT VERSION 6.10.3

VERSION 6.10.3 — FIXED AUTO SORT REVIEW PANEL STAYING OPEN AFTER LEAVING
- The Auto Sort Review panel is a fixed-position overlay. If it was left
  open (without pressing Cancel or Apply) and you then switched to
  Measure mode, or tapped Library to leave the project, the panel stayed
  visible on top of whatever came next instead of closing with it —
  "the tab follows you" after leaving.
- Leaving Review mode for Measure mode, and closing/leaving a project
  (e.g. returning to Library), now automatically cancels any pending
  Auto Sort Review first — the panel closes, its temporary scroll-room
  reservation from 6.10.2 is released, and nothing is left showing after
  you've moved on. No data changes either way: a pending review was never
  applied to your points in the first place, so cancelling it here loses
  nothing.
- sw.js CACHE_VERSION bumped to v1-v2-27-review-exit-fix.

FIELD MEASUREMENT VERSION 6.10.2

VERSION 6.10.2 — AUTO SORT REVIEW: FIXED "CAN'T SCROLL FAR ENOUGH RIGHT"
- The 6.10.1 fix made Locate centre points within the visible area to the
  left of the review panel, but for a point near the drawing/PDF page's
  own right edge, that can call for MORE rightward scroll than the canvas
  actually has — there's no more page to scroll into, so the point got
  stuck as far right as the browser's scroll limit allowed, which could
  still be under or right at the edge of the panel.
- While the review panel is open, the drawing's scrollable area now
  temporarily reserves extra room equal to the panel's width, so there's
  always enough space to fully centre any point clear of the panel,
  including ones right at the page's edge. This extra space is removed
  again as soon as the panel closes, so normal editing/scrolling is
  unaffected.
- Verified with a point placed within 20-100 units of the canvas's right
  edge: previously this would hit the scroll limit and stay hidden under
  the panel; now it's pulled fully clear.
- sw.js CACHE_VERSION bumped to v1-v2-26-edge-scroll-fix.

FIELD MEASUREMENT VERSION 6.10.1

VERSION 6.10.1 — AUTO SORT REVIEW: PANEL SIZE AND LOCATE FIXES
- The Auto Sort Review panel was up to 470px wide with no viewport-relative
  cap, which could cover over half a tablet-width screen (e.g. ~61% on a
  768px-wide iPad in portrait) and hide points on the right side of the
  drawing. It now scales with the viewport (roughly 40% max on tablet
  widths, capped at 400px on desktop) so meaningfully more of the drawing
  stays visible while the panel is open.
- Clicking "Locate" on a change or warning centred the point using the
  FULL drawing viewport width, without accounting for the review panel
  sitting on top of the right portion of that same viewport — so the
  point could get centred right behind the panel. It now centres within
  only the portion of the drawing actually visible to the left of the
  panel, so the point reliably ends up somewhere you can see it. Verified
  at a tablet-width viewport: previously the panel covered ~61% of the
  screen, now ~42%, and located points land clearly in the visible area.
- sw.js CACHE_VERSION bumped to v1-v2-25-review-panel-fit.

FIELD MEASUREMENT VERSION 6.10

VERSION 6.10 — RESTORED SORT METHOD CHOICE + LESS NOISY WARNINGS
- Auto Sort's "Sort Method" choice (Straight wall / Curved wall) is back.
  Straight wall uses a plain coordinate sort with no centroid or angle math
  at all, so normal measurement jitter can never destabilize it — the
  reliable choice for any wall that's straight or close to it. Curved wall
  keeps the angle-around-room-centre approach from 6.9.1–6.9.4 for walls
  with real, visible curvature. This replaces the single automatic
  "always angle-based" approach, which could still occasionally recommend
  a wrong swap depending on room geometry (as bases 6.9.1-6.9.4 tried,
  imperfectly, to detect on their own).
- Reworked the Auto Sort Review geometric warnings, which were flagging
  far more points than were actually wrong:
  - The "far from the other points" check compared distance to the
    group's centroid, which is a poor fit for wall-shaped data — a point
    at the far end of a long straight wall is naturally far from the
    centroid without anything being wrong. It's replaced with a check for
    how far a point sits off the wall's own line/curve direction, which
    is a much more specific signal of an actual mis-assignment.
  - The "unusually large gap" check is removed entirely — it couldn't
    reliably tell a real ordering problem apart from normal uneven
    field-measurement spacing (dense points near a door/corner, sparse
    across a plain stretch of wall), so it produced warnings for
    completely normal layouts.
  - The "almost overlapping" and per-point dedup logic from 6.9.2 are
    unchanged.
- Also added: individual point-level partial apply in the Auto Sort
  Review — uncheck any single change to leave that point's number exactly
  as it was, while everything else still resequences around it. A
  rejected point acts as a fixed anchor; points on either side of it keep
  the new proposed relative order among themselves but can't cross past
  the anchor. A "select all" toggle and a live "Apply N of M" button
  label make it clear what will actually be committed.
- sw.js CACHE_VERSION bumped to v1-v2-24-method-choice.

FIELD MEASUREMENT VERSION 6.9.4

VERSION 6.9.4 — AUTO SORT: FIXED ROOM-CENTRE BIAS WITH UNEVEN POINT COUNTS
- The 6.9.3 fix (measuring angles around the whole room's centre instead
  of each side's own) had a gap: the room centre was a simple average of
  every point, so a side with a lot more points than the others (e.g. a
  wall with more doors/trim/fixtures measured) pulled the centre toward
  itself, weakening or reintroducing the same instability for whichever
  side had fewer points -- this is what was still causing a wrong swap
  recommendation (e.g. West's points 2 and 3) even after 6.9.3.
- The room centre is now the average of each side's OWN centroid, so
  every side counts equally regardless of how many points it has.
- Verified with unit tests reproducing this exact imbalance (many points
  on one side, few on the others) -- the old averaging failed with local
  swaps under this condition, the new per-side weighting did not -- and
  confirmed again in the full running app with an intentionally
  imbalanced room (sparse N/E/S, dense West).
- sw.js CACHE_VERSION bumped to v1-v2-23-center-weighting.

FIELD MEASUREMENT VERSION 6.9.3

VERSION 6.9.3 — AUTO SORT: FIXED STRAIGHT-WALL INSTABILITY
- Angle-based Auto Sort now measures each point's angle around the centre
  of the whole room (all sides of that data type together), not just the
  side being sorted. A straight wall's own centre sits almost exactly on
  the wall itself, which made the angle calculation for that side alone
  numerically unstable — tiny, normal measurement jitter perpendicular to
  the wall could flip two neighbouring points' relative angle and produce
  a wrong swap (e.g. a straight West wall recommending points 2 and 3 be
  swapped when they were already correct). Sides with real curvature
  (already fixed in 6.9.1) are unaffected by this change.
- Verified with unit tests (multiple jitter patterns on a straight wall,
  100% correct after the fix vs. failing on every pattern before it) and
  in a full running-app test with a real 4-sided room.
- sw.js CACHE_VERSION bumped to v1-v2-22-sort-stability.

FIELD MEASUREMENT VERSION 6.9.2

VERSION 6.9.2 — AUTO SORT REVIEW: FIXED REPETITIVE WARNINGS
- The "almost overlapping" check now compares points only within the same
  side, not across all selected sides at once. Previously, the last point
  of one side and the first point of the next side (which sit close
  together at a shared corner on purpose) were flagged as an error at
  every corner, every time — that's what caused the repeated warnings.
- Each point can now contribute at most one warning (the most severe one)
  instead of potentially showing up under "overlapping," "far from other
  points," and "large gap" all at once with near-identical wording.
- sw.js CACHE_VERSION bumped to v1-v2-21-warning-fix.

FIELD MEASUREMENT VERSION 6.9.1

VERSION 6.9.1 — AUTO SORT SWITCHED BACK TO ANGLE-BASED ORDERING
- Auto Sort's straight-axis (PCA) ordering has been replaced with
  angle-around-centre ordering (the same approach the app used before this
  round of merges). Points on a curved/bowed wall were coming out of order
  near the bend under the straight-axis method (e.g. E4/E5 and E6/E7
  swapped on a rounding wall) because it projects the whole side onto one
  straight line rather than following the curve.
- sw.js CACHE_VERSION bumped to v1-v2-20-autosort-angle.
- Auto Sort Review, the Review-mode data type filter, the library
  "Modified" badge, and export toasts from 6.9 are unchanged.

FIELD MEASUREMENT VERSION 6.9

VERSION 6.9 — AUTO SORT REVIEW + REVIEW DATA TYPE FILTER + WORKFLOW POLISH
- Auto Sort now uses a single principal-axis algorithm that handles both
  straight and curved walls automatically, replacing the old "straight wall
  vs curved wall" method choice.
- Auto Sort no longer applies instantly. It computes the new order and
  opens an Auto Sort Review panel first, listing every point whose visible
  Side/number would actually change, plus geometric warnings (near-
  overlapping points, isolated points, unusually large gaps). Nothing is
  written to the drawing until "Apply Auto Sort" is pressed. Cancelling
  leaves the drawing exactly as it was.
- Clicking a change or warning in the review list centers and briefly
  flashes that point in its current location; it never moves, recentres
  the view unexpectedly, or changes zoom.
- Applying Auto Sort is one single Undo/Redo action, regardless of how
  many data types/sides were included.
- Review mode toolbar has a new "Data Type" filter dropdown that dims
  every point except the selected data type directly on the drawing —
  in addition to the existing Preview CSV sidebar filter chips, which
  still work as before and now stay in sync with the toolbar dropdown.
  This filter is purely a display option; it never affects Auto Sort,
  which always considers every included point regardless of the filter.
- Library cards now show a friendly "Modified today / yesterday / N days
  ago" badge alongside the existing detailed last-updated timestamp.
- Export CSV and Export PDF now show a brief on-screen confirmation
  toast with the saved file name.
- sw.js CACHE_VERSION bumped to v1-v2-19-autosort-review so installed
  devices replace the older cached workspace.js, index.html and style.css.
- Existing saved projects, folders, and Move to Folder are unchanged.

VERSION 6.8.1 — IMPORTABLE WORKSPACE JSON + CACHE UPDATE
- Workspace > Export JSON now exports the same complete portable work-file
  format as Library > Export File, including the PDF and editable project state.
- Workspace JSON downloads use the .fmfile.json suffix and can be opened with
  Library > Import File.
- sw.js CACHE_VERSION bumped to v1-v2-13-importable-json so installed devices
  replace the older cached workspace.js and index.html.
- Service-worker registration now checks sw.js without relying on the browser's
  HTTP cache, making deployed updates more reliable on iPad/Safari.
- Existing saved projects and folders are not changed.

VERSION 6.8 — EXPORT JSON, PDF LABEL DEFAULT, FIND POINT BY LABEL, MOVE TO FOLDER
- Export menu now includes Export JSON alongside Export CSV and Export PDF.
  It writes the same points/side/seq/measurement data as CSV, grouped by
  Data Type, as a downloadable .json file.
- PDF export now always burns in the measurement value on each point label,
  regardless of whether "Show Order Labels" is currently toggled on in the
  workspace view. The on-screen toggle still works for live viewing; it just
  no longer changes what gets exported to PDF.
- Review ("Preview CSV") sidebar has a new search box: type a label (e.g. N3)
  or a measurement value to filter the list live, or press Enter to jump
  straight to the first match and flash it on the drawing.
- Library: added "Move to Folder…" to the file/folder ⋯ menu. Lets you move
  an existing work file or folder into any other folder (including newly
  created ones) without drag-and-drop, which does not work reliably on
  iPad/Safari. A folder cannot be moved into itself or one of its own
  subfolders.
- No changes to saved project/folder data structure — existing work files
  open exactly as before.
- sw.js CACHE_VERSION bumped to v1-v2-12 so installed iPads pick up this
  update on their next online launch.

VERSION 6.7 — TOOLBAR, ICONS, AND COLOUR SYSTEM
- First row: Library and project name on the left; Zoom, Fit, Undo, Redo, Save, and Export on the right.
- Second row: Data Type, Point, Lock, Order, Batch Side, Labels, and the Markup dropdown.
- Replaced mixed emoji controls with consistent line icons.
- Added a professional cool-gray and engineering-blue colour system; Save remains green.
- Fit now calculates a best-fit zoom for the visible workspace.

VERSION 6.6.1 — COLLAPSIBLE MARKUP MENU
- Text, Highlighter, Eraser, Color, and Size are grouped inside Markup.
- Selecting a tool closes the panel and the Markup button shows the active tool.
- Color and size choices keep the panel open for quicker adjustment.

VERSION 6.6 — TEXT + MISSING VALUE
- Removed Pen and added a Text tool with small, medium, and large sizes.
- Text uses the selected annotation colour, supports Undo/Redo, saves with the project, and exports to PDF.
- Added an X button beside SPACE for missing measurements. X uses the current Data Type colour and exports to CSV normally.
- Highlighter and Eraser remain available.
- Service-worker cache version bumped so deployed devices receive the update.

PREVIOUS VERSION HISTORY
================================

UPLOAD THESE FILES TO THE SAME GITHUB FOLDER:

1. index.html
2. style.css
3. db.js
4. workspace.js
5. app.js
6. manifest.json

IMPORTANT:
- All six files must be in the same folder.
- Do not rename the JavaScript or CSS files.
- The main page must be named exactly: index.html
- GitHub Pages should publish from the branch and / (root) folder containing these files.

HOW TO UPLOAD:
1. Open your GitHub repository.
2. Switch to the branch you want to use.
3. Click Add file > Upload files.
4. Drag all six files into the upload box.
5. If an older index.html exists, GitHub will replace it after you commit.
6. Click Commit changes.
7. Wait for GitHub Pages to redeploy.
8. Hard refresh the website.

HOW VERSION 4 WORKS:
- Home page lists every work file.
- + New Work File can import a PDF or create a blank drawing.
- Click a project card to continue previous work.
- Press Library to return to the home page.
- Changes auto-save in IndexedDB on the same device/browser.
- PDF data itself is stored locally, so reopening the project does not require reselecting the PDF.
- Rename, Duplicate, and Delete are available from the three-dot menu.

IMPORTANT DATA WARNING:
IndexedDB data belongs to that browser/device.
Clearing Safari website data can delete locally saved projects.
A future version should add Project Export/Import backup files before company-wide use.


UPDATE IN THIS BUILD
- New large iPad measurement keypad.
- Space is shown as "_" while typing, but saved/exported as a real space.
- Large number buttons, /, negative sign, backspace, clear, Space, Cancel, and OK.
- Moving a measurement temporarily locks drawing scroll/pan so the page does not move.


VERSION 4.2 CHANGES
- Removed Tower and Floor fields from New Work File.
- Added nested New Folder support.
- Open a folder, then use New File to add PDF/blank work files inside it.
- PDF data is stored separately from project state, greatly reducing autosave size.
- Comment canvas is encoded only after drawing, not during every save.
- Scrolling no longer triggers repeated database saves.
- Autosave batches rapid edits for 1.6 seconds.
- Library return waits only for a small final save and should be much faster.


VERSION 4.2.1 SAVE FIX
- Serializes IndexedDB writes to prevent overlapping autosaves.
- Saves imported PDF data only once instead of rewriting it on every autosave.
- Adds compatibility for older projects that stored PDF data inside the project record.
- Shows a useful reason when saving fails.
- Allows returning to Library after a failed save, with a warning.
- Important after upload: close all older tabs/windows of the app, then reopen it.


VERSION 5 — MANUAL SAVE + SAFETY SAVE

SAVE BEHAVIOR
- Editing only changes the status to "Unsaved".
- Press the large Save button whenever needed.
- A safety save runs every 3 minutes only when changes exist.
- Returning to Library saves first if there are unsaved changes.
- Cmd+S / Ctrl+S also saves.
- Closing the browser with unsaved changes shows a warning.
- No database write occurs after every point, movement, or drawing action.

FILES TO UPLOAD
- index.html
- style.css
- db.js
- save.js
- workspace.js
- app.js
- manifest.json

All files must be in the repository root.


VERSION 5.1 UI FIXES
- Added 0 to the measurement keypad.
- Added /4, /8, and /16 denominator buttons.
  Example: tap 3, then /8, to create 3/8.
- Added Zoom Out, zoom percentage, and Zoom In controls to the workspace toolbar.
- Zoom buttons keep the visible area approximately centered.
- Renamed the Library folder navigation button from Up to Back.


VERSION 6 KEYBOARD
- Finalized compact 4-column keypad layout:
  7 8 9 ⌫
  4 5 6 /4
  1 2 3 /8
  0 / − /16
- Removed Clear.
- SPACE is full-width and light blue.
- OK is green.
- Cancel is neutral gray.
- Fraction buttons are visually grouped on the right.


VERSION 6.1 PDF EXPORT FIX
- Replaced webpage screenshot export with direct canvas composition.
- Prevents blank PDFs on iPad caused by oversized html2canvas rendering.
- Export is independent of current zoom.
- Includes the PDF/image background, pen comments, and measurement labels.
- Automatically reduces output resolution only when required by older iPad canvas limits.


VERSION 6.1.1 STARTUP FIX
- Fixed a JavaScript syntax error in workspace.js.
- The syntax error stopped all startup scripts, so New Folder and New File did nothing.
- Keeps the Version 6 keyboard, zoom controls, manual save, folders, and Version 6.1 PDF export fix.


VERSION 6.2 — OFFLINE + BACKUP/RESTORE

NEW FILE TO UPLOAD
- sw.js  (service worker; required for offline use)

FULL FILE LIST FOR THIS VERSION (all in the repository root):
- index.html
- style.css
- db.js
- save.js
- workspace.js
- app.js
- manifest.json
- sw.js   <-- NEW

OFFLINE USE
- The app now installs a service worker that caches the app and the
  pdf.js / html2pdf libraries.
- Load the app online once with signal. After that it opens and runs
  with no signal on the job site, including importing PDFs and exporting.
- The very first launch on a new device still needs signal once.

BACKUP (protects against lost data)
- Press Backup on the home screen to download one .json file containing
  every folder, work file, and PDF drawing on this device.
- Email it to yourself or save it to a cloud drive / another device.
- Do this regularly, and before clearing Safari data or switching devices.

RESTORE
- Press Restore and choose a backup .json file.
- Merge: keeps what is already on the device and adds/updates from the backup.
- Replace All: wipes the device first, then loads only the backup
  (tap the red button twice to confirm).

DEPLOY NOTE FOR FUTURE UPDATES
- When you upload new app files, open sw.js and change CACHE_VERSION
  (for example v6-2 -> v6-3). This clears old cached copies so every
  device picks up the new version on the next launch.


VERSION 6.3 — ORDERING, INPUT CHECK, AND UI FIXES

SMARTER POINT ORDERING
- Ordering now walks the perimeter by angle around the centre of the points,
  instead of measuring distance to a bounding box.
- This stays correct when the drawing is rotated/skewed or the outline is
  irregular (for example L-shaped), which the old method could get wrong.
- The output is unchanged in shape: points are still grouped by N/E/S/W with
  each side numbered from 1, so CSV columns and on-drawing labels look the same.
- Manual "Assign Side" still overrides the automatic guess.

MEASUREMENT INPUT IS NOW CHECKED
- Pressing OK checks the format before saving.
- Valid examples: 26, 26 3/8, -12 1/2, 3/16.
- Junk like //, 3/8/16, or 3/0 is rejected with a message; the keypad stays
  open so you can fix it. This keeps bad values out of the CSV.

NO MORE POP-UP TEXT BOXES FOR ORDERING/EXPORT
- Choosing clockwise/counterclockwise now uses on-screen buttons.
- CSV and PDF file names now use a proper dialog with a text box.
- These replace the old prompt() boxes, which iOS can disable when the app
  is added to the Home Screen.

MULTI-TAB / MULTI-WINDOW WARNING
- If the app is open in more than one tab or window, a yellow banner warns
  you to keep only one open, which avoids overlapping saves.
- A banner also appears if another tab reloads the app with new files.

STORAGE WARNING
- If the device is almost out of website storage, a banner suggests making a
  Backup and deleting unused work files, before a save actually fails.

FILES CHANGED IN 6.3: index.html, style.css, db.js, workspace.js, app.js, sw.js
(save.js and manifest.json are unchanged, but upload all 8 files together.)

REMINDER: sw.js CACHE_VERSION was bumped to v6-3 so every device picks up
this update on its next online launch.


VERSION 6.3.1 — ORDERING START-CORNER FIX
- Fixed each side starting its numbering from the MIDDLE of the side.
- Now each side is numbered continuously from its corner:
  clockwise starts at the top-left, counter-clockwise at the top-right.
- Axis-aligned drawings now match the original behaviour exactly, plus the
  rotation robustness added in 6.3.
- Only workspace.js and sw.js changed since 6.3.
- sw.js CACHE_VERSION bumped to v6-3-1.


VERSION 6.4 — ORDERING REVERTED + MANUAL ADJUSTMENTS

ORDERING
- Reverted to the original bounding-box ordering (the version you preferred).
- The rotated-drawing (centroid-angle) experiment was removed.

MANUAL SEQUENCE ADJUSTMENTS (long-press a point to open its menu)
- "↑ Move Up in Order" / "↓ Move Down in Order":
  swaps a point with its neighbour within the same side. Use it to fix two
  close points that ordered the wrong way round.
- "Reorder Side by Tapping":
  a blue bar appears; tap the points on that side one by one in the order you
  want. Numbering follows your taps. It finishes automatically after the last
  point, or press Cancel to abort.

HOW MANUAL AND AUTOMATIC INTERACT
- The first manual adjustment puts that data type into MANUAL mode; the CSV and
  the on-drawing labels then follow the manual order (geometry no longer
  overrides it).
- New points added in manual mode are appended to the end of their side.
- Pressing "Order Current Data" again clears manual mode and returns to fully
  automatic ordering (treat it as a "reset to automatic" button).
- Assign Side is unchanged and still overrides which side a point belongs to.

NOTE: Move Up/Down and tap-reorder are not covered by Undo yet; press the
opposite action or re-run Order Current Data to revert.

FILES CHANGED IN 6.4: index.html, style.css, workspace.js, sw.js
sw.js CACHE_VERSION bumped to v6-4.


VERSION 6.5 — UNDO FOR MANUAL ORDER + LABEL STYLING

UNDO / REDO NOW COVER MANUAL ORDERING
- "Move Up/Down in Order" and "Reorder Side by Tapping" can now be undone and
  redone with the normal Undo (⟲) / Redo (⟳) buttons.
- Undo also restores automatic mode if the adjustment was the first manual
  change, so undoing returns you exactly to the automatic order.

MEASUREMENT LABEL STYLING
- On-drawing measurement labels now have a white outline so they stay readable
  over dark or busy drawings.
- Font changed to a lighter (thinner) Arial. Size is unchanged.
- The exported PDF uses the same white-outlined, thinner labels.

FILES CHANGED IN 6.5: style.css, workspace.js, sw.js
sw.js CACHE_VERSION bumped to v6-5.
