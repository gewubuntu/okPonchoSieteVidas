// GDD-ENM-04, GDD-ART-05 (L-059): every frame the Armadillo shows fits the room it has in lab-3a, where each of its looks is shown: walking
// on the floor and up and down the ramp, tucked and rolling in the pen under its roof, down and up the ramp, off the ledge and falling, at
// the cart in the rail's piece, dazed against the wall that stopped it, and its defeat (squashed by a stomp, knocked over by a cart) and the
// poof. Each piece is played with a bot's inputs, as `src/levels/lab3a.test.ts` plays them, and every live Armadillo is posed as the scene
// poses it (`enemyPose`), every defeat as the scene draws it (`stepDefeats`, `defeatLook`); every painted pixel of its frame is placed in the
// level, half a game px a pixel. Ground is a level tile and the sand under a slope's surface (GDD-MOV-09).
import { describe, expect, it } from 'vitest';
import { CART, TILE } from '../../src/config/tuning';
import { LAB_3A_ENEMIES, LAB_3A_LEDGE, LAB_3A_LEVEL, LAB_3A_PEN, LAB_3A_RAILS } from '../../src/levels/lab3a';
import { cartFloor } from '../../src/sim/cart';
import { centre, enemyBox } from '../../src/sim/enemy';
import { hurtbox } from '../../src/sim/hazards';
import { spawn } from '../../src/sim/movement';
import { startRun, stepRun } from '../../src/sim/run';
import { surfaceY } from '../../src/sim/slope';
import { defeatLook, stepDefeats } from '../../src/ui/defeatFx';
import { enemyPose } from '../../src/ui/enemyPose';
import * as armadillo from './enemies3/armadillo.mjs';

const level = LAB_3A_LEVEL;
const RAIL = LAB_3A_RAILS[0];
const FLOOR_Y = LAB_3A_ENEMIES[0].y;

// Per look, the painted pixels' middles relative to its box's anchor (the middle of its feet), in drawing px, facing right.
const PIXELS = Object.fromEntries(
  armadillo.drawFrames().map((f) => {
    const [ax, ay] = [(armadillo.BOX.x0 + armadillo.BOX.x1) / 2, armadillo.BOX.y1];
    const pts = [];
    for (let y = 0; y < f.grid.height; y++) for (let x = 0; x < f.grid.width; x++) if (f.grid.get(x, y)) pts.push([x + 0.5 - ax, y + 0.5 - ay]);
    return [f.look, pts];
  }),
);

const ground = (x, y) => {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (level.world.solidTile(tx, ty)) return true;
  const slope = level.world.slopeAt?.(tx, ty) ?? null;
  return slope !== null && y > surfaceY(tx, ty, slope, x);
};

/** How far a pixel at (x, y) is into ground, in 0.25 px: the nearer way out, across towards `mid` (the body's middle, a wall's face) or up (a slope's surface). */
function depth(x, y, mid) {
  const out = (dx, dy) => {
    let d = 0;
    while (d < 16 && ground(x + dx * d, y + dy * d)) d += 0.25;
    return d;
  };
  return Math.min(out(mid > x ? 1 : -1, 0), out(0, -1));
}

/** Every look posed, the defeat's too, over all the runs; and every pixel in ground, with where it is against the body's box. */
const POSED = new Set();
const FOUND = [];
/** The runs in which an Armadillo was defeated while it lay dazed, and whether by a stomp. */
const DAZED_DEFEATS = [];

/** Places `look`'s pixels at (x, y), mirrored when `flip`, against the box `box`, and notes those in ground. */
function place(label, step, look, x, y, flip, box) {
  POSED.add(look);
  for (const [dx, dy] of PIXELS[look]) {
    const px = x + (flip ? -dx : dx) / 2;
    const py = y + dy / 2;
    if (!ground(px, py)) continue;
    // Inside its own box it is where the simulation put it (a walker's box overlaps the flat tile at a slope's end, GDD-MOV-09).
    if (px >= box.x0 && px <= box.x1 && py >= box.y0 && py <= box.y1) continue;
    const beside = px < box.x0 || px > box.x1;
    FOUND.push({ label, step, look, beside, below: py > box.y1, depth: beside ? depth(px, py, (box.x0 + box.x1) / 2) : Infinity });
  }
}

