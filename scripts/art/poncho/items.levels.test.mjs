// GDD-ART-04, GDD-PWR-02, GDD-PWR-03 (L-059): the taco and chile frames of assets/sprites/poncho/ fit the room they have in the real levels.
// A level's floor taco is drawn centred on its square, in the middle of its tile; a taco or chile out of a piñata stands on its feet, drawn
// where `itemAt` puts it. Each piñata of each level lets out a taco (it walks off, turns at walls, follows slopes, falls off ledges), a
// chile and a Chile Fantasma (GDD-PWR-04; they stay on top), and the run steps with them, Poncho at his spawn and unhurtable; every step each item is posed in the bob
// frame of the run's clock (`pickupLook`) and every painted pixel of its frame is placed in the level, half a game px a pixel. Ground is a
// level tile, a piñata and the sand under a slope's surface (GDD-MOV-09).
import { describe, expect, it } from 'vitest';
import { TACO, TILE } from '../../../src/config/tuning';
import { LEVELS } from '../../../src/levels/index';
import { releaseFrom } from '../../../src/sim/item';
import { withPinatas } from '../../../src/sim/pinata';
import { startRun, stepRun } from '../../../src/sim/run';
import { surfaceY } from '../../../src/sim/slope';
import { itemAt, pickupLook } from '../../../src/ui/ponchoPose';
import { chile, fantasma, taco } from './items.mjs';

const STEPS = 600;
const idle = { move: 0, jumpHeld: false };
// Per look, the painted pixels' middles from the frame's middle, in game px.
const PIXELS = Object.fromEntries([taco, chile, fantasma].flatMap((m) => m.draw().map((f) => {
  const pts = [];
  for (let y = 0; y < f.grid.height; y++) for (let x = 0; x < f.grid.width; x++) if (f.grid.get(x, y)) pts.push([(x + 0.5 - f.grid.width / 2) / 2, (y + 0.5 - f.grid.height / 2) / 2]);
  return [f.look, pts];
})));
const levels = LEVELS.filter((e) => !e.test && (e.level.tacos.length > 0 || e.level.pinatas.length > 0));
const POSED = new Set();

/** Where the pixels of `kind`'s frame at `clock`, its middle at (cx, cy), lie in ground outside its square (whose feet are at (x, feet)). */
function inGround(level, kind, clock, cx, cy, x, feet) {
  const world = withPinatas(level.world, level.pinatas);
  const look = pickupLook(kind, clock);
  POSED.add(look);
  const box = { x0: x - TACO.size / 2, x1: x + TACO.size / 2, y0: feet - TACO.size, y1: feet };
  const out = [];
  for (const [dx, dy] of PIXELS[look]) {
    const px = cx + dx, py = cy + dy;
    if (px >= box.x0 && px <= box.x1 && py >= box.y0 && py <= box.y1) continue;
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    const slope = level.world.slopeAt?.(tx, ty) ?? null;
    const what = world.solidTile(tx, ty) ? 'tile' : slope && py > surfaceY(tx, ty, slope, px) ? 'slope' : null;
    if (what) out.push({ look, what, x, feet, beside: px < box.x0 || px > box.x1, below: py > box.y1 });
  }
  return out;
}

describe('GDD-ART-04 the taco and chile frames fit the real levels (L-059)', () => {
  it('runs over every level with a floor taco or a piñata', () => {
    expect(levels.length).toBeGreaterThan(0);
  });

  for (const entry of levels) {
    it(`${entry.id}: no frame of a taco or chile reaches into the ground below its feet or over its square`, { timeout: 120000 }, () => {
      const level = entry.level;
      const all = [];
      // The floor tacos, in every frame of the bob and the glint.
      for (const t of level.tacos) {
        const x = t.col * TILE + TILE / 2, feet = t.row * TILE + TILE / 2 + TACO.size / 2;
        for (let clock = 0; clock < 120; clock++) all.push(...inGround(level, 'taco', clock, x, feet - TACO.size / 2, x, feet));
      }
      // What each piñata lets out, standing and walking.
      for (const p of level.pinatas) {
        for (const kind of ['taco', 'chile', 'fantasma']) {
          const item = releaseFrom(p, withPinatas(level.world, level.pinatas), kind);
          if (!item) continue;
          let run = { ...startRun(level), invulnerable: 1e9, items: [item] };
          for (let step = 0; step < STEPS && run.items.length > 0 && run.phase === 'playing'; step++) {
            run = stepRun(run, idle, level);
            for (const it of run.items) {
              const at = itemAt(it.kind, it.x, it.y);
              all.push(...inGround(level, it.kind, run.clock, at.x, at.y, it.x, it.y));
            }
          }
        }
      }
      const bad = all.filter((o) => !o.beside || o.below).slice(0, 5).map((o) => `${o.look} at ${o.x},${o.feet} in ${o.what}${o.below ? ', below its feet' : ''}${o.beside ? '' : ', over its square'}`);
      expect(bad).toEqual([]);
    });
  }

  it('the runs pose every bob and glint frame', () => {
    expect([...POSED].sort()).toEqual(['chileBob0', 'chileBob1', 'chileBob2', 'chileBob3', 'chileGlint', 'tacoBob0', 'tacoBob1', 'tacoBob2', 'tacoBob3', 'tacoGlint', 'fantasmaBob0', 'fantasmaBob1', 'fantasmaBob2'].sort());
  });
});
