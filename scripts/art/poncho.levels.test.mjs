// GDD-ART-04, GDD-ART-05 (L-059): every frame of Poncho's (assets/sprites/poncho.png) that the game shows fits the room it has in the
// real levels. In every World 1 and World 2 level (and the tutorial) Poncho is dropped every few tiles and plays a set routine there: he
// stands (and blinks and glances at his taco), eats a chile, claws, spits a fireball, is hurt (his invulnerability set so the step gives
// the hit's), runs, skids and jumps both ways; and he flips in at every respawn point. Each step he is posed as the scene poses him
// (`stepPose`), placed as it places him (his feet where the run has them, or above the respawn point in the flip), and every painted pixel
// of his frame is placed in the level, half a game px a pixel. On the level clear screen he plays the victory where he reached the exit
// (on its floor, a rooftop or a cliff top) or, in a boss arena, wherever he is as the screen comes up (GDD-ART-04, GDD-UI-02). Ground is a level tile and the sand under a slope's surface (GDD-MOV-09).
import { describe, expect, it } from 'vitest';
import { EXIT, HIT, HITBOX, RESPAWN, TILE } from '../../src/config/tuning';
import { LEVELS } from '../../src/levels/index';
import { spawn } from '../../src/sim/movement';
import { flipPose } from '../../src/sim/respawnFlip';
import { respawnPoint, startRun, stepRun } from '../../src/sim/run';
import { surfaceY } from '../../src/sim/slope';
import { PONCHO_FRAME, PONCHO_BOX } from '../../src/ui/ponchoFrames';
import { PONCHO_LOOKS } from '../../src/ui/ponchoLooks';
import { startPose, stepPose } from '../../src/ui/ponchoPose';
import { ponchoFrames } from './make-sprites.mjs';

// Drawing the frames takes a moment, so they are read once: per look, the painted pixels' middles from his feet (the frame's bottom middle),
// in game px, facing right.
const PIXELS = Object.fromEntries(ponchoFrames().map((f) => {
  const pts = [];
  for (let y = 0; y < f.grid.height; y++) for (let x = 0; x < f.grid.width; x++) if (f.grid.get(x, y)) pts.push([(x + 0.5 - PONCHO_FRAME.w / 2) / 2, (y + 0.5 - PONCHO_BOX.y1) / 2]);
  return [f.look, pts];
}));
const levels = LEVELS.filter((e) => !e.test);
/** How far apart the spots he is dropped at are, in tiles. */
const EVERY = 6;
/** The steps of the clear screen stepped (22 + 48 + 24 of the victory looks, and some more). */
const CLEAR_STEPS = 120;
/** Every look posed, over all the runs. */
const POSED = new Set();

const idle = { move: 0, jumpHeld: false };
/** The routine at a spot: [input, steps] in turn, and the changes to the run made before a step (`at`). */
const ROUTINE = [
  [idle, 225], // stands: blinks, and glances at the taco
  ['eat', 1], [idle, 24], // a chile at his feet: eats it, now in Fuego
  [{ ...idle, claw: true }, 1], [idle, 16], // a claw swipe and its follow-through
  [{ ...idle, fuego: true }, 1], [idle, 12], // a fireball spat
  ['hurt', 1], [idle, 24], // a hit in Fuego
  [{ move: 1, jumpHeld: false }, 30], [{ move: -1, jumpHeld: false }, 10], [idle, 20], // runs right, skids, stops
  [{ move: 1, jumpHeld: true }, 20], [{ move: 1, jumpHeld: false }, 60], // jumps right
  [{ move: -1, jumpHeld: false }, 30], [{ move: 1, jumpHeld: false }, 8], [idle, 10], // runs left, skids
  [{ move: -1, jumpHeld: true }, 20], [{ move: -1, jumpHeld: false }, 60], // jumps left
];

/**
 * Every place a pixel of his frame lands in ground (level tiles and slope sand), stepping `steps` (a routine or a count) from `run`; a
 * count first steps idle until the level is clear (at most 200 steps, L-064), if it is not already.
 */
