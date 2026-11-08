// The Paloma, World 2's basic enemy (GDD-ENM-03): the rock pigeon of every Mexican plaza (Columba livia), the bird of "Cucurrucucú
// paloma". Plump and round-breasted with a small proud head, pigeon grey with two dark wing bars, a dark tail band and the iridescent
// teal and rosa neck; a big gold eye. Come close and it puffs up (the courtship puff: ruff flared, chest out, tail fanned, cooing), then
// claps up into the air. Drawn in code (GDD-ART-01) in World 2's colours and the outline (GDD-ART-05, GDD-ART-06), in drawing px (2 x 2
// art px, half a game px). Facing right; standing frames have the feet's outline on the frame's bottom row.
import { ellipse, Grid, or, polygon, stroke } from '../raster.mjs';
import { flashed, OUTLINE, shaded, W2 } from './kit.mjs';

/** 24 x 20 game px. */
export const FRAME = { w: 48, h: 40 };
/** The 14 x 12 game px hit box (tuning PALOMA). */
export const BOX = { x0: 10, y0: 16, x1: 38, y1: 40 };
export const LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'tele', 'teleRed', 'flap0', 'flap1', 'flap2', 'flap3', 'glide', 'squash', 'hit'];

// Materials as [light, base, shadow], light from the upper left.
const BODY = [W2.farLit, W2.far, W2.farShade];
const WING = [W2.far, W2.farShade, W2.farShade];
const FAR_WING = [W2.farShade, W2.farShade, W2.street];
const LEG = [W2.plasterLit, W2.plaster, W2.plasterShade];

const rad = (d) => (d * Math.PI) / 180;
const and = (...t) => (x, y) => t.every((f) => f(x, y));
const not = (t) => (x, y) => !t(x, y);

const KEY = {
  k: OUTLINE, i: W2.iron, y: W2.yellow, w: W2.glaze, t: W2.teal, r: W2.rosa, s: W2.street,
  L: W2.farLit, B: W2.far, D: W2.farShade, p: W2.plaster, P: W2.plasterLit, q: W2.plasterShade,
};
/** Paints a pixel map (rows of KEY letters, '.' empty) with its top left at (ox, oy). */
function stamp(g, rows, ox, oy) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g.set(ox + x, oy + y, KEY[ch]); }));
}

/**
 * Paints `test` with `mat` (shaded, `opt` its depths) on its own layer and lays it on; with `ring`, that colour is drawn all round it
 * on what it covers first (an inner outline, so a wing stands off the body under it).
 */
function layer(g, test, mat, { ring = null, ...opt } = {}) {
  const l = new Grid(g.width, g.height);
  shaded(l, test, mat, opt);
  if (ring) {
    const marks = [];
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
      if (!l.get(x, y)) continue;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const c = g.get(x + dx, y + dy);
        if (c && c !== OUTLINE && !l.get(x + dx, y + dy)) marks.push([x + dx, y + dy]);
      }
    }
    for (const [x, y] of marks) g.set(x, y, ring);
  }
  for (let i = 0; i < l.cells.length; i++) if (l.cells[i]) g.cells[i] = l.cells[i];
  return l;
}

/** The eyes, 5 x 5 at the head's eye point: a gold ring round a big iron pupil looking forward, a glaze glint. */
const EYES = {
  cocky: ['.DDD.', 'DDDDD', 'kkkkk', 'yywiy', '.yyy.'], // the grey lid half down, the pupil forward: unimpressed and proud
  wide: ['.yyy.', 'yyyyy', 'yywiy', 'yyiiy', '.yyy.'],
  x: ['k...k', '.k.k.', '..k..', '.k.k.', 'k...k'],
};
const BEAKS = {
  shut: ['ww..', 'wiii', '.ii.'],
  open: ['ww..', 'wiii', '....', '....', 'iii.'], // cooing: cucurrucucú
};

/** A leg from its hip down to its foot, 2 px wide, three toes forward on the foot's row (or curled, `curl`). */
function leg(g, [hx, hy], [fx, fy], near, curl = false) {
  const [l, b, d] = LEG;
  for (let y = hy; y < fy; y++) {
    const t = fy - 1 === hy ? 1 : (y - hy) / (fy - 1 - hy);
    const x = Math.round(hx + (fx - hx) * t);
    g.set(x, y, near ? b : d);
    g.set(x + 1, y, d);
  }
  if (curl) { g.set(fx, fy, near ? b : d); g.set(fx + 1, fy, d); g.set(fx + 2, fy - 1, near ? l : d); return; }
  for (let x = fx - 1; x <= fx + 2; x++) g.set(x, fy, near ? (x === fx - 1 ? d : x === fx + 2 ? b : l) : d);
}

