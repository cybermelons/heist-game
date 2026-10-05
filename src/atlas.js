// The ONLY file that names image files or numeric tile indices.
// Rooms refer to tiles by NAME. Swapping art later = editing this file alone.

export const TILE = 16;   // world grid
const SRC = 18;           // atlas stride: 16px art + 1px bleed margin

const SHEETS = {
  tiles: 'assets/kenney/tiles.png',
  chars: 'assets/kenney/chars.png',
  farm: 'assets/kenney/farm.png',
  industrial: 'assets/kenney/industrial.png',
};
const COLS = { tiles: 20, chars: 12, farm: 16, industrial: 16 };

// name -> [sheet, index]. Indices read off the atlas, not guessed.
export const NAMES = {
  '.': null,                      // empty
  grass:        ['tiles', 1],     // grass-topped dirt
  grass_l:      ['tiles', 0],
  grass_r:      ['tiles', 3],
  dirt:         ['tiles', 123],   // solid dirt fill (no top edge)
  dirt_top:     ['tiles', 41],    // dirt with stone lip
  stone:        ['tiles', 122],  // solid fill variant
  stone_top:    ['tiles', 42],
  crate:        ['tiles', 26],    // wooden crate
  crate_alt:    ['tiles', 104],
  ladder:       ['tiles', 71],
  chest:        ['tiles', 9],     // gold chest
  chest_open:   ['tiles', 11],
  key:          ['tiles', 27],
  gem:          ['tiles', 67],
  coin:         ['tiles', 10],
  door:         ['tiles', 130],
  lever_left:   ['tiles', 64],
  lever_mid:    ['tiles', 65],
  lever_right:  ['tiles', 66],
  sign:         ['tiles', 84],
  bush:         ['tiles', 124],   // small shrub
  tree:         ['tiles', 126],
  vine:         ['tiles', 125],
  water:        ['tiles', 53],
  flag:         ['tiles', 111],
  beam:         ['tiles', 91],    // horizontal support beam
  plank:        ['tiles', 89],
  fence:        ['tiles', 105],
};

const imgs = {};

export function load() {
  return Promise.all(Object.entries(SHEETS).map(([k, src]) => new Promise(res => {
    const i = new Image();
    i.onload = () => { imgs[k] = i; res(); };
    i.onerror = () => { console.warn('missing sheet', src); res(); };
    i.src = src;
  })));
}

// Draw a named tile at pixel x,y. Unknown names draw a magenta box so a typo
// is visible on screen instead of silently invisible.
export function draw(ctx, name, x, y) {
  const e = NAMES[name];
  if (e === null) return;
  if (!e) { ctx.fillStyle = '#f0f'; ctx.fillRect(x, y, TILE, TILE); return; }
  const [sheet, idx] = e;
  const img = imgs[sheet];
  if (!img) return;
  const c = COLS[sheet];
  ctx.drawImage(img, (idx % c) * SRC, ((idx / c) | 0) * SRC, TILE, TILE, x, y, TILE, TILE);
}

// Characters are 24x24 on their own sheet.
export function drawChar(ctx, idx, x, y) {
  const img = imgs.chars;
  if (!img) { ctx.fillStyle = '#8f8'; ctx.fillRect(x, y, 16, 20); return; }
  const c = COLS.chars, S = 24;
  ctx.drawImage(img, (idx % c) * S, ((idx / c) | 0) * S, S, S, x - 4, y - 4, S, S);
}

// Tiles that do not block movement. Everything else is solid.
export const PASSABLE = new Set([
  '.', 'chest', 'chest_open', 'key', 'gem', 'coin', 'door', 'sign',
  'lever_left', 'lever_mid', 'lever_right', 'bush', 'flag', 'water', 'vine', 'ladder',
]);

export const CLIMBABLE = new Set(['ladder', 'vine']);
