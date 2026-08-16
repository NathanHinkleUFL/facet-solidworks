# Facet XL — Project Planning

## What This Project Is

Facet is a context-aware Stream Deck companion for SolidWorks. As you work — switching
between Part modeling, Sketch editing, Assembly management, and Drawing layout — the deck
automatically repopulates with the most relevant commands for your current context. No manual
mode switching. Open a sketch and the deck becomes sketch tools. Come back out and it's part
tools again.

This project is a **fork** of the open-source
[netarcx/facet-solidworks](https://github.com/netarcx/facet-solidworks) repository, adapted
for the **Stream Deck XL (8×4, 32 keys)** instead of the original MK.2 (5×3, 15 keys).

**We are developing in our own fork and are not merging back upstream at this time.**
That may change later if we generalize multi-device support, but for now this is our own project.

---

## Why Not Just Use Keyboard Shortcuts?

This is a fair question. SolidWorks has keyboard shortcuts. You probably already use some.
Here is why the Stream Deck is a meaningfully different tool, not just a more expensive way
to press the same keys.

### Keyboard shortcuts are blind. The deck sees.

When you press `Ctrl+B` in SolidWorks you get... something. Maybe it worked, maybe it didn't
apply in your current context, maybe the feature opened a PropertyManager page somewhere off
screen. The keyboard gives you zero feedback. The deck gives you:

- **✓** — the command ran successfully, rendered as a green flash on the key you pressed
- **⚠** — the command failed or wasn't available in the current context (wrong mode,
  nothing selected, etc.), rendered as a yellow warning flash

You know immediately whether it worked. With keyboard shortcuts you're guessing.

### The deck changes with your context. Shortcuts don't.

Keyboard shortcuts are static. `S` in SolidWorks opens the shortcut bar, but the same key
does the same thing whether you're in Part mode, Sketch mode, Assembly mode, or Drawing mode.

Facet changes the entire deck automatically:
- Open a sketch → the deck becomes sketch tools (Line, Circle, Dimension, Trim, Offset…)
- Exit the sketch → instantly back to Part tools (Extrude, Fillet, Shell, Mirror…)
- Select a face → the deck shifts to show what makes sense for that selection
- Switch to your assembly → assembly commands appear without you touching anything

The deck always shows you what's *relevant right now*, not a fixed grid of everything.

### The deck teaches you commands you forgot you had.

With keyboard shortcuts you only use what you've already memorized. The deck surfaces
commands visually — you'll find yourself pressing something you wouldn't have thought to
shortcut because you can *see* it sitting there. Hole Wizard, Shell, Mirror, Wrap — things
that are genuinely useful but easy to forget because they're buried in menus.

### Some things keyboard shortcuts simply cannot do.

- **Your Bambu P1S print progress** — percentage complete, time remaining, and printer
  state in a color-coded key, updating live while you work. A keyboard shortcut cannot
  show you anything. The deck can show you your print is at 73% and has 40 minutes left
  without you opening a single app or walking to the closet.
- **Toggle state** — when Section View is active, the key will show it as active (lit up).
  Same for Construction mode, Hide/Show, Transparency. At a glance you know what's on.
  A keyboard shortcut has no memory of whether the thing it toggles is currently on or off.
- **Document title on the Home key** — the top-left key shows the filename of whatever
  part you're working on. Useful when you have multiple SolidWorks windows open.

### The honest tradeoff

Keyboard shortcuts are faster *if you already know them and your hands are on the keyboard*.
The deck wins when:
- You're reaching for the mouse anyway (most of SolidWorks is mouse-driven)
- You want confirmation that a command actually ran
- You want to see state at a glance without clicking through menus
- You want the printer status without alt-tabbing

They're not competing. Use both. The deck handles the commands you'd otherwise hunt for
in a menu or half-remember the shortcut for, and gives you a window into your printer
while it's sitting behind a closed door.

---

## Architecture

Two processes communicate over a private local WebSocket:

```
SolidWorks 2024+  ──(COM)──►  Facet.AddIn  ──ws://localhost:8723──►  Facet Plugin  ──►  Stream Deck XL
   context events  ▲            C# server                              Node.js client      8×4, 32 keys
   command runner  └────────────────── keyDown ◄────────────────────────────────────────────────────
```