/** Steps `run` with the inputs `bot(run, n)` gives for at most `steps` steps, posing every Armadillo and its defeat on each step. */
function play(label, run, bot, steps) {
  let fx = [];
  for (let n = 0; n < steps; n++) {
    const before = run;
    run = stepRun(run, bot(run, n), level);
    fx = stepDefeats(fx, before, run, level);
    level.enemies.forEach((_, i) => {
      if (before.enemies[i].alive && before.enemies[i].shell.phase === 'dazed' && !run.enemies[i].alive) DAZED_DEFEATS.push(`${label}: ${run.stomped ? 'stomped' : 'knocked'}`);
    });
    if (run.phase !== 'playing') continue;
    const ctx = { clock: run.clock, poncho: centre(run.player), world: level.world };
    level.enemies.forEach((def, i) => {
      const s = run.enemies[i];
      if (!s.alive) return;
      const pose = enemyPose(def, s, ctx);
      place(label, n, pose.look, pose.x, pose.y, pose.flip, enemyBox(def, s));
    });
    for (const e of fx) {
      const d = defeatLook(e);
      if (d.sheet === 'poof') POSED.add(d.look);
      else place(`${label} defeat`, n, d.look, d.x, d.y, d.flip, { x0: e.x - 8, x1: e.x + 8, y0: e.feet - 12, y1: e.feet });
    }
  }
  return run;
}

const at = (x, y) => ({ ...startRun(level), player: spawn(x, y) });

/**
 * `lab3a.test.ts`'s dodge: walk to `goTo`; jump the ball rolling at him when it is 12 px off; once it lies dazed, walk to `after`; with
 * `stompAt`, walk right once it walks left at x <= stompAt. With `atWall`, once it lies dazed he defeats it there: 'claw', walking up to it
 * and swinging; 'stomp', walking up to 24 px from it, then one jump towards it, steering over it.
 */
function dodger(i, o = {}) {
  let jumpWas = false;
  let clawWas = false;
  let go = false;
  let leapt = false;
  return (r) => {
    const p = r.player;
    const e = r.enemies[i];
    const phase = e.alive ? e.shell.phase : 'gone';
    if (phase === 'dazed' && o.atWall === 'claw') {
      const near = Math.abs(e.x - p.x) <= 20;
      const input = { move: near ? 0 : Math.sign(e.x - p.x), jumpHeld: false, claw: near && !clawWas };
      clawWas = input.claw;
      return input;
    }
    if (phase === 'dazed' && o.atWall === 'stomp') {
      const jump = p.grounded ? !leapt && !jumpWas && Math.abs(e.x - p.x) <= 24 : jumpWas && p.vy < 0;
      if (jump) leapt = true;
      jumpWas = jump;
      return { move: Math.abs(e.x - p.x) > 1 ? Math.sign(e.x - p.x) : 0, jumpHeld: jump };
    }
    const target = phase === 'dazed' ? o.after : phase === 'roll' ? undefined : o.goTo;
    let input = { move: target !== undefined && Math.abs(target - p.x) > 2 ? Math.sign(target - p.x) : 0, jumpHeld: false };
    if (phase === 'roll' && (e.dir > 0) === (e.x < p.x)) {
      const h = hurtbox(p);
      const b = enemyBox(level.enemies[i], e);
      const gap = e.dir > 0 ? h.x - b.x1 : b.x0 - (h.x + h.w);
      if (p.grounded && !jumpWas && gap >= 0 && gap <= 12) input = { move: 0, jumpHeld: true };
    }
    if (!p.grounded && jumpWas && p.vy < 0) input = { move: 0, jumpHeld: true };
    if (o.stompAt !== undefined && phase === 'walk' && e.dir < 0 && e.x <= o.stompAt) go = true;
    if (go) input = { move: 1, jumpHeld: false };
    jumpWas = input.jumpHeld;
    return input;
  };
}

