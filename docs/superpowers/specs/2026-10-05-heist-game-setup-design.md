# Cozy Heist Platformer — Setup Design

Date: 2026-10-05
Status: awaiting review

## Intent

A narrative, linear, two-player couch-coop platformer. Players pull off a heist
structured as a sequence of escape rooms. The tone is cozy, not tense: Stardew
Valley's warmth applied to a heist. Farming tools are reinterpreted as heist
tools — the fishing rod is a grapple, not a fishing rod.

Success for this phase is not a fun game. It is a repo where **many rooms can be
built in parallel, by separate agents, without coordinating with each other.**
The deliverable is the contract that makes that true, plus one reference room
proving the contract survives real use.

### Decided

| Decision | Value |
|---|---|
| Stack | HTML5 + vanilla JS, canvas 2D, no framework |
| Coop | Local same-screen, shared camera, no netcode |
| Coop depth | Mostly independent; either player can solve most things |
| Tool roster | Fixed, all 4 available from room 1 |
| Art | Kenney All-in-1 (CC0) placeholders; licensed art bought later |
| Room format | Plain-text JS data module per room |
| Parallelism | One reference room first, then fan out |

### Explicitly out of scope

Online multiplayer. Save/load. Audio design. Story text beyond room-level
beats. Menus beyond what is needed to launch a room. Any art authored by us.

## Asset decision and the licensing reason behind it

Source: `noel:/volume2/projects/assets_game/Kenney Game Assets All-in-1 1.8.0.zip/Kenney Game Assets All-in-1 1.8.0/2D assets`
(ssh only — this share is not NFS-exported, unlike `/mnt/noel/data2`.)

We use Kenney exclusively. It is **CC0**: commercial use, modification, and
redistribution are all permitted, attribution optional. Because the placeholder
art is already commercial-safe, buying art later is an *upgrade path*, not a
dependency — the game is shippable at every point.

Packs in use, all side-view and tile-compatible:

- `Pixel Platformer` — base tiles, characters, parallax backgrounds
- `Pixel Platformer Farm Expansion` — the cozy/farm register
- `Pixel Platformer Industrial Expansion` — the vault/facility register
- `Pixel Platformer Blocks` — marble/rock/sand/stone surface variants
- `Interface Pack (Pixel)`, `Input Prompts Pixel 16×` — UI, button glyphs
- `Particle Pack`, `Smoke Particles` — tool feedback
- `Generic Items`, `Game Icons` — tool and loot icons

Measured geometry (verified with `identify`, not assumed):

- Tiles are **18x18**: 16x16 of art with a 1px bleed margin. The world grid is
  **16px**; the extra pixel exists to stop filtering seams and is not world space.
- Characters are **24x24**.
- Atlas filenames differ between packs and this has already caused one wrong
  guess. The base pack uses `Tilemap/tiles_packed.png` and
  `Tilemap/characters_packed.png`; the Farm and Industrial expansions use
  `Tilemap/tilemap_packed.png` (288x126 = a 16x7 grid of 112 tiles each).
  Room authors must never hardcode these paths — see the tileset rule below.

### Rejected, and why

- **Sprout Lands** — the closest thing to the target look, and unusable twice
  over. Its license reads *"You can not redistribute or resale, even if
  modified. You can only use these assets in non-commercial projects."* It is
  also top-down, the wrong projection for a platformer.
- **cozy farm / Interior free / town free / winter free** — top-down, and their
  readmes carry **no license text at all**. Unlicensed is not the same as free.
- **Mana Seed Character Base** — a "Demo", and top-down 4-direction.
- **The dungeon archive** at `/mnt/noel/data2/media-archive/assets/pixel` —
  mostly unlicensed; `RF_Catacombs` has a `public-license.txt` worth reading if
  we ever want it. Not needed, since Industrial Expansion covers vault interiors.

### The art-swap rule

Buying art later is cheap **only** if no room references a texture directly.
All atlas paths and tile-index lookups live in one module, `src/atlas.js`, which
exposes tiles by **name** (`"crate"`, `"vault_door"`), never by index. Swapping
art becomes an edit to that one file instead of an edit to N rooms. A room that
names a PNG, or hardcodes a numeric tile index, is a contract violation: it
silently makes the future art purchase expensive, and it is also unreadable in
review.

This matters more in HTML than it would in an engine, because there is no editor
to abstract the atlas for us — the indirection has to be deliberate.

## Architecture

Vanilla JS with ES modules, served as static files. No framework, no bundler, no
build step — a browser loads `index.html` and runs. This is a deliberate choice,
not laziness about tooling: a room author edits one file and refreshes, and there
is no build to break between parallel contributors.

```
heist-game/
  index.html
  assets/kenney/              # vendored, CC0, unmodified
  src/
    main.js                   # boot, canvas, fixed-timestep loop
    atlas.js                  # the ONLY file naming PNGs or tile indices
    input.js                  # two-player keyboard mapping
    player.js                 # movement, tool use, interaction probe
    tools.js                  # the four tools
    room.js                   # room loading, the Room shape, reset()
    interactable.js           # base behaviour for tool-affected objects
  rooms/
    r00_reference.js          # the hand-built proof
    r01_....js                # fanned out in parallel
    index.js                  # the ordered room list — the ONLY place order lives
  tests/
    run.mjs                   # headless Playwright runner
```

### Why rooms are data, not scenes

Each room is a plain JS module exporting a data object. That makes a room a
**reviewable text file**: a diff shows what changed, two authors never conflict
in a binary, and I can assert against a room's contents in a test without
launching it. This is the main thing HTML buys us over an engine's binary scene
files, and it is what makes parallel authorship by separate agents practical.

### Data flow

