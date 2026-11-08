// GDD-ENM-03, GDD-ART-05 (L-059): every frame World 2's enemies show fits the room it has in the real levels. Each level is played with
// Poncho standing at his spawn for 3000 steps, and again with Poncho dropped in front of each World 2 enemy so it reacts as it does in
// play: 30 px in front of a Paloma (it telegraphs, rises, hovers and descends, 600 steps), 60 px in front of a Chapulín (600 steps), and
// for a Trompo one run that starts it stunned (120 steps) and one with Poncho 60 px in front (600 steps). Poncho cannot be hurt in the near
// runs (`invulnerable`). Every live World 2 enemy is posed as the scene poses it (`enemyPose`) and every painted pixel of its frame is
// placed in the level, half a game px a pixel. Ground is a level tile and the sand under a slope's surface (GDD-MOV-09).
import { describe, expect, it } from 'vitest';
import { TILE } from '../../src/config/tuning';
import { LEVELS } from '../../src/levels/index';
import { enemyBox, kindOf, centre } from '../../src/sim/enemy';
import { startRun, stepRun } from '../../src/sim/run';
import { spawn } from '../../src/sim/movement';
import { surfaceY } from '../../src/sim/slope';
import { enemyPose } from '../../src/ui/enemyPose';
import { isWorld2 } from '../../src/ui/enemyLooks';
import { KINDS } from './make-enemies.mjs';

const STEPS = 3000;
const STEPS_NEAR = 600;
const STEPS_STUNNED = 120;
const idle = { move: 0, jumpHeld: false };
// Drawing the frames takes a moment, so each kind's frames are read once: per look, the painted pixels relative to the box's anchor (the
// feet at the box's middle), in drawing px, facing right.
const PIXELS = Object.fromEntries(
  ['paloma', 'chapulin', 'trompo'].map((kind) => {
    const mod = KINDS[kind];
    const ax = (mod.BOX.x0 + mod.BOX.x1) / 2;
    const ay = mod.BOX.y1;
    const looks = {};
    for (const f of mod.drawFrames()) {
      const pts = [];
      for (let y = 0; y < f.grid.height; y++) for (let x = 0; x < f.grid.width; x++) if (f.grid.get(x, y)) pts.push([x + 0.5 - ax, y + 0.5 - ay]);
      looks[f.look] = pts;
    }
    return [kind, looks];
  }),
);
const levels = LEVELS.filter((e) => e.level.enemies.some((d) => isWorld2(kindOf(d))));
/** Every look posed, by kind, over all the runs. */
const POSED = {};

/** Every place a pixel of an enemy's drawing lands in ground (level tiles and slope sand) over a run, as records. */
function overlaps(level, run, steps) {
  const ground = (x, y) => {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (level.world.solidTile(tx, ty)) return 'tile';
    const slope = level.world.slopeAt?.(tx, ty) ?? null;
    return slope && y > surfaceY(tx, ty, slope, x) ? 'slope' : null;
  };
  const found = [];
  for (let step = 0; step < steps; step++) {
    run = stepRun(run, idle, level);
    if (run.phase !== 'playing') continue;
    level.enemies.forEach((def, i) => {
      const state = run.enemies[i];
      const kind = kindOf(def);
      if (!state.alive || !isWorld2(kind)) return;
      const pose = enemyPose(def, state, { clock: run.clock, poncho: centre(run.player) });
      (POSED[kind] ??= new Set()).add(pose.look);
      const box = enemyBox(def, state);
      for (const [dx, dy] of PIXELS[kind][pose.look]) {
        const x = pose.x + (pose.flip ? -dx : dx) / 2;
        const y = pose.y + dy / 2;
        const what = ground(x, y);
        if (!what) continue;
        // Inside its own box it is where the simulation put it (a walker's box overlaps the flat tile at a slope's end, GDD-MOV-09).
        if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1) continue;
        found.push({ step, i, kind, look: pose.look, what, beside: x < box.x0 || x > box.x1, below: y > box.y1 });
      }
    });
  }
  return found;
}

/** Poncho at `x`, dropped from the enemy's feet level onto the first level tile below, and (for a cordel or a roof) standing at its feet. */
function dropped(level, x, feet) {
  let y = feet - 8;
  while (y < level.world.height * TILE && !level.world.solidTile(Math.floor(x / TILE), Math.floor(y / TILE))) y += 1;
  return [spawn(x, Math.floor(y / TILE) * TILE), spawn(x, feet - 1)];
}

/**
 * The runs that make enemy `i` react, as [run, steps]: Poncho dropped 30 px in front of a Paloma, 60 px in front of a Chapulín, a Trompo
 * started stunned, and one with Poncho 60 px in front.
 */
function runsNear(level, i) {
  const def = level.enemies[i];
  const kind = kindOf(def);
  const base = startRun(level);
  const calm = { ...base, invulnerable: 1e9 };
  if (kind === 'trompo') {
    const stunned = { ...calm, enemies: base.enemies.map((e, j) => (j === i ? { ...e, spin: { phase: 'stunned', age: 0 } } : e)) };
    return [[stunned, STEPS_STUNNED], ...dropped(level, def.x + 60, def.y).map((player) => [{ ...calm, player }, STEPS_NEAR])];
  }
  const dx = kind === 'paloma' ? 30 : 60;
  return dropped(level, def.x + dx, def.y).map((player) => [{ ...calm, player }, STEPS_NEAR]);
}

// The looks `enemyPose` shows in play (the squash and hit frames are the defeat's, src/ui/defeatFx.ts).
const POSE_LOOKS = {
  paloma: ['flap0', 'flap1', 'flap2', 'flap3', 'glide', 'tele', 'teleRed', 'walk0', 'walk1', 'walk2', 'walk3'],
  chapulin: ['boing', 'crouch0', 'crouch1', 'fall', 'rise', 'tele', 'teleRed'],
  trompo: ['spin0', 'spin1', 'spin2', 'spin3', 'stun', 'stunWobble'],
};

describe('GDD-ENM-03 World 2 enemy frames fit the real levels (L-059)', () => {
  it('runs over every level that has a World 2 enemy', () => {
    expect(levels.map((e) => e.id)).toEqual(expect.arrayContaining(['2-1', '2-2', '2-3', 'lab-2e']));
  });

  for (const entry of levels) {
    it(`${entry.id}: only a wing, tail, leg or antenna beside the body lies over a wall's face or a slope's sand, never anything below the feet`, { timeout: 300000 }, () => {
      const level = entry.level;
      const all = [...overlaps(level, startRun(level), STEPS)];
      level.enemies.forEach((def, i) => {
        if (isWorld2(kindOf(def))) for (const [run, steps] of runsNear(level, i)) all.push(...overlaps(level, run, steps));
      });
      const bad = all.filter((o) => !o.beside || o.below).slice(0, 5).map((o) => `step ${o.step} enemy ${o.i} ${o.kind} ${o.look} in ${o.what}${o.below ? ', below its feet' : ''}${o.beside ? '' : ', over its box'}`);
      expect(bad).toEqual([]);
    });
  }

  // Runs after the level tests (vitest runs a file's tests in order), over every pose they posed.
  it('the runs pose every look the game shows in play, so each one is checked', () => {
    expect(Object.fromEntries(Object.entries(POSED).map(([k, v]) => [k, [...v].sort()]))).toEqual(POSE_LOOKS);
  });
});