/**
 * An open wing from `sh` (the shoulder), `a` degrees from straight back (+ up, - down), `len` from the shoulder to the longest tip:
 * a broad arm (coverts and secondaries) lit along its leading edge with the two dark bars near its trailing edge, and a hand of four
 * separate primaries fanning out from it, `spread` degrees apart, dark with street tips (the Zopilote's finger feathers, smaller).
 */
function openWing(g, sh, { a, len, chord = 1, spread = 6 }, far) {
  const r = rad(a);
  const d = [-Math.cos(r), -Math.sin(r)];
  const t = a >= 0 ? [d[1], -d[0]] : [-d[1], d[0]]; // towards the trailing edge
  const L = (u, v) => [sh[0] + u * d[0] + v * t[0] * chord, sh[1] + u * d[1] + v * t[1] * chord];
  const local = (x, y) => {
    const dx = x - sh[0], dy = y - sh[1];
    return [dx * d[0] + dy * d[1], (dx * t[0] + dy * t[1]) / chord];
  };
  const h = len * 0.5; // where the hand starts
  const arm = polygon([L(-1, -2.2), L(h + 0.6, -2.4), L(h + 1, 7.6), L(h * 0.7, 7.4), L(h * 0.35, 7.2), L(0, 6.6), L(-1, 4.5)]);
  // The primaries: each a 2 px feather from the hand's root, the leading one longest, fanning back towards the trailing edge.
  const reach = len - h;
  const feathers = [0, 1, 2, 3].map((i) => {
    const base = [h - 0.5, -1.3 + i * 2.8 * chord];
    const f = rad(i * spread);
    const l = reach * (1 - i * 0.1);
    const tip = [base[0] + Math.cos(f) * l, base[1] + Math.sin(f) * l];
    return { test: stroke([L(...base), L(...tip)], 2), tip: L(...tip), base: L(...base), l };
  });
  const shape = or(arm, ...feathers.map((f) => f.test));
  layer(g, shape, far ? FAR_WING : WING, { ring: far ? null : OUTLINE });
  // The feathers' tips, a third of each, in street; on the near wing the feathers' leading edges stay lit.
  for (const f of feathers) {
    const near = (x, y) => Math.hypot(x - f.tip[0], y - f.tip[1]) < f.l * 0.36;
    g.fill(and(f.test, near), W2.street, true);
  }
  if (far) return;
  // The two bars: 1 px lines across the arm near its trailing edge, on an arm long and broad enough to carry them.
  if (h < 6 || chord < 1) return;
  for (const v0 of [3, 5]) {
    g.fill(and(arm, (x, y) => { const [u, v] = local(x, y); return u > h * 0.3 && u < h * 0.95 && v > v0 && v < v0 + 0.9; }), W2.street, true);
  }
}

/**
 * The near wing at the bottom of the clap's down-stroke (flap2), drawn by hand-placed shapes: the arm hangs from the shoulder down the
 * body's side and the four primaries fan out below the belly, the front one longest, each 2 px wide, outlined apart, street tips.
 */
function downWing(g, by) {
  const arm = polygon([[21.5, by - 6], [27, by - 5.5], [28, by - 1], [27, by + 4.6], [15.6, by + 4.6], [17, by]]);
  const feathers = [0, 1, 2, 3].map((i) => stroke([[17.2 + 2.9 * i, by + 3.5], [14.4 + 3.3 * i, by + 9.2 + i * 0.5]], 2));
  const shape = or(arm, ...feathers);
  layer(g, shape, WING, { ring: OUTLINE });
  feathers.forEach((f, i) => g.fill(and(f, (x, y) => y > by + 6.6 + i * 0.5), W2.street, true));
  for (const k of [2.4, 4.6]) g.fill(and(arm, (x, y) => y > by - 3 && Math.abs(x - (16.6 + k + (by + 4.6 - y) * 0.3)) < 0.55), W2.street, true);
}

/** The plumage's tones: a lone one of these, matching none of its eight neighbours, is a stray left by the shapes' edges. */
const GREYS = [W2.farLit, W2.far, W2.farShade, W2.street];

/** Recolours each stray plumage pixel inside the bird to its neighbours' commonest colour: crisp clusters, no single-pixel noise. */
function tidy(g) {
  const fix = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    const c = g.get(x, y);
    if (!GREYS.includes(c)) continue;
    const n = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) n.push(g.get(x + i, y + j));
    const painted = n.filter(Boolean);
    if (painted.length < 6 || painted.includes(c)) continue;
    const count = new Map();
    for (const v of painted.filter((v) => GREYS.includes(v))) count.set(v, (count.get(v) ?? 0) + 1);
    if (count.size) fix.push([x, y, [...count].sort((p, q) => q[1] - p[1])[0][0]]);
  }
  for (const [x, y, c] of fix) g.set(x, y, c);
}