`rooms/index.js` is the only thing that knows the room order. A room never names
another room — not the next, not the previous. It reports completion and the
runner decides what that means. This is what lets rooms be written in any order
by authors who have not read each other's code.

```
input -> player --(use tool)--> interactable --(satisfied)--> room.check()
room solved -> main.js advances to the next entry in rooms/index.js
```

### Coordinates

The world grid is **16px**. Kenney tiles are 18x18 (16x16 of art plus a 1px
bleed margin), so the renderer samples a 16x16 source region at an 18px stride
and draws it to a 16px destination. The margin is atlas padding and never world
space. `ctx.imageSmoothingEnabled = false`, and the canvas scales by an integer
factor only — a fractional scale is what makes pixel art shimmer.

## The room contract

This is the real deliverable. Every parallel author codes against exactly this.

```js
export default {
  id: "r00_reference",
  title: "The Loading Dock",        // shown on entry
  spawn: [{x: 2, y: 8}, {x: 4, y: 8}],  // p1, p2, in TILE coords
  tiles: [...],                     // row-major tile NAMES, not indices
  objects: [...],                   // interactables, by tile coord
  check(state) { return bool },     // true once the room is complete
  reset() {}                        // restore initial state; idempotent
}
```

Rules, each paired with the failure it prevents:

1. **A room may assume all four tools are available.** The roster is fixed, so
   there is no ordering dependency to reason about. This is the single rule that
   makes parallel authorship possible.
2. **A room signals completion only through `check()`, and never advances the
   game.** A room that loads its successor hardcodes the running order and
   breaks reordering.
3. **A room writes nothing outside its own module.** No shared mutable globals,
   so two rooms cannot collide.
4. **A room reads no state from previous rooms.** Linear *narrative*,
   independent *mechanics*. A room that reads prior state cannot be tested alone.
5. **A room must be playable standalone** at `index.html?room=rNN_x`. If it only
   works in sequence, it cannot be developed or reviewed in parallel.
6. **A room names tiles, never PNGs and never numeric indices.** Protects the
   later art purchase and keeps the room readable in review.
7. **`reset()` must fully restore initial state.** Players will fail puzzles and
   retry; a partial reset yields an unsolvable room and a confusing bug report.
8. **Both players must be able to complete the room.** Given mostly-independent
   coop, no puzzle may be solvable by only one of the two bodies, or a player can
   be stranded. An author who *wants* a two-player gate may add one locally —
   raising coop depth per room without touching any other room or this contract.

## Tools

Four tools, fixed, each a farming implement reread as a heist implement. Each is
one function with the same signature, keeping the shared surface tiny.

| Tool | Farming origin | Heist function |
|---|---|---|
| Rod | fishing rod | grapple to anchor points; retrieve distant objects |
| Hoe | tilling soil | pry floorboards, break weak surfaces |
| Can | watering can | douse sensors/electrics; grow a vine to climb |
| Axe | chopping wood | cut ropes, beams, barriers |

An interactable declares which tools affect it, so adding a puzzle object never
requires editing a tool. Tools stay closed; puzzle objects stay open.

## Input

Two players on one keyboard, mapped in `input.js`:

- P1: `WASD` + `Shift` use + `1234` select tool
- P2: arrows + `/` use + numpad `1234` select tool

Gamepads are **not** in this phase. The browser Gamepad API needs a button press
before a pad registers and behaves inconsistently across browsers — real work,
and not on the path to a testable room. Keyboard-only is also what makes the
headless tests possible, since synthetic key events drive the game directly.

## Testing

This is where HTML earns its place over an engine. Each room ships one headless
Playwright test that loads the room standalone, drives its intended solution with
synthetic key events, and asserts `check()` goes true — plus that `reset()`
restores the initial state. Each test also saves a screenshot, so a room can be
reviewed by looking at it rather than by reading its tile array.

```
pnpm test              # all rooms, headless
pnpm test r00          # one room
```

Chromium is already present at `~/.cache/ms-playwright`; `/usr/bin/google-chrome`
and `/usr/bin/firefox` are available as fallbacks. The reference room's test is
written first and is the worked example every room author copies.

## Build order

1. `index.html`, canvas, fixed-timestep loop, integer scaling.
2. Kenney assets vendored; `atlas.js` with named tile lookups.
3. Player: movement, two-player keyboard input, tool use, interaction probe.
4. The four tools.
5. `room.js`, `interactable.js`, `rooms/index.js`.
6. Playwright harness and the screenshot convention.
7. **`r00_reference` — hand-built, by one author, start to finish.**
8. Validate the contract against that room; fix the contract where reality
   disagreed with it.
9. Only then fan out rooms in parallel.

Step 8 is the point of step 7. The contract above is a hypothesis; a single real
room converts it into something other authors can trust. Fanning out before that
multiplies any contract mistake by the number of rooms.

## Risks

- **The contract is wrong in some way inspection cannot reveal.** Mitigated by
  step 6/7 ordering, which is the whole reason the reference room exists.
- **Mostly-independent coop weakens the two-person heist premise.** Accepted
  deliberately for design speed and parallelism. Rule 8 leaves the door open to
  raise depth room-by-room later, so this is reversible without a rewrite.
- **Kenney's look is not the cozy target.** Accepted; the art swap is planned
  and the tileset rule keeps it to one file.
- **18px tile vs 16px grid confusion** produces seams or misalignment. Pinned
  explicitly above because it is the kind of mistake every author makes once.
- **No engine means we write our own collision and camera.** Accepted: a
  tile-grid platformer's collision is well-understood and small. The risk is
  scope creep in `player.js`, so it stays limited to axis-separated AABB-vs-tile
  movement and nothing more general.
- **Browser gamepad support is deferred**, so "couch coop" is two players on one
  keyboard for now. Adequate for testing the premise; revisit before any release.
