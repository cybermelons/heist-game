import { TILE, load, draw, NAMES } from './atlas.js';
import { LEGEND } from './room.js';

// Reverse the room legend so the editor paints with the same characters a room
// file stores. One source of truth: adding a tile to LEGEND adds it here.
const CHAR = {};
for (const [ch, name] of Object.entries(LEGEND)) if (!(name in CHAR)) CHAR[name] = ch;

const TERRAIN = ['dirt', 'dirt_top', 'stone', 'stone_top', 'grass', 'plank', 'crate', 'ladder'];
const OBJECT  = ['tree', 'bush', 'vine', 'fence', 'chest', 'key', 'gem', 'coin',
                 'door', 'lever_left', 'sign', 'water', 'flag', 'beam'];

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);

let W = 30, H = 12, grid = [], spawn = [{ x: 2, y: 8 }, { x: 4, y: 8 }];
let brush = 'dirt', painting = 0, scale = 2, hover = null;

function blank() { grid = Array.from({ length: H }, () => Array(W).fill('.')); }

// Starter room: a floor, so the first click has something to build against.
function fresh() {
  W = 30; H = 12;
  $('w').value = W; $('h').value = H;
  $('title').value = 'New Room';
  blank();
  for (let x = 0; x < W; x++) { grid[H - 1][x] = 'dirt'; grid[H - 2][x] = 'dirt'; grid[H - 3][x] = 'dirt_top'; }
  spawn = [{ x: 2, y: H - 4 }, { x: 4, y: H - 4 }];
  resize();
}

function swatch(name, host) {
  const d = document.createElement('div');
  d.className = 'sw' + (name === brush ? ' on' : '');
  d.title = name;
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  if (name === 'P1' || name === 'P2') {
    const x = c.getContext('2d');
    x.fillStyle = name === 'P1' ? '#7ee787' : '#ff9ec4';
    x.fillRect(3, 2, 10, 12);
  } else draw(c.getContext('2d'), name, 0, 0);
  d.appendChild(c);
  const s = document.createElement('span');
  s.textContent = CHAR[name] ?? (name[0] || '');
  d.appendChild(s);
  d.onclick = () => {
    brush = name;
    document.querySelectorAll('.sw').forEach(e => e.classList.remove('on'));
    d.classList.add('on');
  };
  host.appendChild(d);
}

function resize() {
  cv.width = W * TILE; cv.height = H * TILE;
  scale = Math.max(1, Math.min(4, Math.floor((innerWidth - 260) / cv.width)));
  cv.style.width = cv.width * scale + 'px';
  cv.style.height = cv.height * scale + 'px';
  ctx.imageSmoothingEnabled = false;
}

function render() {
  ctx.fillStyle = '#242430';
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) draw(ctx, grid[y][x], x * TILE, y * TILE);

  ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x++) { ctx.beginPath(); ctx.moveTo(x*TILE+.5,0); ctx.lineTo(x*TILE+.5,cv.height); ctx.stroke(); }
  for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(0,y*TILE+.5); ctx.lineTo(cv.width,y*TILE+.5); ctx.stroke(); }

  spawn.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? 'rgba(126,231,135,.85)' : 'rgba(255,158,196,.85)';
    ctx.fillRect(s.x * TILE + 3, s.y * TILE + 2, 10, 12);
    ctx.fillStyle = '#14141b'; ctx.font = '7px ui-monospace,monospace';
    ctx.fillText('P' + (i + 1), s.x * TILE + 3, s.y * TILE + 11);
  });

  // Ghost the brush under the cursor, so a click's effect is visible before it
  // happens. Drawn before the spawn warning so the red outline stays on top.
  if (hover && hover.x >= 0 && hover.y >= 0 && hover.x < W && hover.y < H) {
    const hx = hover.x * TILE, hy = hover.y * TILE;
    // A wash behind the ghost. Sparse tiles (tree, key, lever) cover only a few
    // pixels, so the ghost alone is near invisible on the dark grid.
    if (!hover.erase) {
      ctx.fillStyle = 'rgba(255,216,102,.16)';
      ctx.fillRect(hx, hy, TILE, TILE);
    }
    ctx.globalAlpha = 0.6;
    if (hover.erase) {
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(hx, hy, TILE, TILE);
    } else if (brush === 'P1' || brush === 'P2') {
      ctx.fillStyle = brush === 'P1' ? '#7ee787' : '#ff9ec4';
      ctx.fillRect(hx + 3, hy + 2, 10, 12);
    } else {
      draw(ctx, brush, hx, hy);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = hover.erase ? '#ff5f6d' : '#ffd866';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx + .5, hy + .5, TILE - 1, TILE - 1);
  }

  // Warn where a spawn is buried — the bug that froze the first room.
  spawn.forEach((s, i) => {
    const t = (grid[s.y] || [])[s.x] ?? '.';
    const solid = !['.', 'chest','key','gem','coin','door','sign','lever_left','bush','flag','water','vine','ladder'].includes(t);
    if (solid) {
      ctx.strokeStyle = '#ff5f6d'; ctx.lineWidth = 2;
      ctx.strokeRect(s.x * TILE + 1, s.y * TILE + 1, TILE - 2, TILE - 2);
    }
  });
}