/**
 * The pigeon, facing right.
 * - `dy`: the body's bob; `head`: the head's offset [dx, dy]; `puff`: the courtship puff (0 to 2).
 * - `wing`: 'folded' | 'raised' (the puff) | null; `near` / `far`: open wing poses for `openWing`; `tail`: 'down' | 'fan'.
 * - `legs`: [near, far] stand poses ('plant' | 'reach' | 'push' | 'lift'), 'dangle' (ready to land), 'tuck' (flying) or null.
 * - `eye`: an EYES key or null; `beak`: a BEAKS key.
 * - `relit`: light and shadow swapped, for a frame then turned upside down; `outline`: false leaves it off.
 */
function drawBird({ dy = 0, head = [0, 0], puff = 0, wing = 'folded', near = null, far = null, tail = 'down', legs = ['plant', 'plant'], eye = 'cocky', beak = 'shut', relit = false, outline = true } = {}) {
  const g = new Grid(FRAME.w, FRAME.h);
  const M = (mat) => (relit ? [mat[2], mat[1], mat[0]] : mat);
  const by = 29 + dy; // the body's centre row
  const H = [33 + head[0], 21.5 + dy + head[1]]; // the head's centre
  const shoulder = [24, by - 4];

  // The far wing, behind everything.
  if (far) openWing(g, [shoulder[0] + 2, shoulder[1] - 1], far, true);
  // The tail: folded down behind, or fanned up and spread; grey with its dark band at the tip.
  if (tail === 'fan') {
    // Five feathers spread from the rump, up and back, each tip round: a wedge and a round tip per feather.
    const root = [16, by - 1];
    const R = 10 + puff * 0.6;
    const angs = [0.05, 0.33, 0.61, 0.89, 1.17].map((k) => k + puff * 0.05);
    const tip = (k, r) => [root[0] - Math.cos(k) * r, root[1] - Math.sin(k) * r];
    const fan = or(polygon([root, ...angs.map((k) => tip(k, R - 1))]), ...angs.map((k) => ellipse(...tip(k, R - 1.4), 2.1, 2.1)));
    layer(g, fan, M(BODY));
    g.fill((x, y) => fan(x, y) && Math.hypot(root[0] - x, root[1] - y) > R - 2.6, W2.street, true);
    // The feathers' parting lines, between the tips.
    for (let f = 0; f < 4; f++) {
      const k = (angs[f] + angs[f + 1]) / 2;
      for (let r = 3.5; r < R - 2.6; r += 0.4) {
        const [x, y] = tip(k, r).map(Math.floor);
        if (g.get(x, y) === W2.far || g.get(x, y) === W2.farLit) g.set(x, y, W2.farShade);
      }
    }
  } else {
    // Short and angled down about 20 degrees from the back, its tip squared off.
    const t = polygon([[15, by - 3.5], [6.2, by + 0.2], [5.4, by + 3.4], [7, by + 5.2], [16, by + 3]]);
    layer(g, t, M(BODY));
    g.fill((x, y) => t(x, y) && x < 8.6 - (y - by) * 0.35, W2.street, true);
  }

  // The legs (the far one darker, behind the belly).
  const hip = by + 4;
  const stand = (p, x0) => ({ plant: [x0, 38], reach: [x0 + 2, 38], push: [x0 - 2, 38], lift: [x0 + 1, 37] })[p];
  if (legs === 'dangle') leg(g, [19, hip], [17, 37], false, true);
  else if (legs === 'tuck') leg(g, [19, hip], [16, hip + 2], false, true);
  else if (Array.isArray(legs)) leg(g, [19, hip], stand(legs[1], 19), false, legs[1] === 'lift');

  // The plump body and the round breast, thrust out further in the puff.
  // The back rises from the tail toward the head; the domed breast is the biggest mass.
  const breast = ellipse(27.6 + puff * 0.2, by - 1.8 - puff * 0.25, 8.4 + puff * 0.7, 7.6 + puff * 0.7);
  const body = or(ellipse(18.5, by + 0.6, 8.6 + puff * 0.5, 5.6 + puff * 0.5, -0.32), breast);
  layer(g, body, M(BODY));
  // A ball, not a slab: a lit area on the upper breast and a cluster of shadow under the belly.
  if (!relit) {
    g.fill(and(body, ellipse(31 + puff * 0.3, by - 0.6 - puff * 0.3, 3.2 + puff * 0.5, 2.4 + puff * 0.4, -0.6), (x, y) => g.get(Math.floor(x), Math.floor(y)) === W2.far), W2.farLit, true);
    g.fill(and(body, ellipse(24 + puff * 0.3, by + 6 + puff * 0.5, 9, 2.4), (x, y) => g.get(Math.floor(x), Math.floor(y)) === W2.far), W2.farShade, true);
  }
  // The neck from the breast up to the head, its iridescence teal with a rosa sheen; in the puff a flared ruff round it.
  const nx = (H[0] + 29) / 2, ny = (H[1] + by - 4) / 2 + 1;
  const neck = ellipse(nx, ny, 4.2 + puff * 0.9, 4.6 + puff * 0.5, 0.25);
  const ruff = puff ? or(neck, polygon([[nx - 2, ny - 3 - puff], [nx - 6.5 - puff, ny - 3], [nx - 4, ny - 1.5], [nx - 7 - puff, ny + 0.5], [nx - 3, ny + 2]])) : neck;
  layer(g, ruff, M(BODY));
  const headTest = ellipse(H[0], H[1], 4.7, 4.4);
  g.fill(and(ruff, not(headTest), ellipse(nx + 0.4, ny + 0.6, 4.6 + puff, 3.6 + puff * 0.7)), W2.teal, true);
  g.fill(and(ruff, not(headTest), ellipse(nx - 0.6, ny + 0.4, 2.6 + puff * 0.5, 1.9 + puff * 0.4)), W2.rosa, true);

  // The folded wing along the side, a touch darker, its two dark bars and its dark tips over the tail.
  if (wing === 'folded' || wing === 'raised') {
    // `raised`: turned up about the shoulder, the tips lifted off the back (the puff).
    const turn = wing === 'raised' ? rad(-24) : 0, pv = [26, by - 2];
    const T = (test) => (x, y) => {
      const dx = x - pv[0], dy = y - pv[1], c = Math.cos(turn), s = Math.sin(turn);
      return test(pv[0] + dx * c - dy * s, pv[1] + dx * s + dy * c);
    };
    const w0 = polygon([[20.5, by - 5], [25.4, by - 3.4], [25.6, by + 0.8], [21, by + 3], [14, by + 3.2], [8.4, by + 2.4], [11.5, by - 1.4], [15.5, by - 4]]);
    const w = T(w0);
    layer(g, w, M(WING), { ring: W2.street });
    g.fill(and(w, T((x, y) => x < 10.5)), W2.street, true);
    for (const bx of [15, 18.5]) g.fill(and(w, T((x, y) => Math.abs(x - (bx - (y - by) * 0.45)) < 0.9 && y > by - 2)), W2.street, true);
  }

  // The head: small and round, the gold eye and the iron beak with its white cere.
  layer(g, headTest, M(BODY));
  stamp(g, BEAKS[beak], Math.floor(H[0]) + 4, Math.floor(H[1]));

  // The near leg, in front.
  if (legs === 'dangle') leg(g, [24, hip], [23, 38], true, true);
  else if (legs === 'tuck') leg(g, [23, hip], [20, hip + 3], true, true);
  else if (Array.isArray(legs)) leg(g, [24, hip], stand(legs[0], 24), true, legs[0] === 'lift');
  // The near wing, open, over everything.
  if (near === 'down') downWing(g, by);
  else if (near) openWing(g, shoulder, near, false);
  tidy(g);
  if (eye) stamp(g, EYES[eye], Math.floor(H[0]) - 2, Math.floor(H[1]) - 3);
  if (outline) g.outline(OUTLINE, 1);
  return g;
}

