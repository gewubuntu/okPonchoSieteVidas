// GDD-ENM-02, GDD-ART-05 (L-059): every frame World 1's enemies show fits the room it has in the real levels. Each level is played with
// Poncho standing at his spawn for 3000 steps (50 s; the enemies patrol, dive and charge as they would) and every live World 1 enemy is
// posed as the scene poses it (`enemyPose`); every painted pixel of its frame is placed in the level, half a game px a pixel.
import { describe, expect, it } from 'vitest';
import { TILE } from '../../src/config/tuning';
import { LEVELS } from '../../src/levels/index';
import { enemyBox, kindOf, centre } from '../../src/sim/enemy';
import { startRun, stepRun } from '../../src/sim/run';
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

describe('GDD-ENM-02 World 1 enemy frames fit the real levels (L-059)', () => {
  it('runs over every level that has a World 1 enemy', () => {
    expect(levels.map((e) => e.id)).toEqual(expect.arrayContaining(['0-1', '1-1', '1-2', '1-3', '2-1', '2-2', '2-3']));
  });

  for (const entry of levels) {
    it(`${entry.id}: no frame reaches into the floor or a ceiling; only a tail or claw beside the box overlaps a wall's face`, () => {
      const level = entry.level;
      const solid = (x, y) => level.world.solidTile(Math.floor(x / TILE), Math.floor(y / TILE));
      let run = startRun(level);
      const bad = [];
      for (let step = 0; step < STEPS && bad.length < 5; step++) {
        run = stepRun(run, idle, level);
        if (run.phase !== 'playing') continue;
        const ctx = { clock: run.clock, poncho: centre(run.player) };
        level.enemies.forEach((def, i) => {
          const state = run.enemies[i];
          const kind = kindOf(def);
          if (!state.alive || !isWorld1(kind)) return;
          const pose = enemyPose(def, state, ctx);
          const box = enemyBox(def, state);
          // A flier ignores tiles: while its own box overlaps one, its drawing may too.
          const boxInTile = kind === 'zopilote' && [box.x0, box.x1 - 1e-6].some((x) => [box.y0, box.y1 - 1e-6].some((y) => solid(x, y)));
          if (boxInTile) return;
          for (const [dx, dy] of PIXELS[kind][pose.look]) {
            const x = pose.x + (pose.flip ? -dx : dx) / 2;
            const y = pose.y + dy / 2;
            if (!solid(x, y)) continue;
            // Inside its own box it is where the simulation put it (a walker's box overlaps the flat tile at a slope's end, GDD-MOV-09).
            const inBox = x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
            // Beside the box, above its feet: a tail or a claw lying over a wall's face (user, 2026-11-05: "Allow it, pin it").
            const beside = (x < box.x0 || x > box.x1) && y < box.y1;
            const ok = inBox || (kind !== 'zopilote' && beside);
            if (!ok) bad.push(`step ${step} enemy ${i} ${kind} ${pose.look} at (${x}, ${y}), box ${JSON.stringify(box)}`);
          }
        });
      }
      expect(bad).toEqual([]);
    });
  }
});