function overlaps(level, run, steps, untilClear = false) {
  const ground = (x, y) => {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (level.world.solidTile(tx, ty)) return 'tile';
    const slope = level.world.slopeAt?.(tx, ty) ?? null;
    return slope && y > surfaceY(tx, ty, slope, x) ? 'slope' : null;
  };
  const found = [];
  let pose = startPose(run.player.x);
  let seen = '';
  let step = 0;
  const one = (input) => {
    const before = run;
    run = stepRun(run, input, level);
    pose = stepPose(pose, before, run);
    step++;
    let fx = run.player.x, fy = run.player.y;
    if (run.phase === 'respawning') {
      const flip = flipPose(run.wait);
      if (!flip.visible) return;
      const at = respawnPoint(run, level);
      [fx, fy] = [at.x, at.y - flip.dy];
    } else if (run.phase !== 'playing' && run.phase !== 'clear') return;
    POSED.add(pose.look);
    const key = `${pose.look}${pose.flip}${fx},${fy}`;
    if (key === seen) return; // standing still in the same frame: checked already
    seen = key;
    const side = pose.flip ? -1 : 1;
    const box = { x0: fx - HITBOX.width / 2, x1: fx + HITBOX.width / 2, y0: fy - HITBOX.height, y1: fy };
    for (const [dx, dy] of PIXELS[pose.look]) {
      const x = fx + side * dx, y = fy + dy;
      // Inside his own box he is where the simulation put him (on a slope his box overlaps its sand, GDD-MOV-09).
      if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1) continue;
      const what = ground(x, y);
      if (what) found.push({ step, look: pose.look, x: run.player.x, what, beside: x < box.x0 || x > box.x1, below: y > box.y1, above: y < box.y0 });
    }
  };
  if (typeof steps === 'number') {
    for (let i = 0; i < 200 && run.phase === 'playing' && untilClear; i++) one(idle);
    for (let i = 0; i < steps; i++) one(idle);
  }
  else {
    for (const [input, n] of steps) {
      // Changes made to the run before a step: a chile put at his feet (eaten by touch, GDD-PWR-06), or his invulnerability set one above a
      // hit's, so the step leaves it at a hit's (as `stepPose` reads a hit); only while he plays.
      if (input === 'eat' && run.phase === 'playing') run = { ...run, items: [...run.items, { x: run.player.x, y: run.player.y, vx: 0, vy: 0, kind: 'chile' }] };
      if (input === 'hurt' && run.phase === 'playing') run = { ...run, invulnerable: HIT.invulnerableSteps + 1 };
      for (let i = 0; i < n; i++) one(typeof input === 'string' ? idle : input);
    }
  }
  return found;
}

/** The spots he is dropped at: every EVERY tiles across the level, falling from the top onto whatever is below. */
function spots(level) {
  const out = [];
  for (let col = 2; col < level.world.width - 2; col += EVERY) {
    const x = col * TILE + TILE / 2;
    let y = TILE;
    while (y < level.world.height * TILE && !level.world.solidTile(col, Math.floor(y / TILE))) y += TILE;
    if (y >= level.world.height * TILE) continue; // a pit
    // Standing on the first solid tile from the top, if there is room for him above it; else from where he is dropped he falls onto it.
    out.push({ ...startRun(level), power: 'taco', player: { ...spawn(x, Math.floor(y / TILE) * TILE), grounded: false } });
  }
  return out;
}

/**
 * The clear screen, 120 steps (the four victory looks pose in 22 + 48 + 24): at the exit, Poncho dropped from its top onto the floor below
 * its middle, walking nowhere, stepped until he reaches it; in a boss arena (no exit) at every spot, the screen up from its first step.
 */
function clears(level) {
  if (!level.exit) return spots(level).map((run) => ({ ...run, phase: 'clear', wait: 0 }));
  const x = level.exit.x;
  const col = Math.floor(x / TILE);
  let y = level.exit.y - EXIT.height; // the exit's top
  while (y < level.world.height * TILE && !level.world.solidTile(col, Math.floor(y / TILE))) y += TILE;
  return [{ ...startRun(level), power: 'taco', player: { ...spawn(x, Math.floor(y / TILE) * TILE), grounded: false } }];
}

/** The respawn points: the level start and every ofrenda, each with a flip in from the start of its wait. */
function respawns(level) {
  return [level.spawn, ...level.ofrendas.map((o) => ({ x: o.x, y: o.y }))].map((checkpoint) => ({ ...startRun(level), checkpoint, phase: 'respawning', wait: RESPAWN.delaySteps }));
}

describe('GDD-ART-04 Poncho\'s frames fit the real levels (L-059)', () => {
  it('runs over every World 1 and World 2 level and the tutorial', () => {
    expect(levels.map((e) => e.id)).toEqual(['0-1', '1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4']);
  });

  for (const entry of levels) {
    // User, 2026-11-05 (for the enemies, the same rule for him): "Allow beside the body": the brim or the tail over a wall's face or a
    // slope's sand. User, 2026-11-08: "Allow it, pin it": the sombrero above his body over a ceiling tile (1-3's two-tile passage, a ceiling
    // bumped in a jump), as far as PONCHO_ART.reach's `above` lets it. Never anything below his feet.
    it(`${entry.id}: only the brim, the tail or a paw beside his body, or the sombrero above it, lies over ground, never anything below his feet`, { timeout: 300000 }, () => {
      const level = entry.level;
      const all = [];
      for (const run of spots(level)) all.push(...overlaps(level, run, ROUTINE));
      for (const run of clears(level)) all.push(...overlaps(level, run, CLEAR_STEPS, true));
      for (const run of respawns(level)) all.push(...overlaps(level, run, RESPAWN.delaySteps + 2));
      const bad = all.filter((o) => (!o.beside && !o.above) || o.below).slice(0, 5).map((o) => `step ${o.step} at x ${o.x} ${o.look} in ${o.what}${o.below ? ', below his feet' : ''}${o.beside || o.above ? '' : ', over his box'}`);
      expect(bad).toEqual([]);
    });
  }

  // Runs after the level tests (vitest runs a file's tests in order), over every pose they posed.
  it('the runs pose every look the game shows, so each one is checked', () => {
    expect([...POSED].sort()).toEqual([...PONCHO_LOOKS].sort());
  });
});
