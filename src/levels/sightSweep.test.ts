import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, TILE } from '../config/tuning';
import type { Bottom } from '../sim/bottoms';
import type { Enemy } from '../sim/enemy';
import type { Level } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import { cameraLimits } from '../ui/camera';
import { flySight, onScreen, sightSweep, tileBox, viewsAlong, type SightReport, type Takeoff } from './sightSweep';

// GDD-WLD-03's sight rule as a sweep (`src/levels/sightSweep.ts`), on small fixture levels. The screen is 480 x 270; flying right from a
// settled camera he stands 256 px from its left edge, so it shows 224 px ahead of him (GDD-UI-04).

const mid = (col: number) => col * TILE + TILE / 2;
const Y = (row: number) => row * TILE;
/** A fixture level 40 tiles wide and `rows` tall, with the glide: `solid` says which tiles are ground; he starts at column 3, row 14. */
function fixture(solid: (col: number, row: number) => boolean, enemies: readonly Enemy[] = [], rows = 17, bottoms?: readonly Bottom[]): Level {
  return {
    world: parseTiles(Array.from({ length: rows }, (_, row) => Array.from({ length: 40 }, (_t, col) => (solid(col, row) ? '#' : '.')).join(''))),
    spawn: { x: mid(3), y: Y(14) },
    ofrendas: [],
    spikes: [],
    crumbles: [],
    springs: [],
    platforms: [],
    tacos: [],
    pinatas: [],
    doors: [],
    keys: [],
    fragiles: [],
    enemies,
    abilities: { glide: true },
    ...(bottoms ? { bottoms } : {}),
  };
}
/** A Murciélago that hangs still (no loop) with its middle at (the middle of column `col`, `y`). */
const bat = (col: number, y: number): Enemy => ({ x: mid(col), y, kind: 'murcielago' });
/** A take-off at a run to the right from the last eighth of column `col`, its ground at `row`. */
const takeoff = (col: number, row: number, input: Takeoff['input'], speed: Takeoff['speed'] = 'run'): Takeoff => ({ place: { col, y: Y(row) }, x: col * TILE + 14, dir: 1, speed, input, start: 0 });

/** A bank 8 rows over a flat: columns 0 to 17 at row 6, the rest at row 14. */
const bank = (col: number, row: number) => row >= (col <= 17 ? 6 : 14);
/** A 16 x 10 box (a bat's size) with its top-left corner at (x0, y0). */
const box = (x0: number, y0: number) => ({ x0, x1: x0 + 16, y0, y1: y0 + 10 });
/** A flat to column 12, an 8-tile pit, a ledge at columns 21 to 24 past it, and a ledge 5 tiles over the flat (columns 6 to 8, row 9). */
const ledges = (col: number, row: number) => (row >= 14 && (col <= 12 || (col >= 21 && col <= 24))) || (row === 9 && col >= 6 && col <= 8);
/** The places a sweep reached, as "column,row". */
const reached = (sweep: SightReport) => new Set(sweep.places.map((p) => `${p.col},${p.y / TILE}`));

