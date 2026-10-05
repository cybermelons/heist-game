import { TILE, CLIMBABLE } from './atlas.js';

// Each tool is one function: (player, room, state) -> bool (did something).
// Puzzle objects declare what they react to; tools stay closed to edits.

export const effects = [];  // transient visuals: {x,y,text,life}

function fx(x, y, text) { effects.push({ x, y, text, life: 40 }); }

export const tools = {
  // Fishing rod -> grapple. Pulls the player to the first solid tile ahead.
  rod(p, room) {
    const dir = p.face;
    const ty = Math.floor((p.y + p.h / 2) / TILE);
    let tx = Math.floor((p.x + p.w / 2) / TILE);
    for (let i = 1; i <= 8; i++) {
      const cx = tx + dir * i;
      const t = room.at(cx, ty);
      if (t === 'crate' || t === 'crate_alt' || t === 'beam') {
        p.x = (cx - dir) * TILE; p.vy = -3; p.vx = 0;
        fx(cx * TILE, ty * TILE, 'grapple');
        return true;
      }
      if (t !== '.' && !CLIMBABLE.has(t)) break;
    }
    return false;
  },

  // Hoe -> pry. Breaks weak floor: dirt and planks, ahead or underfoot.
  hoe(p, room) {
    const WEAK = t => t === 'dirt' || t === 'dirt_top' || t === 'plank';
    const hit = p.probeFind(room, WEAK);
    if (hit) { room.set(hit.x, hit.y, '.'); fx(hit.x * TILE, hit.y * TILE, 'pry'); return true; }
    const fx_ = Math.floor((p.x + p.w / 2) / TILE), fy = Math.floor((p.y + p.h) / TILE);
    if (WEAK(room.at(fx_, fy))) {
      room.set(fx_, fy, '.'); fx(fx_ * TILE, fy * TILE, 'pry'); return true;
    }
    return false;
  },

  // Watering can -> grow a vine up from soil, and douse electrics.
  can(p, room) {
    const hit = p.probeFind(room, t => t === 'bush');
    if (hit) {
      const { x, y } = hit;
      for (let i = 0; i < 5 && y - i >= 0; i++) {
        if (room.at(x, y - i) !== '.' && i > 0) break;
        room.set(x, y - i, 'vine');
      }
      fx(x * TILE, y * TILE, 'grow'); return true;
    }
    return false;
  },

  // Axe -> cut. Removes trees, fences, beams.
  axe(p, room) {
    const CUT = t => t === 'tree' || t === 'fence' || t === 'beam' ||
                     t === 'crate' || t === 'crate_alt';
    const hit = p.probeFind(room, CUT);
    if (hit) { room.set(hit.x, hit.y, '.'); fx(hit.x * TILE, hit.y * TILE, 'chop'); return true; }
    return false;
  },
};

export function drawEffects(ctx) {
  ctx.font = '7px ui-monospace, monospace';
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    ctx.globalAlpha = Math.max(0, e.life / 40);
    ctx.fillStyle = '#ffd866';
    ctx.fillText(e.text, e.x, e.y - (40 - e.life) * 0.25);
    ctx.globalAlpha = 1;
    if (--e.life <= 0) effects.splice(i, 1);
  }
}