/** `lab3a.test.ts`'s rail bots: from the wall top into the cart; `hopOut`, out of it at once holding left; `from`, startle it on foot first. */
function railer(o = {}) {
  let tucked = o.from === undefined;
  let jumpWas = false;
  let rolledAt = -1;
  return (r, n) => {
    const p = r.player;
    if (r.enemies[3].alive && r.enemies[3].shell.phase === 'tuck') tucked = true;
    let input = { move: 0, jumpHeld: false };
    if (r.carts[0].phase === 'waiting' && tucked) {
      const gap = cartFloor(RAIL, r.carts[0]).x + CART.width / 2 - p.x;
      const hop = o.from !== undefined && (p.grounded ? !jumpWas && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && p.vy < 0);
      input = { move: Math.abs(gap) > 2 ? Math.sign(gap) : 0, jumpHeld: hop };
    } else if (r.carts[0].phase === 'rolling' && o.hopOut) {
      if (rolledAt < 0) rolledAt = n;
      input = { move: -1, jumpHeld: n - rolledAt < 10 };
    }
    jumpWas = input.jumpHeld;
    return input;
  };
}

const blockTop = LAB_3A_PEN.topRow * TILE;
const onBlock = (LAB_3A_PEN.block1 + 1) * TILE - 8;
const RUNS = [
  ['pen, on the block', at(onBlock, blockTop), () => ({ move: 0, jumpHeld: false }), 1200],
  ['pen, dropped in', at(onBlock, blockTop), dodger(0, { goTo: 140, after: 220 }), 600],
  ['pen, the dazed one clawed at the wall', at(onBlock, blockTop), dodger(0, { goTo: 140, atWall: 'claw' }), 300],
  ['pen, the dazed one stomped at the wall', at(onBlock, blockTop), dodger(0, { goTo: 140, atWall: 'stomp' }), 300],
  ['slope', at(420, 190), dodger(1), 900],
  ['ledge, then a stomp from it', at((LAB_3A_LEDGE.col1 + 1) * TILE - 12, LAB_3A_LEDGE.row * TILE), dodger(2, { stompAt: 680 }), 400],
  ['rail, riding', at(LAB_3A_LEDGE.wall * TILE + 8, LAB_3A_LEDGE.wallRow * TILE), railer(), 300],
  ['rail, hopping out', at(LAB_3A_LEDGE.wall * TILE + 8, LAB_3A_LEDGE.wallRow * TILE), railer({ hopOut: true }), 300],
  ['rail, startled on foot', at(LAB_3A_ENEMIES[3].x - 60, FLOOR_Y), railer({ from: LAB_3A_ENEMIES[3].x - 60 }), 300],
];

describe('GDD-ENM-04 the Armadillo frames fit lab-3a (L-059)', () => {
  for (const [label, run, bot, steps] of RUNS) {
    it(`GDD-ENM-04 lab-3a ${label}: nothing of its frame lies over or below its box in ground`, { timeout: 120000 }, () => {
      play(label, run, bot, steps);
      const bad = FOUND.filter((o) => o.label.startsWith(label) && (!o.beside || o.below)).slice(0, 5);
      expect(bad).toEqual([]);
    });
  }

  // Runs after the runs above (vitest runs a file's tests in order), over every pixel they found.
  it('GDD-ENM-04 lab-3a: beside its box no frame lies more than 1 px in a wall or the ground', () => {
    // Walking flush against a wall the walk frame is drawn shifted off it by its reach on that side, the dazed frames ENEMY_ART.dazedBack px
    // back from the wall that stopped them, and on a slope the walk frame and the roll's dust are drawn raised off the sand (`enemyPose`).
    const deepest = {};
    for (const o of FOUND) if (o.beside) deepest[o.look] = Math.max(deepest[o.look] ?? 0, o.depth);
    expect(Object.fromEntries(Object.entries(deepest).filter(([, d]) => d > 1))).toEqual({});
  });

  it('GDD-ENM-04 lab-3a: the runs defeat a dazed Armadillo at the wall by the claw and by a stomp', () => {
    expect(DAZED_DEFEATS).toEqual(['pen, the dazed one clawed at the wall: knocked', 'pen, the dazed one stomped at the wall: stomped']);
  });

  it('GDD-ENM-04 lab-3a: the runs pose every look of the sheet, the defeat\'s squash and knocked-over frames, and the poof', () => {
    expect([...POSED].sort()).toEqual([...armadillo.LOOKS, 'poof0', 'poof1', 'poof2', 'poof3'].sort());
  });
});
