import { TILE, PASSABLE, CLIMBABLE, drawChar } from './atlas.js';

export const TOOLS = ['rod', 'hoe', 'can', 'axe'];

const GRAV = 0.5, MAXFALL = 8, ACCEL = 0.9, FRIC = 0.75, MAXRUN = 2.6, JUMP = -7.4;

// Keyboard only. Gamepad API needs a button press to register and varies by
// browser; deferred deliberately (see spec).
export const MAPS = [
  { left: 'KeyA', right: 'KeyD', jump: 'KeyW', down: 'KeyS', use: 'ShiftLeft',
    tools: ['Digit1', 'Digit2', 'Digit3', 'Digit4'], char: 0 },
  { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', down: 'ArrowDown', use: 'Slash',
    tools: ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'], char: 6 },
];

export class Player {
  constructor(tx, ty, map) {
    this.spawn = { x: tx * TILE, y: ty * TILE };
    this.map = map;
    this.w = 12; this.h = 14;
    this.tool = 0;
    this.reset();
  }
  reset(room) {
    this.x = this.spawn.x; this.y = this.spawn.y;
    this.vx = 0; this.vy = 0; this.face = 1; this.onGround = false; this.anim = 0;
    // A spawn buried in solid tiles freezes the player with no visible cause.
    // Nudge upward so the room is still playable, and say so loudly.
    if (room && this.hits(room, this.x, this.y)) {
      let n = 0;
      while (n < 8 && this.hits(room, this.x, this.y)) { this.y -= TILE; n++; }
      console.warn(`spawn inside solid tile at (${this.spawn.x / TILE},${this.spawn.y / TILE}) ` +
                   `- moved up ${n} tile(s). Fix the room's spawn.`);
    }
  }

  solidAt(room, px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return true; // walls
    return !PASSABLE.has(room.at(tx, ty));
  }
  hits(room, x, y) {
    return this.solidAt(room, x, y) || this.solidAt(room, x + this.w - 1, y) ||
           this.solidAt(room, x, y + this.h - 1) || this.solidAt(room, x + this.w - 1, y + this.h - 1);
  }
  onClimb(room) {
    const tx = Math.floor((this.x + this.w / 2) / TILE), ty = Math.floor((this.y + this.h / 2) / TILE);
    return CLIMBABLE.has(room.at(tx, ty));
  }

  update(room, keys) {
    const m = this.map;
    const climbing = this.onClimb(room);

    if (keys.has(m.left))  { this.vx -= ACCEL; this.face = -1; }
    if (keys.has(m.right)) { this.vx += ACCEL; this.face = 1; }
    if (!keys.has(m.left) && !keys.has(m.right)) this.vx *= FRIC;
    this.vx = Math.max(-MAXRUN, Math.min(MAXRUN, this.vx));

    if (climbing) {
      this.vy = 0;
      if (keys.has(m.jump)) this.vy = -2;
      else if (keys.has(m.down)) this.vy = 2;
    } else {
      this.vy = Math.min(this.vy + GRAV, MAXFALL);
      if (keys.has(m.jump) && this.onGround) { this.vy = JUMP; this.onGround = false; }
    }

    // Axis-separated AABB vs tile grid. Deliberately the whole of collision.
    let nx = this.x + this.vx;
    if (this.hits(room, nx, this.y)) {
      while (!this.hits(room, this.x + Math.sign(this.vx), this.y)) this.x += Math.sign(this.vx);
      this.vx = 0;
    } else this.x = nx;

    let ny = this.y + this.vy;
    if (this.hits(room, this.x, ny)) {
      while (!this.hits(room, this.x, this.y + Math.sign(this.vy))) this.y += Math.sign(this.vy);
      if (this.vy > 0) this.onGround = true;
      this.vy = 0;
    } else { this.y = ny; this.onGround = false; }

    if (this.y > room.h * TILE + 64) this.reset(room); // fell out
    this.anim += Math.abs(this.vx) > 0.3 ? 0.2 : 0;
  }

  // Tiles the player is reaching into: the column just past the leading edge,
  // across the rows the body occupies. Returns the first match a predicate
  // accepts, so a tool can reach a tree at head height or a bush at foot height
  // without the player having to line up precisely.
  probeFind(room, accept) {
    // One tile beyond the body's leading edge. Using the edge alone lands on
    // the player's own tile, because the body is narrower than a tile.
    const edge = this.face > 0 ? this.x + this.w - 1 : this.x;
    const tx = Math.floor(edge / TILE) + this.face;
    const y0 = Math.floor(this.y / TILE);
    const y1 = Math.floor((this.y + this.h - 1) / TILE);
    // body rows first, then one above (head height) and one below (floor level)
    for (let ty = y0; ty <= y1; ty++)
      if (accept(room.at(tx, ty))) return { x: tx, y: ty };
    if (accept(room.at(tx, y0 - 1))) return { x: tx, y: y0 - 1 };
    if (accept(room.at(tx, y1 + 1))) return { x: tx, y: y1 + 1 };
    return null;
  }

  // Single-point probe, kept for tools that want a plain target.
  probe() {
    const edge = this.face > 0 ? this.x + this.w - 1 : this.x;
    return {
      x: Math.floor(edge / TILE) + this.face,
      y: Math.floor((this.y + this.h / 2) / TILE),
    };
  }

  draw(ctx) {
    const f = (Math.floor(this.anim) % 2);
    drawChar(ctx, this.map.char + f, Math.round(this.x) - 2, Math.round(this.y) - 6);
  }
}