/** The walk, one frame per 2 game px: the head thrust forward, then held still while the body catches up; legs in turn, a 1 px bob. */
const WALK = [
  { head: [2, 1], legs: ['reach', 'push'] },
  { dy: 1, head: [-1, 0], legs: ['lift', 'plant'] },
  { head: [2, 1], legs: ['push', 'reach'] },
  { dy: 1, head: [-1, 0], legs: ['plant', 'lift'] },
];

/** A feather knocked loose, drifting: 4 x 4. */
const LOOSE = [['..LB', '.LBD', 'LBD.', 's...'], ['BL..', 'DBL.', '.DBL', '...s']];

/**
 * Stomped (GDD-ENM-03): flattened to half height, drawn with the standing bird's shapes squashed: the domed breast still the biggest
 * mass with its light on top, the wing and its bars along the back, the tail flat behind, the head pressed down at the front with X
 * eyes, the feet splayed; two loose feathers drifting over it.
 */
function drawSquash() {
  const g = new Grid(FRAME.w, FRAME.h);
  const tail = polygon([[14, 32.5], [5.4, 34.4], [5.4, 37.4], [14, 37.6]]);
  layer(g, tail, BODY);
  g.fill((x, y) => tail(x, y) && x < 8.4, W2.street, true);
  const breast = ellipse(25.5, 33.4, 9.6, 5.4);
  const body = or(ellipse(17, 34.6, 9, 3.4), breast);
  layer(g, body, BODY);
  g.fill(and(body, ellipse(24, 30.6, 4.6, 1.8), (x, y) => g.get(Math.floor(x), Math.floor(y)) === W2.far), W2.farLit, true);
  g.fill(and(body, ellipse(24, 38, 9, 1.5), (x, y) => g.get(Math.floor(x), Math.floor(y)) === W2.far), W2.farShade, true);
  const wing = polygon([[22, 31.4], [25, 33], [23, 35.6], [15, 36], [9, 35], [13, 32.2]]);
  layer(g, wing, WING, { ring: W2.street });
  g.fill(and(wing, (x, y) => x < 11.5), W2.street, true);
  for (const bx of [15.5, 18.5]) g.fill(and(wing, (x, y) => Math.abs(x - bx) < 0.6 && y > 33), W2.street, true);
  g.fill(and(breast, ellipse(30.4, 34.6, 3, 2.2)), W2.teal, true);
  g.fill(and(breast, ellipse(29.6, 34, 1.6, 1.1)), W2.rosa, true);
  layer(g, ellipse(34.4, 34.6, 4.4, 3.2), BODY, { ring: OUTLINE });
  tidy(g);
  stamp(g, ['ww..', 'wiii', '.ii.'], 38, 34);
  stamp(g, ['k.k', '.k.', 'k.k'], 34, 33);
  stamp(g, ['qpPP'], 11, 38);
  stamp(g, ['qpPP'], 26, 38);
  stamp(g, LOOSE[0], 12, 21);
  stamp(g, LOOSE[1], 27, 18);
  g.outline(OUTLINE, 1);
  return g;
}