describe('GDD-WLD-03 the sight sweep', () => {
  it('GDD-WLD-03 sight sweep: a bat 20 tiles ahead of a held glide is a blind loss, and the same bat 10 tiles ahead a loss in sight', () => {
    // A bank 8 rows over a flat (columns 0 to 17, row 6), the glide held off its edge: measured, his feet pass column 27's middle at y 105
    // and column 37's at y 202, so a bat that hangs still there, its middle 16 px over his feet, is in his way.
    const glide = takeoff(17, 6, 'held');
    const far = flySight(fixture(bank, [bat(37, 186)]), glide).loss;
    const near = flySight(fixture(bank, [bat(27, 89)]), glide).loss;
    expect([far?.cause, far?.blind, near?.cause, near?.blind]).toEqual(['murcielago at 37', true, 'murcielago at 27', false]);
    // The far bat comes on screen during the flight, before the loss.
    expect(far!.seenBefore).toBeGreaterThan(0);
    // On screen is any of the box inside the view; a box that only shares an edge with it is not.
    const view = { x: 100, y: 50 };
    expect([onScreen(box(580, 100), view), onScreen(box(579, 100), view)]).toEqual([false, true]);
    expect([onScreen(box(84, 100), view), onScreen(box(85, 100), view)]).toEqual([false, true]);
    expect([onScreen(box(200, 50 + BASE_HEIGHT), view), onScreen(box(200, 49 + BASE_HEIGHT), view)]).toEqual([false, true]);
    expect([onScreen(box(200, 40), view), onScreen(box(200, 41), view)]).toEqual([false, true]);
  });

  it('GDD-WLD-03 sight sweep: a pit whose lip is 16 tiles ahead, that a held stomp bounce falls into, is a blind loss', () => {
    // A flat at row 14 with a 3-tile pit at columns 32 to 34, a still bat on the line of a held jump from column 16 (measured: it stomps
    // it, and the held bounce comes down in the pit).
    const level = fixture((col, row) => row >= 14 && (col < 32 || col > 34), [bat(24, 215)]);
    const f = flySight(level, takeoff(16, 14, 'held'));
    expect(f.states.some((r) => r.stomped)).toBe(true);
    expect([f.loss?.cause, f.loss?.where, f.loss?.blind]).toEqual(['pit 32-34', tileBox(32, 14), true]);
    // The screen shows 224 px ahead of him at the take-off; the lip is 240 px ahead.
    const view = viewsAlong(level, f.from, f.states, 1)[f.loss!.takeoffStep]!;
    expect([view.x + 480 - f.states[0]!.player.x, 32 * TILE - f.from.player.x]).toEqual([224, 242]);
  });

  it('GDD-WLD-03 sight sweep: the closure reaches a ledge only a glide lands on and not one 5 tiles up', { timeout: 60000 }, () => {
    // From the start (column 3) a flat to column 12, an 8-tile pit, a ledge at columns 21 to 24 on the far side, and a ledge 5 tiles over
    // the flat (columns 6 to 8, row 9). A held glide from the lip lands on the far ledge; a plain jump does not reach it, nor any jump the
    // high one (a full jump climbs 3 tiles, GDD-WLD-03).
    const level = fixture(ledges);
    const sweep = sightSweep(level);
    const glide = reached(sweep);
    const plain = reached(sightSweep({ ...level, abilities: {} }));
    const far = ['21,14', '22,14', '23,14', '24,14'];
    const high = ['6,9', '7,9', '8,9'];
    expect([far.map((p) => glide.has(p)), high.map((p) => glide.has(p))]).toEqual([[true, true, true, true], [false, false, false]]);
    expect(far.map((p) => plain.has(p))).toEqual([false, false, false, false]);
    expect(sweep.unreached).toContainEqual({ row: 9, from: 6, to: 8 });
  });

  it('GDD-WLD-03 sight sweep: the camera is the pure camera, its bottom edge over a raised bottom where cameraLimits puts it', () => {
    // A level 34 rows tall (544 px), ground at row 28 but for a 3-tile pit (columns 20 to 22) with a raised bottom at row 32; he walks off
    // its lip. On the bank the camera's bottom edge is 2 px above the level's bottom; over the pit it rises to 2 px above the raised
    // bottom's floor line (row 32's bottom edge, y 528).
    const level = fixture((col, row) => row >= 28 && (col < 20 || col > 22), [], 34, [{ fromCol: 20, toCol: 22, row: 32 }]);
    const f = flySight(level, takeoff(18, 28, 'walk', 'stand'));
    const views = viewsAlong(level, f.from, f.states, 1);
    expect(f.loss?.cause).toBe('pit 20-22');
    // A walk-off's take-off is the step he leaves the ground, not the first step of the walk.
    expect([f.loss!.takeoffStep > 0, f.loss!.takeoffStep]).toEqual([true, f.states.findIndex((r) => !r.player.grounded)]);
    expect([views[0]!.y + BASE_HEIGHT, views[f.loss!.lossStep]!.y + BASE_HEIGHT]).toEqual([542, 526]);
    expect([cameraLimits(34 * TILE).bottom, cameraLimits(34 * TILE, 33 * TILE).bottom].map((b) => b + BASE_HEIGHT)).toEqual([542, 526]);
  });
});
