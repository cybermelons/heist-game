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

// Physics constants are per-step, so the step has to be a fixed duration or the
// game runs at the display's speed: double on a 120Hz panel, slow when a laptop
// throttles. Simulate in fixed 1/60s steps and draw whatever the frame lands on.
const STEP = 1000 / 60, MAX_CATCHUP = 5;
let acc = 0, prev = 0;
let hudText = '';

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
  acc = 0; prev = 0;
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

function frame(now) {
  // The first call comes from bootstrap, not rAF, so there is no timestamp.
  if (now === undefined) now = performance.now();
  if (room) {
    if (!prev) prev = now;
    // Clamp the catch-up: a backgrounded tab returns with a huge delta, and
    // simulating all of it at once teleports players through walls.
    acc = Math.min(acc + (now - prev), STEP * MAX_CATCHUP);
    prev = now;

    for (; acc >= STEP; acc -= STEP) {
      for (const p of players) p.update(room, keys);
      if (room.check(players) && !solvedAt) solvedAt = now;
    }
    if (solvedAt && now - solvedAt > 1200 && idx < ROOMS.length - 1) loadRoom(idx + 1);

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
    // Only touch the DOM when the text actually changes. Rewriting innerHTML
    // every frame was 60 parses a second for a string that changes on a keypress.
    const t = `<b>${room.title}</b> &nbsp; ` +
      players.map((p, i) => `P${i + 1}:${TOOLS[p.tool]}`).join(' &nbsp; ') +
      ` &nbsp; <span style="opacity:.55">R=reset &nbsp; P1 WASD+Shift+1234 &nbsp; P2 arrows+/+numpad</span>`;
    if (t !== hudText) { hud.innerHTML = t; hudText = t; }
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
      // Testing a draft is a round trip: offer the way back, by button or Esc.
      const back = document.getElementById('back');
      const toEditor = () => {
        if (history.length > 1) history.back();   // keeps the editor's scroll/brush
        else location.href = 'edit.html';
      };
      if (back) { back.style.display = 'block'; back.onclick = toEditor; }
      addEventListener('keydown', e => { if (e.code === 'Escape') toEditor(); });

      loadRoom(ROOMS.length - 1); frame(); return;
    }
  }

  const found = ROOMS.findIndex(r => r.id.startsWith(want || ''));
  loadRoom(want && found >= 0 ? found : 0);
  frame();
});
