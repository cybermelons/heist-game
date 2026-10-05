# Heist

A two-player couch-coop platformer heist, built as a sequence of escape rooms.
Stardew Valley meets a heist: farming tools are the heist tools. The fishing
rod is a grapple, the hoe pries up floors, the watering can grows a vine to
climb, the axe cuts what blocks you.

Plain HTML, ES modules and canvas. No framework, no bundler, no build step —
serve the directory and open it.

## Play

```sh
python3 -m http.server 8777
```

Then `http://localhost:8777/`. Jump to one room with `?room=<id>`.

| | Player 1 | Player 2 |
|---|---|---|
| move | `A` `D` | `←` `→` |
| jump / climb up | `W` | `↑` |
| down | `S` | `↓` |
| use tool | `Left Shift` | `/` |
| pick tool | `1` `2` `3` `4` | numpad `1`-`4` |

## Build a room

Rooms are independent on purpose: many people can write them at once and they
merge as plain text. Two ways in.

**Editor:** open `edit.html`, paint, press **▶ test** to play it without
saving, then **export .js** and save the output as `rooms/<id>.js`.

**By hand:** copy `rooms/r00_loading_dock.js` — it is both the reference room
and the template. The character legend lives in `src/room.js`.

Either way, add the room to `rooms/index.js`. That file is the only place room
order lives.

### The room contract

1. One file per room, under `rooms/`. Nothing else imports it.
2. A room never loads or references another room.
3. Name tiles, never atlas indices. `src/atlas.js` owns every index, so art can
   be swapped in one file.
4. `reset(state)` must restore everything the room changed. A room has to be
   replayable without a page reload.
5. `check(state, room, players)` returns true when the room is solved.
6. Both players must be able to reach the exit. No solution that strands one.
7. Only the four tools. A room may not add a mechanic.
8. A spawn must not sit inside a solid tile. The editor outlines this in red;
   the game warns in the console and nudges the player up.

## Art

Placeholder art is [Kenney](https://kenney.nl) (CC0), chosen so the project
stays shippable commercially. Atlas geometry: 18px stride (16px art plus a 1px
bleed margin), 16px world grid, 24px characters. All of it is behind
`src/atlas.js`; buying real art later is one file to change.

## Design

`docs/superpowers/specs/2026-10-05-heist-game-setup-design.md`