function cell(ev) {
  const r = cv.getBoundingClientRect();
  return { x: Math.floor((ev.clientX - r.left) / (TILE * scale)),
           y: Math.floor((ev.clientY - r.top) / (TILE * scale)) };
}
let last = null;

// Undo stack. A whole stroke is one step: snapshot on mousedown, not per cell,
// so one ctrl+z undoes a drag instead of unwinding it tile by tile.
const undos = [], redos = [], LIMIT = 60;

function snap() { return { grid: grid.map(r => r.slice()), spawn: spawn.map(s => ({ ...s })), W, H }; }
function restore(s) {
  grid = s.grid.map(r => r.slice());
  spawn = s.spawn.map(p => ({ ...p }));
  W = s.W; H = s.H;
  $('w').value = W; $('h').value = H;
  resize(); render();
}
function push() {
  undos.push(snap());
  if (undos.length > LIMIT) undos.shift();
  redos.length = 0;            // a new edit abandons the redo branch
  mark();
}
function mark() { $('undo').disabled = !undos.length; $('redo').disabled = !redos.length; }

// Autosave. A browser tool loses everything to a stray reload otherwise, so
// the work in progress lives in localStorage and is restored on load.
const SAVE = 'heist_editor_wip';

function save() {
  try {
    localStorage.setItem(SAVE, JSON.stringify({
      v: 1, W, H, spawn, title: $('title').value, grid, current, at: Date.now(),
    }));
    const t = new Date().toLocaleTimeString();
    $('saved').textContent = 'saved ' + t;
  } catch (e) {
    // Quota or a disabled store: say so rather than pretending work is safe.
    $('saved').textContent = 'NOT SAVED: ' + e.name;
  }
}

// A room read from storage is untrusted: it may predate a legend change, or
// have been hand-edited. Validate before it reaches the grid.
function apply(w) {
  if (!w || !Array.isArray(w.grid) || !w.grid.length || !Array.isArray(w.grid[0])) return false;
  // Trust the stored dimensions only as far as the stored rows actually go.
  H = w.grid.length; W = w.grid[0].length;
  grid = w.grid.map(r => {
    const row = r.slice(0, W);
    while (row.length < W) row.push('.');       // ragged rows would break indexing
    // Unknown tile names would draw magenta forever; drop them to empty.
    return row.map(t => (t in NAMES ? t : '.'));
  });
  spawn = (w.spawn || []).slice(0, 2).map(s => ({ x: s.x | 0, y: s.y | 0 }));
  while (spawn.length < 2) spawn.push({ x: 2, y: H - 4 });
  spawn = spawn.map(s => ({ x: Math.min(Math.max(s.x, 0), W - 1),
                           y: Math.min(Math.max(s.y, 0), H - 1) }));
  $('title').value = w.title || 'New Room';
  $('w').value = W; $('h').value = H;
  return true;
}

