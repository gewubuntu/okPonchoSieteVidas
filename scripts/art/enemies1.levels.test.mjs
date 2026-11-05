// GDD-ENM-02, GDD-ART-05 (L-059): every frame World 1's enemies show fits the room it has in the real levels. Each level is played with
// Poncho standing at his spawn for 3000 steps, and again with Poncho dropped beside each World 1 enemy for 600 steps, so it reacts as it
// does in play (it telegraphs, charges, dives and climbs, plays dead, peeks and is alarmed); every live World 1 enemy is posed as the scene
// poses it (`enemyPose`) and every painted pixel of its frame is placed in the level, half a game px a pixel. Ground is a level tile and the
// sand under a slope's surface (GDD-MOV-09).
import { describe, expect, it } from 'vitest';
import { TILE } from '../../src/config/tuning';
import { LEVELS } from '../../src/levels/index';
import { enemyBox, kindOf, centre } from '../../src/sim/enemy';
import { startRun, stepRun } from '../../src/sim/run';
import { spawn } from '../../src/sim/movement';
import { surfaceY } from '../../src/sim/slope';
import { enemyPose } from '../../src/ui/enemyPose';
import { isWorld1 } from '../../src/ui/enemyLooks';
import { KINDS } from './make-enemies.mjs';

const STEPS = 3000;
const idle = { move: 0, jumpHeld: false };
// Drawing the frames takes a moment, so each kind's frames are read once: per look, the painted pixels relative to the box's anchor
// (a walker's feet at the box's middle, the Zopilote's box middle), in drawing px, facing right.
const PIXELS = Object.fromEntries(
  Object.entries(KINDS).filter(([kind]) => kind !== 'poof').map(([kind, mod]) => {
    const ax = (mod.BOX.x0 + mod.BOX.x1) / 2;
    const ay = kind === 'zopilote' ? (mod.BOX.y0 + mod.BOX.y1) / 2 : mod.BOX.y1;
    const looks = {};
    for (const f of mod.drawFrames()) {
      const pts = [];
      for (let y = 0; y < f.grid.height; y++) for (let x = 0; x < f.grid.width; x++) if (f.grid.get(x, y)) pts.push([x + 0.5 - ax, y + 0.5 - ay]);
      looks[f.look] = pts;
    }
    return [kind, looks];
  }),
);
const levels = LEVELS.filter((e) => e.level.enemies.some((d) => isWorld1(kindOf(d))));

const STEPS_NEAR = 600;
/** Every look posed, by kind, over all the runs. */
const POSED = {};

/** Every place a pixel of an enemy's drawing lands in ground (level tiles and slope sand) over a run, as strings. */
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
    const ctx = { clock: run.clock, poncho: centre(run.player) };
    level.enemies.forEach((def, i) => {
      const state = run.enemies[i];
      const kind = kindOf(def);
      if (!state.alive || !isWorld1(kind)) return;
      const pose = enemyPose(def, state, ctx);
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

/**
 * The runs that make each enemy react, one per placement: Poncho dropped onto the ground in front of a walker (at 20 and 50 px for the
 * cactus buddy, which is alarmed within 28 and peeks within 64; at 40 px for the others), and under a Zopilote and 80 px to either side of
 * it, so it dives steep and shallow. Poncho cannot be hurt in them (`invulnerable`), so a dive ends and the Zopilote climbs back instead of
 * a lost life starting the level over. A Tlacuache also starts one run playing dead, so it shows its dead and twitching frames.
 */
function runsNear(level, i) {
  const def = level.enemies[i];
  const kind = kindOf(def);
  const offsets = kind === 'zopilote' ? [0, 80, -80] : kind === 'cactus' ? [20, 50] : [40];
  const runs = offsets.map((dx) => {
    const x = def.x + dx;
    let y = def.y + (kind === 'zopilote' ? 24 : -8);
    while (y < level.world.height * TILE && !level.world.solidTile(Math.floor(x / TILE), Math.floor(y / TILE))) y += 1;
    return { ...startRun(level), invulnerable: 1e9, player: spawn(x, Math.floor(y / TILE) * TILE) };
  });
  if (kind === 'tlacuache') {
    const r = startRun(level);
    runs.push({ ...r, invulnerable: 1e9, enemies: r.enemies.map((e, j) => (j === i ? { ...e, gait: { phase: 'dead', age: 0, playedDead: true } } : e)) });
  }
  return runs;
}

// The looks `enemyPose` shows in play (the squash and hit frames are the defeat's, src/ui/defeatFx.ts).
const POSE_LOOKS = {
  alacran: ['walk0', 'walk1', 'walk2', 'walk3'],
  zopilote: ['climb0', 'climb1', 'diveShallow', 'diveSteep', 'flap0', 'flap1', 'flap2', 'flap3', 'tele', 'teleRed'],
  cactus: ['alarm0', 'alarm1', 'doze0', 'doze1', 'peek'],
  tlacuache: ['dead', 'deadTwitch', 'run0', 'run1', 'run2', 'run3', 'tele', 'teleRed', 'walk0', 'walk1', 'walk2', 'walk3'],
};

describe('GDD-ENM-02 World 1 enemy frames fit the real levels (L-059)', () => {
  it('runs over every level that has a World 1 enemy', () => {
    expect(levels.map((e) => e.id)).toEqual(expect.arrayContaining(['0-1', '1-1', '1-2', '1-3', '2-1', '2-2', '2-3']));
  });

  for (const entry of levels) {
    // User, 2026-11-05: "Allow it, pin it" (a tail at a pen wall) and "Allow beside the body" (a tail in a slope's sand, a wing tip at a cliff).
    it(`${entry.id}: only a tail, claw or wing beside the body lies over a wall's face or a slope's sand, never anything below the feet`, { timeout: 120000 }, () => {
      const level = entry.level;
      const all = [...overlaps(level, startRun(level), STEPS)];
      level.enemies.forEach((def, i) => {
        if (isWorld1(kindOf(def))) for (const r of runsNear(level, i)) all.push(...overlaps(level, r, STEPS_NEAR));
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