### `addin/` — C# SolidWorks Add-In
- Language: C#, .NET Framework 4.8
- Loads into SolidWorks as a COM add-in (`ISwAddin`)
- Watches for context changes via SolidWorks events (doc type, sketch mode, selection state)
- Hosts a WebSocket server on `ws://localhost:8723`
- Fires commands via `ISldWorks.RunCommand` when the plugin sends an `invoke` message
- Sends `context` messages every time SolidWorks state changes (coalesced to ≤20 Hz)

### `plugin/` — Node.js/TypeScript Stream Deck Plugin
- Uses the official `@elgato/streamdeck` SDK from Elgato
- Connects to the add-in WebSocket as a client; auto-reconnects if the add-in drops
- Reads layouts from `shared/catalog.json` and renders SVG icons onto keys
- Forwards key presses to the add-in as `invoke` messages
- Shows ✓ (`showOk`) or ⚠ (`showAlert`) feedback per command result

### `shared/` — Shared Contract
- `catalog.json` — single source of truth: every layout, every key, every binding
- `protocol.md` — full WebSocket message format documentation
- `design-tokens.json` — colors, font sizes, stroke weights used by the renderer

### `tools/`
- `mock-addin.mjs` — a fake SolidWorks add-in server that cycles through contexts
  automatically so you can develop and test the full deck experience without SolidWorks running

---

## What the Upstream Repo Already Does (Working)

The upstream `netarcx/facet-solidworks` is a working end-to-end product for the MK.2:

- Add-in loads in SolidWorks 2024+
- Context detection works: Part → Sketch (enter/exit) → Assembly → Drawing
- Part selection overlay (different key set when geometry is selected)
- All layouts have 15-slot bindings with SVG icons
- Command invocation fires real SolidWorks commands with ✓/⚠ feedback
- New Part / New Assembly / New Drawing create documents from the Welcome screen
- Mock add-in for developing without SolidWorks
- Windows installer (`Facet-Setup.exe`) installs both halves and COM-registers the add-in

---

## Known Gaps in Upstream (and Our Job)

| Gap | Notes |
|-----|-------|
| **MK.2 only (15 keys)** | No XL (32-key) support — this is our primary work |
| **Home & More keys are stubs** | Navigation between pages not implemented |
| **Toggle state not surfaced** | Section view, Construction mode, Hide/Show look the same on/off |
| **Selection overlay is Part-only** | Assembly/drawing selection variants not done |
| **Single SolidWorks version per build** | Interop DLLs are pinned to whichever SolidWorks is on the build machine |

---

## Where Do You Need to Be?

Most of this project can be built on **any Windows laptop** — you don't need SolidWorks
installed. The plugin side (TypeScript, JSON, SVG) and the Bambu integration are completely
independent of SolidWorks. The mock add-in replaces SolidWorks for all plugin testing.

The only things that need the **SolidWorks laptop** are compiling the C# add-in, building
the installer, and final end-to-end testing with real SolidWorks running.

| Symbol | Meaning |
|--------|---------|
| 🌐 | Any Windows laptop — no SolidWorks needed |
| 🎓 | SolidWorks laptop required (school apartment) |

---

## Our Development Phases

### Phase 1 — XL Support (main goal, do this first)

