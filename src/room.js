import { TILE, draw } from './atlas.js';

// Runtime wrapper around a room data module. Rooms stay plain data; this holds
// the mutable grid so reset() is a reload of the author's original rows.
export class Room {
  constructor(def) {
    this.def = def;
    this.title = def.title || def.id;
    this.w = Math.max(...def.tiles.map(r => r.length));
    this.h = def.tiles.length;
    this.reset();
  }
  reset() {
    this.grid = this.def.tiles.map(r => r.slice());
    this.state = {};
    if (this.def.reset) this.def.reset(this.state);
    this.done = false;
  }
  at(x, y) {
    const row = this.grid[y];
    if (!row) return '.';
    return row[x] === undefined ? '.' : row[x];
  }
  set(x, y, name) { if (this.grid[y] && this.grid[y][x] !== undefined) this.grid[y][x] = name; }

  check(players) {
    if (!this.done && this.def.check(this.state, this, players)) this.done = true;
    return this.done;
  }

  draw(ctx) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        draw(ctx, this.at(x, y), x * TILE, y * TILE);
  }
}

// Rooms are authored as strings for readability; one char per tile.
// This maps the shorthand to atlas names so a room reads like a picture.
export const LEGEND = {
  ' ': '.', '.': '.',
  '#': 'dirt', '=': 'dirt_top', 'S': 'stone', 's': 'stone_top',
  'G': 'grass', 'C': 'crate', 'H': 'ladder', 'X': 'chest', 'K': 'key',
  'D': 'door', 'L': 'lever_left', 'B': 'bush', 'T': 'tree', 'V': 'vine',
  'W': 'water', 'F': 'flag', 'P': 'plank', 'f': 'fence', '*': 'gem', 'o': 'coin',
};

export function parse(rows) {
  return rows.map(r => [...r].map(ch => LEGEND[ch] ?? '.'));
}
