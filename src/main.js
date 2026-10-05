import { TILE, load } from './atlas.js';
import { Room } from './room.js';
import { Player, MAPS, TOOLS } from './player.js';
import { tools, drawEffects } from './tools.js';
import { ROOMS } from '../rooms/index.js';
import { parse } from './room.js';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const hud = document.getElementById('hud');
const keys = new Set();
let room, players, idx = 0, solvedAt = 0;

addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyR') loadRoom(idx);
  for (const p of players || []) {
    const i = p.map.tools.indexOf(e.code);
    if (i >= 0) p.tool = i;
    if (e.code === p.map.use) {
      const t = TOOLS[p.tool];
      tools[t](p, room, room.state);
    }
  }
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Slash'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));

function loadRoom(i) {
  idx = Math.max(0, Math.min(ROOMS.length - 1, i));
  room = new Room(ROOMS[idx]);
  players = room.def.spawn.map((s, n) => new Player(s.x, s.y, MAPS[n]));
  for (const p of players) p.reset(room);
  solvedAt = 0;
  resize();
}

function resize() {
  if (!room) return;
  const scale = Math.max(2, Math.min(
    Math.floor(innerWidth / (room.w * TILE)),
    Math.floor((innerHeight - 40) / (room.h * TILE))));
  cv.width = room.w * TILE; cv.height = room.h * TILE;
  cv.style.width = cv.width * scale + 'px';
  cv.style.height = cv.height * scale + 'px';
  ctx.imageSmoothingEnabled = false;   // integer scale only; no shimmer
}
addEventListener('resize', resize);

function frame() {
  if (room) {
    for (const p of players) p.update(room, keys);
    if (room.check(players) && !solvedAt) solvedAt = performance.now();
    if (solvedAt && performance.now() - solvedAt > 1200 && idx < ROOMS.length - 1) loadRoom(idx + 1);

    ctx.fillStyle = '#242430';
    ctx.fillRect(0, 0, cv.width, cv.height);
    room.draw(ctx);
    for (const p of players) p.draw(ctx);
    drawEffects(ctx);

    if (solvedAt) {
      ctx.fillStyle = 'rgba(20,20,28,.72)';
      ctx.fillRect(0, cv.height / 2 - 12, cv.width, 24);
      ctx.fillStyle = '#7ee787'; ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ROOM CLEAR', cv.width / 2, cv.height / 2 + 3);
      ctx.textAlign = 'left';
    }
    hud.innerHTML = `<b>${room.title}</b> &nbsp; ` +
      players.map((p, i) => `P${i + 1}:${TOOLS[p.tool]}`).join(' &nbsp; ') +
      ` &nbsp; <span style="opacity:.55">R=reset &nbsp; P1 WASD+Shift+1234 &nbsp; P2 arrows+/+numpad</span>`;
  }
  requestAnimationFrame(frame);
}

// debug hook for headless tests
window.__dbg = () => ({
  room: room && room.title, solved: room && room.done,
  players: players.map(p => ({ x: Math.round(p.x), y: Math.round(p.y),
                               vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2),
                               onGround: p.onGround, tool: TOOLS[p.tool] })),
});
window.__key = (code, down) => { down ? keys.add(code) : keys.delete(code); };
window.__room = () => room;
window.__players = () => players;

load().then(() => {
  const want = new URLSearchParams(location.search).get('room');

  // ?room=draft plays the editor's unsaved room straight from localStorage.
  if (want === 'draft') {
    const d = JSON.parse(localStorage.getItem('heist_draft') || 'null');
    if (d) {
      ROOMS.push({
        id: 'draft', title: d.title, spawn: d.spawn, tiles: parse(d.rows),
        reset(st) { st.got = false; },
        check(st, room, players) {
          for (const p of players) {
            const tx = Math.floor((p.x + p.w / 2) / 16), ty = Math.floor((p.y + p.h / 2) / 16);
            if (room.at(tx, ty) === 'gem') { room.set(tx, ty, '.'); st.got = true; }
          }
          return st.got;
        },
      });
      loadRoom(ROOMS.length - 1); frame(); return;
    }
  }

  const found = ROOMS.findIndex(r => r.id.startsWith(want || ''));
  loadRoom(want && found >= 0 ? found : 0);
  frame();
});