/** Knocked (GDD-ENM-03): turned over onto its back, feet up, X eyes; drawn relit, flipped top to bottom and moved down onto the box. */
function drawHit() {
  const up = drawBird({ eye: 'x', relit: true, legs: ['reach', 'push'] });
  const g = new Grid(FRAME.w, FRAME.h);
  for (let y = 0; y < FRAME.h; y++) for (let x = 0; x < FRAME.w; x++) {
    const c = up.get(x, y);
    if (c) g.set(x, FRAME.h - 1 - y + 16, c);
  }
  return g;
}

function drawLook(look) {
  if (look.startsWith('walk')) return drawBird(WALK[Number(look[4])]);
  switch (look) {
    case 'tele': return drawBird({ puff: 2, head: [-1, 0], wing: 'raised', tail: 'fan', beak: 'open', eye: 'wide' });
    case 'teleRed': return flashed(drawLook('tele'));
    // The clap: the wings meet high over the back, sweep down, are fully down under the body and come up again.
    case 'flap0': return drawBird({ wing: null, near: { a: 100, len: 20 }, far: { a: 80, len: 19 }, tail: 'fan', legs: 'tuck', eye: 'wide' });
    case 'flap1': return drawBird({ wing: null, near: { a: 12, len: 20 }, far: { a: 30, len: 16 }, tail: 'fan', legs: 'tuck', eye: 'wide', head: [0, 1] });
    case 'flap2': return drawBird({ wing: null, near: 'down', far: { a: -40, len: 12 }, tail: 'fan', legs: 'tuck', eye: 'wide', dy: -3, head: [0, 3] });
    case 'flap3': return drawBird({ wing: null, near: { a: 45, len: 15, chord: 0.8 }, far: { a: 60, len: 13 }, tail: 'fan', legs: 'tuck', eye: 'wide' });
    case 'glide': return drawBird({ wing: null, near: { a: 48, len: 19 }, far: { a: 62, len: 17 }, tail: 'fan', legs: 'dangle', eye: 'wide' });
    case 'squash': return drawSquash();
    case 'hit': return drawHit();
    default: throw new Error(`no look ${look}`);
  }
}

/** Every frame in LOOKS order: [{ look, grid }], each FRAME.w x FRAME.h drawing px. */
export function drawFrames() {
  return LOOKS.map((look) => ({ look, grid: drawLook(look) }));
}
