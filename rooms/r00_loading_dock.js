import { parse } from '../src/room.js';

// REFERENCE ROOM — copy this file to start a new one.
//
// Legend (src/room.js): # dirt  = dirt_top  S stone  s stone_top  G grass
//   C crate  H ladder  X chest  K key  D door  L lever  B bush  T tree
//   V vine   W water   F flag   P plank  f fence  * gem  o coin  (space) empty
//
// Rules: name tiles not indices, never load another room, reset() must restore
// everything, and both players must be able to finish.

export default {
  id: 'r00_loading_dock',
  title: 'The Loading Dock',
  spawn: [{ x: 2, y: 8 }, { x: 4, y: 8 }],

  tiles: parse([
    '                              ',
    '                              ',
    '          T        f f        ',
    '      ===========  SSSSSS     ',
    '      #########    SSSSSS     ',
    '                      *       ',
    '            C         s       ',
    '   T        C      PPPPPP     ',
    '   B        C                 ',
    '=========   C      ===========',
    '#########   C      ###########',
    '#########   C      ###########',
  ]),

  // The gem is the loot. Reaching it needs: axe to clear the crate stack OR
  // can on the bush to grow a climbable vine, then rod to grapple across.
  reset(state) { state.got = false; },

  check(state, room, players) {
    for (const p of players) {
      const tx = Math.floor((p.x + p.w / 2) / 16), ty = Math.floor((p.y + p.h / 2) / 16);
      if (room.at(tx, ty) === 'gem') { room.set(tx, ty, '.'); state.got = true; }
    }
    return state.got;
  },
};