The Stream Deck XL is 8 columns × 4 rows = 32 keys. The plugin manifest and catalog.json
only know about the MK.2 (15 keys). Everything else (WebSocket bridge, SVG renderer, C# add-in)
is device-agnostic.

- 🌐 [ ] Design the 32-key layouts — sketch out which commands go where for each context,
      and which bottom-row slots are reserved for Bambu and persistent controls
- 🌐 [ ] Declare `streamdeck_mk2_xl` in the plugin `manifest.json` under `Devices`
- 🌐 [ ] Update `shared/catalog.schema.json` to allow XL as a valid device
- 🌐 [ ] Add 32-slot layout entries to `shared/catalog.json` for all contexts:
      `none`, `part`, `part.selection`, `sketch`, `assembly`, `drawing`
- 🌐 [ ] Update the plugin controller (`plugin/src/controller.ts`) to detect device type
      and resolve the correct layout (15-slot vs 32-slot)
- 🌐 [ ] Update `plugin/src/catalog.ts` to handle multiple device grid sizes
- 🌐 [ ] Add new SVG glyphs to `plugin/src/render.ts` for any new commands we want to expose
- 🌐 [ ] Generate an XL Stream Deck profile (`.streamDeckProfile`)
- 🌐 [ ] Test end-to-end on XL hardware using the mock add-in (no SolidWorks needed)
- 🎓 [ ] Final test with real SolidWorks running — confirm context switching and commands work

### Phase 2 — Expanded Commands

With 32 keys vs 15, we have room for more. The extra 17 keys can expose:
- More Part commands (Loft, Sweep, Rib, Draft, Scale, Flex, Wrap)
- More Sketch tools (Spline, Ellipse, Polygon, Point, Freeform, Sketch Picture)
- More Assembly commands (Smart Fasteners, Assembly Features, Collision Detection)
- Better Home/More navigation (upstream left these as stubs)

- 🌐 [ ] Design full 32-key layouts for each context
- 🌐 [ ] Add new bindings to `catalog.json` and glyphs to `render.ts`
- 🎓 [ ] Verify all added `swCommand` names resolve correctly in real SolidWorks

### Phase 3 — Toggle State

Toggle keys (Section View, Construction Geometry, Hide/Show, Transparency, Edit Sheet) don't
currently show their on/off state — they look the same whether active or not. This phase
requires touching the C# add-in for the first time.

- 🌐 [ ] Plan which toggle states to surface and how to represent them visually on the key
- 🌐 [ ] Update the plugin renderer to handle the `active` state for toggle keys
- 🎓 [ ] Add toggle state reporting to `addin/src/ContextEngine.cs`
- 🎓 [ ] Include toggle states in the `context` WebSocket message
- 🎓 [ ] Test that toggle keys light up and go dark correctly in real SolidWorks

### Phase 4 — Polish and Packaging

- 🌐 [ ] Clean up any rough edges in the plugin code
- 🌐 [ ] Update documentation and README for the fork
- 🎓 [ ] Finalize the XL installer build with Inno Setup
- 🎓 [ ] Verify the installer auto-loads the correct Stream Deck profile for the XL
- 🎓 [ ] Consider contributing multi-device support back to upstream

### Phase 5 — Bambu P1S Integration

This is the most personally useful addition: live printer status and control without leaving
your desk, plus a one-button bridge from SolidWorks directly to the printer.

#### Background: how the P1S exposes data

The P1S runs a local MQTT broker on your network (no Bambu cloud required). It publishes
rich status messages to a topic at `device/{serial_number}/report` every few seconds.
Authentication requires the printer's serial number and its local **Access Code** (found in
the printer's network settings menu on the touchscreen).

What the MQTT feed exposes:
- Print state: `idle`, `running`, `pause`, `failed`, `finish`
- Progress: percentage complete (0–100)
- Time remaining (minutes)
- Current layer and total layer count
- Nozzle temperature, bed temperature, chamber temperature
- Print speed profile (silent / standard / sport / ludicrous)
- AMS status: which slot is loaded, filament type and color per slot, estimated remaining %
- Error codes and error messages
- A JPEG thumbnail of the model being printed (embedded in the MQTT payload)

The community library **`bambu-connect`** (Python) and several Node.js equivalents have
already reverse-engineered this protocol. You do not need to start from scratch.

#### What to show on the Stream Deck

**Primary status key** (always visible in the bottom row):

```
┌─────────────────┐
│  ████████░░  78%│  ← progress bar rendered as SVG
│                 │
│   1h 23m left   │
│   ● PRINTING    │  ← color-coded: blue=printing, green=idle,
└─────────────────┘     yellow=paused, red=error
```

The key background color shifts with printer state so you can read it at a glance from
across the room without squinting at text:
- **Deep blue** — printing (progress bar fills as job advances)
- **Green** — idle / finished
- **Amber** — paused or waiting for filament change
- **Red** — error or failed print

**Control keys** (in a Bambu sub-page or the persistent bottom row):
- Pause / Resume (toggles based on current state)
- Stop print (with a confirm press so you can't fat-finger it)
- Speed profile cycle (silent → standard → sport)

**AMS status key** (if using multi-filament):
- Shows active slot color as a colored circle
- Shows filament type (PLA / PETG / ABS / ASA / TPU)
- Pulses or changes color when a slot is running low

**SolidWorks → Print workflow key**
Since you use SolidWorks specifically to design parts for the P1S, this is the most
powerful integration. A single key in the SolidWorks layout (persistent, not context-
sensitive) that:

1. Calls a SolidWorks macro via the add-in to export the active part as `.3mf` to
   a staging folder
2. Opens Bambu Studio with that file pre-loaded, ready to place on the build plate and slice

This turns a 6-step manual export process into one button press. Future stretch goal:
if the part has already been sliced with a known profile, skip Bambu Studio entirely and
push the `.gcode` straight to the printer queue.

#### Implementation approach

The Bambu integration lives **entirely in the Node.js plugin** (`plugin/src/`) — the C#
add-in is not involved except for the "export for print" macro. The plugin:

1. Connects to the P1S MQTT broker on startup using the `mqtt` npm package
2. Subscribes to `device/{serial}/report`
3. Parses the JSON payload and updates a `BambuStatusKey` action with a freshly rendered SVG
4. The serial number and access code are stored in the Stream Deck plugin's settings
   (entered once via the key's property inspector in the Stream Deck app — never hardcoded)

#### Tasks

Almost all of the Bambu integration is plugin-side Node.js — no SolidWorks required.
Only the "export for print" feature needs the SolidWorks laptop.

- 🌐 [ ] Research existing Node.js Bambu MQTT libraries (check npm and GitHub before writing
        your own parser)
- 🌐 [ ] Check the Elgato Marketplace for existing Bambu plugins — if one already does status
        display well, use it; build only what doesn't exist yet
- 🌐 [ ] Reserve Bambu key slots in the bottom row of the XL catalog layout (do during Phase 1)
- 🌐 [ ] Add a `BambuStatusAction` action type to the plugin alongside `FacetKeyAction`
- 🌐 [ ] Add MQTT connection management to the plugin (connect on startup, reconnect on drop)
- 🌐 [ ] Build the SVG renderer for the status key (progress bar, state color, time remaining)
- 🌐 [ ] Add a property inspector UI for entering serial number and access code
- 🌐 [ ] Add AMS status key
- 🌐 [ ] Add pause/resume/stop control keys
- 🌐 [ ] Test all of the above — the P1S printer is at home, no SolidWorks needed for this
- 🎓 [ ] Implement the "export for print" SolidWorks macro + Bambu Studio launcher
- 🎓 [ ] Test the full SolidWorks → export → Bambu Studio workflow end-to-end

---

## The XL Advantage: 32 Keys Means Room for More

The MK.2 has 15 keys — upstream Facet fills all of them with SolidWorks controls. The XL
has 32, which means after a full SolidWorks layout you still have keys to spare. **Facet
only controls keys you assign the Facet action to.** Anything else on the deck is yours to
use however you want.

### Automatic Profile Switching

The Stream Deck desktop app can automatically activate a profile when a specific application
is in the foreground and switch back when you leave it. The recommended setup:

- **SolidWorks profile** — all Facet keys, auto-activates when `SLDWORKS.exe` is focused
- **Default profile** — your everyday shortcuts, active the rest of the time

You just click between windows; the deck follows you.

### Ideas for Your Non-SolidWorks Keys

The bottom row (or any row you reserve) could be persistent across profiles, or live on
your default profile for everyday use. Some things worth considering:

**Music & Audio**
- Sonos room controls — play/pause, next track, volume up/down per room
- Spotify playlist launchers — one button per playlist or mood
- Mute mic system-wide (useful during calls while modeling)

**Your Bambu P1S** *(priority feature — see Phase 5)*
- The printer lives in a closed closet, so at-a-glance status on the deck is genuinely
  useful — no walking over, no opening Bambu Studio just to check progress
- See the full plan in Phase 5 below; the short version is: live print progress,
  pause/resume/stop, AMS filament status, and a one-button SolidWorks → print workflow

**System & Window Management**
- Switch between open apps (SolidWorks, browser, CAD reference PDFs)
- Snap windows to layouts
- Lock screen / sleep display

**Communication**
- Discord push-to-talk or mute toggle
- Teams / Zoom mute — handy if you take calls while at the workstation

**Utilities**
- Open frequently-used folders or files
- Launch a browser tab to a specific URL (Bambu slicer docs, McMaster-Carr, etc.)
- Screenshot or screen recording toggle

### Design Suggestion for Phase 1

When we build the 32-slot XL layouts, reserve the **bottom row (slots 24–31)** as a
persistent strip that stays the same regardless of SolidWorks context. That gives you 8
always-available keys for music, printer, comms, or whatever you use most — while the top
three rows (24 keys) handle all the SolidWorks context switching.

---

## Testing Without SolidWorks

You don't need SolidWorks open to work on the deck UI — the mock add-in simulates context
changes automatically:

```bash
# Terminal 1 — build the plugin
cd plugin
npm install
npm run build

# Terminal 2 — run the mock add-in
node ../tools/mock-addin.mjs
```

Then install the plugin in Stream Deck app and watch the keys cycle through contexts.

---

## Building the Real Installer

Only needed when you want to test the full SolidWorks integration or produce a distributable:

```powershell
# Requires: Inno Setup 6, SolidWorks 2024+ installed on this machine
pwsh installer\build.ps1
```

The interop DLLs are copied from your local SolidWorks installation — the resulting
`Facet-Setup.exe` is pinned to your SolidWorks version.

---

## Collaboration Model

- **Nathan** — primary developer; owns the fork, works in feature branches, opens PRs
- **Rich (Dad)** — reviews pull requests, provides direction, merges approved work
- **Fork**: `github.com/[YOUR_GITHUB_USERNAME]/facet-solidworks` (your personal account)
- **Upstream**: `github.com/netarcx/facet-solidworks` — reference only; do not push back
- **Branch strategy**: `main` is stable; all work goes in named branches; PR before merging

### Typical Workflow

```bash
git checkout -b feat/xl-manifest        # start a feature branch
# ... make changes ...
git push origin feat/xl-manifest        # push to your fork
# open a PR on GitHub → tag Rich for review
```

---

## Key Files Quick Reference

| File | What It Controls |
|------|-----------------|
| `shared/catalog.json` | All layouts and key bindings — the heart of the project |
| `shared/design-tokens.json` | Colors, font sizes, stroke weights |
| `shared/protocol.md` | WebSocket message format (read-only reference) |
| `plugin/manifest.json` | Plugin metadata, declared device types |
| `plugin/src/render.ts` | SVG icon drawing and glyph library |
| `plugin/src/bridge.ts` | WebSocket connection state machine |
| `plugin/src/controller.ts` | Key registration, layout switching, paint loop |
| `plugin/src/catalog.ts` | Loads and resolves catalog.json at runtime |
| `plugin/src/types.ts` | All TypeScript interfaces |
| `addin/src/ContextEngine.cs` | SolidWorks event watching and layout resolution |
| `addin/src/WsServer.cs` | WebSocket server (add-in side) |
| `addin/src/CommandRunner.cs` | Marshals commands onto the SolidWorks STA thread |
| `tools/mock-addin.mjs` | Fake add-in for testing without SolidWorks |

---

## SolidWorks Command Reference

All `swCommand` values in `catalog.json` must be valid names from the `swCommands_e` enum.
The upstream repo was validated against SolidWorks 2025. If you're on a different version,
some command IDs may differ. The full enum is in the SolidWorks API documentation or can be
extracted from the installed interop DLLs.

---

## Important Notes

1. **Do not open PRs against `netarcx/facet-solidworks`** — our fork is our own project.
   PRs should target `main` on our fork only.
2. The `addin/` project will not compile without SolidWorks installed (it needs the
   SolidWorks interop DLLs). All plugin-side work can be done without SolidWorks.
3. Always test with the mock add-in before testing with real SolidWorks — it's faster
   and you can cycle all contexts in seconds.
4. The Stream Deck XL device string in Elgato's SDK is `streamdeck_mk2_xl` — verify
   this against the current `@elgato/streamdeck` SDK docs before hardcoding it.