function loadWip() {
  let w;
  try { w = JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch { return false; }
  if (!w || w.v !== 1 || !apply(w)) return false;
  current = typeof w.current === 'string' ? w.current : '';
  return true;
}

// Room library. Named rooms, many of them, in localStorage. Separate from the
// work-in-progress autosave: that is the current desk, this is the shelf.
const LIB = 'heist_editor_lib';

function lib() {
  try { const l = JSON.parse(localStorage.getItem(LIB) || '{}'); return l && typeof l === 'object' ? l : {}; }
  catch { return {}; }
}
function libWrite(l) {
  try { localStorage.setItem(LIB, JSON.stringify(l)); return true; }
  catch (e) { $('saved').textContent = 'LIBRARY NOT SAVED: ' + e.name; return false; }
}

function slug(name) { return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'room'; }

function refreshLib() {
  const l = lib(), names = Object.keys(l).sort();
  const sel = $('lib');
  sel.innerHTML = '<option value="">— library —</option>' +
    names.map(k => `<option value="${k}">${l[k].title || k}</option>`).join('');
  sel.value = current;
  $('libdel').disabled = !current || !(current in l);
  $('status').textContent = `${names.length} saved`;
}

let current = '';   // library key the editor is currently editing, '' = unsaved

// True when the room on screen differs from its saved library copy, so the
// picker can warn before replacing it. Undo covers a mistake, but only if you
// notice in time.
function dirty() {
  if (!current) return grid.some(r => r.some(t => t !== '.'));
  const w = lib()[current];
  if (!w) return true;
  return JSON.stringify({ g: grid, s: spawn, t: $('title').value }) !==
         JSON.stringify({ g: w.grid, s: w.spawn, t: w.title });
}

function saveToLib(askName) {
  const l = lib();
  let key = current;
  if (askName || !key) {
    const proposed = slug($('title').value);
    const name = prompt('Save room as:', proposed);
    if (name === null) return;
    key = slug(name);
    if (key in l && !confirm(`"${key}" exists. Overwrite?`)) return;
  }
  l[key] = { v: 1, title: $('title').value.trim() || key, spawn, grid, at: Date.now() };
  if (!libWrite(l)) return;
  current = key;
  refreshLib();
  $('saved').textContent = `saved to library: ${key}`;
}

function loadFromLib(key) {
  if (!key) { $('lib').value = current; return; }
  if (key === current) return;
  if (dirty() && !confirm('The room on screen has unsaved changes. Load anyway?')) {
    $('lib').value = current;   // put the picker back, nothing was loaded
    return;
  }
  const w = lib()[key];
  if (!w) { refreshLib(); return; }   // vanished (another tab deleted it)
  push();                       // loading is undoable, like any other edit
  if (!apply(w)) { alert(`"${key}" could not be read and was left alone.`); return; }
  current = key;
  resize(); render(); save(); refreshLib();
}

function deleteFromLib() {
  const l = lib();
  if (!current || !(current in l)) return;
  if (!confirm(`Delete "${current}" from the library? The room on screen stays.`)) return;
  delete l[current];
  libWrite(l);
  current = '';
  refreshLib();
}

function undo() { if (!undos.length) return; redos.push(snap()); restore(undos.pop()); mark(); save(); }
function redo() { if (!redos.length) return; undos.push(snap()); restore(redos.pop()); mark(); save(); }

function put(x, y, erase) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  if (brush === 'P1' || brush === 'P2') spawn[brush === 'P1' ? 0 : 1] = { x, y };
  else grid[y][x] = erase ? '.' : brush;
}

function paint(ev, erase) {
  const { x, y } = cell(ev);
  // Mouse events are sampled, not continuous: without interpolating from the
  // previous cell a fast drag leaves gaps in the painted line.
  if (last && (last.x !== x || last.y !== y)) {
    let dx = Math.abs(x - last.x), dy = Math.abs(y - last.y);
    let sx = last.x < x ? 1 : -1, sy = last.y < y ? 1 : -1;
    let cx = last.x, cy = last.y, err = dx - dy;
    for (;;) {
      put(cx, cy, erase);
      if (cx === x && cy === y) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }
  } else put(x, y, erase);
  last = { x, y };
  hover = { x, y, erase };
  render();
}

cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousedown', e => {
  push();
  painting = e.button === 2 ? 2 : 1;
  paint(e, e.button === 2);
});
addEventListener('mouseup', () => { if (painting) { painting = 0; last = null; save(); } });
cv.addEventListener('mousemove', e => {
  if (painting) { paint(e, painting === 2); return; }   // paint() renders already
  const { x, y } = cell(e);
  // Only redraw when the cursor crosses into a different tile.
  if (hover && hover.x === x && hover.y === y) return;
  hover = { x, y, erase: false };
  render();
});
cv.addEventListener('mouseleave', () => { hover = null; render(); });

function rows() {
  return grid.map(r => {
    const s = r.map(n => CHAR[n] ?? ' ').join('');
    return s.replace(/\s+$/, '');          // trim trailing blanks, keep it readable
  });
}

function moduleText() {
  const id = ($('title').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'room');
  const body = rows().map(r => `    '${r.replace(/'/g, "\\'")}',`).join('\n');
  return `import { parse } from '../src/room.js';

export default {
  id: '${id}',
  title: ${JSON.stringify($('title').value.trim() || id)},
  spawn: [{ x: ${spawn[0].x}, y: ${spawn[0].y} }, { x: ${spawn[1].x}, y: ${spawn[1].y} }],

  tiles: parse([
${body}
  ]),

  reset(state) { state.got = false; },

  // Default goal: either player touches the gem. Replace with your own puzzle.
  check(state, room, players) {
    for (const p of players) {
      const tx = Math.floor((p.x + p.w / 2) / 16), ty = Math.floor((p.y + p.h / 2) / 16);
      if (room.at(tx, ty) === 'gem') { room.set(tx, ty, '.'); state.got = true; }
    }
    return state.got;
  },
};
`;
}

$('export').onclick = () => {
  $('code').value = moduleText();
  $('out').style.display = 'flex';
};
$('close').onclick = () => $('out').style.display = 'none';
$('copy').onclick = async () => {
  await navigator.clipboard.writeText($('code').value);
  $('copy').textContent = 'copied';
  setTimeout(() => $('copy').textContent = 'copy', 1200);
};

// Test without saving: stash the room and open the game, which reads it back.
$('test').onclick = () => {
  localStorage.setItem('heist_draft', JSON.stringify({
    id: 'draft', title: $('title').value || 'Draft',
    spawn, rows: rows(),
  }));
  // Same tab, not a popup: a new tab has no history, so there is nothing for
  // the game's "back to editor" button or the browser Back to return to.
  location.href = 'index.html?room=draft';
};

$('resize').onclick = () => {
  const nw = +$('w').value, nh = +$('h').value;
  if (nw === W && nh === H) return;
  push();
  const old = grid;
  W = nw; H = nh; blank();
  for (let y = 0; y < Math.min(nh, old.length); y++)
    for (let x = 0; x < Math.min(nw, old[y].length); x++) grid[y][x] = old[y][x];
  spawn = spawn.map(s => ({ x: Math.min(s.x, W - 1), y: Math.min(s.y, H - 1) }));
  resize(); render(); save();
};
$('clear').onclick = () => { if (confirm('Clear the whole room?')) { push(); blank(); render(); save(); } };
addEventListener('keydown', e => {
  if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // typing a title, not editing
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
});
$('title').addEventListener('input', save);
$('reset').onclick = () => {
  if (!confirm('Discard the saved work in progress and start a fresh room?')) return;
  push(); localStorage.removeItem(SAVE); current = ''; fresh(); render(); save(); refreshLib();
};
$('lib').onchange = e => loadFromLib(e.target.value);
$('libsave').onclick = () => saveToLib(false);
$('libsaveas').onclick = () => saveToLib(true);
$('libdel').onclick = deleteFromLib;
$('undo').onclick = undo;
$('redo').onclick = redo;

addEventListener('resize', () => { resize(); render(); });

load().then(() => {
  TERRAIN.forEach(n => swatch(n, $('pal_terrain')));
  OBJECT.forEach(n => swatch(n, $('pal_object')));
  ['P1', 'P2'].forEach(n => swatch(n, $('pal_spawn')));
  if (!loadWip()) fresh();
  resize(); render(); mark(); save(); refreshLib();
});
