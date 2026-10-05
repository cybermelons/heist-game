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
| Engine | Godot 4 |
| Coop | Local same-screen, shared camera, no netcode |
| Coop depth | Mostly independent; either player can solve most things |
| Tool roster | Fixed, all 4 available from room 1 |
| Art | Kenney All-in-1 (CC0) placeholders; licensed art bought later |
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
Every room draws its geometry from one shared `TileSet` resource at
`assets/tilesets/heist.tres`. Swapping art becomes an edit to that one resource
instead of an edit to N rooms. A room that loads a PNG itself is a contract
violation, because it silently makes the future art purchase expensive.

## Architecture

The shape is deliberately flat. Rooms are the unit of work, and the only shared
code is what rooms genuinely cannot each own.

```
heist-game/
  project.godot
  assets/
    kenney/                  # vendored, CC0, unmodified
    tilesets/heist.tres      # the single shared TileSet
  src/
    autoload/
      game.gd                # run state, current room, tool unlock flags
      room_service.gd        # loads/unloads rooms, owns transitions
    player/
      player.gd              # movement, tool use, interaction probe
      player.tscn
    tools/
      tool.gd                # base class: one virtual `use()`
      rod.gd  hoe.gd  can.gd  axe.gd
    room/
      room.gd                # base class every room extends
      interactable.gd        # base class for things a tool acts on
  rooms/
    r00_reference/           # the hand-built proof
      room.tscn  room.gd
    r01_.../ r02_.../        # fanned out in parallel
  tests/
```

### Data flow

`room_service` is the only thing that knows the room order. A room never names
another room — not the next one, not the previous one. It reports that it is
finished and `room_service` decides what that means. This is what lets rooms be
written in any order by authors who have never read each other's code.

```
player --(use tool)--> interactable --(satisfied)--> room
room --emit solved--> room_service --> loads next room from its ordered list
```

## The room contract

This is the real deliverable. Every parallel author codes against exactly this.

```gdscript
class_name Room extends Node2D

signal solved                 # emitted exactly once, when the room is complete

@export var room_title: String        # shown on entry
@export var spawn_p1: Marker2D        # where player 1 enters
@export var spawn_p2: Marker2D        # where player 2 enters

func reset() -> void          # restore to initial state; must be idempotent
```

Rules, each with the failure it prevents:

1. **A room may assume all four tools are available.** The roster is fixed, so
   there is no ordering dependency to reason about. This is the single rule that
   makes parallel authorship possible.
2. **A room emits `solved` exactly once and never loads another room.** A room
   that loads its successor hardcodes the running order and breaks reordering.
3. **A room owns everything inside its own directory and writes nothing outside
   it.** No shared mutable globals, so two rooms cannot collide.
4. **A room reads no state from previous rooms.** Linear *narrative*, independent
   *mechanics*. A room that reads prior state cannot be tested alone.
5. **A room must be playable when launched directly** via
   `godot --path . rooms/rNN_x/room.tscn`. If it only works in sequence, it
   cannot be developed or reviewed in parallel.
6. **A room draws tiles only from `assets/tilesets/heist.tres`.** Protects the
   later art purchase.
7. **`reset()` must fully restore initial state.** Players will fail puzzles and
   retry; a partial reset produces an unsolvable room and a confusing bug report.
8. **Both players must be able to complete the room.** Given mostly-independent
   coop, no puzzle may be solvable by only one of the two bodies, or a player can
   be stranded. A room author who *wants* a two-player gate may add one locally —
   this raises coop depth per room without touching any other room or this
   contract.

## Tools

Four tools, fixed, each a farming implement reread as a heist implement. Each is
one subclass with one `use()` override, which keeps the shared surface tiny.

| Tool | Farming origin | Heist function |
|---|---|---|
| Rod | fishing rod | grapple to anchor points; retrieve distant objects |
| Hoe | tilling soil | pry floorboards, break weak surfaces |
| Can | watering can | douse sensors/electrics; grow a vine to climb |
| Axe | chopping wood | cut ropes, beams, barriers |

`Interactable` exposes which tools affect it, so adding a puzzle object never
requires editing a tool. Tools stay closed; puzzle objects stay open.

## Testing

Each room ships one headless test asserting that driving its intended solution
emits `solved`, and that `reset()` returns it to its initial state. This is the
smallest check that fails if a room breaks, and it is runnable per-room, which
matters when rooms land in parallel from different authors.

```
godot --headless --path . tests/run.tscn
```

The reference room's test is written first and doubles as the worked example
every room author copies.

## Build order

1. Godot 4 install on botan (not currently present — `godot` is not on PATH).
2. Project skeleton, Kenney assets vendored, `heist.tres` built.
3. Player: movement, two-controller local input, tool use, interaction probe.
4. The four tools.
5. `room.gd`, `interactable.gd`, `room_service.gd`.
6. **`r00_reference` — hand-built, by one author, start to finish.**
7. Validate the contract against that room, and fix the contract where reality
   disagreed with it.
8. Only then fan out rooms in parallel.

Step 7 is the point of step 6. The contract above is a hypothesis; a single real
room is what converts it into something other authors can trust. Fanning out
before that multiplies any contract mistake by the number of rooms.

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
