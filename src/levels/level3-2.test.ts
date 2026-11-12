import { describe, expect, it } from 'vitest';
import { CART, TILE } from '../config/tuning';
import { cartFloor, railGround, railLength, rollCarts, warningPost, type CartState } from '../sim/cart';
import { kindOf } from '../sim/enemy';
import { touchesHilo } from '../sim/hilo';
import { startRun, type RunState } from '../sim/run';
import { levelById, worldLevels } from './index';
import {
  LEVEL_3_2_BEAMS,
  LEVEL_3_2_ENEMIES,
  LEVEL_3_2_FAR_WALL,
  LEVEL_3_2_HOP1_FLOOR,
  LEVEL_3_2_ISLAND,
  LEVEL_3_2_LEDGES,
  LEVEL_3_2_PEN,
  LEVEL_3_2_PILLAR,
  LEVEL_3_2_PIT_D,
  LEVEL_3_2_PITS,
  LEVEL_3_2_RAILS,
  LEVEL_3_2_RIB,
  LEVEL_3_2_RIDER_HILOS,
  LEVEL_3_2_SEAT,
  LEVEL_3_2_SUNKEN,
} from './level3-2';
import { gaps, openGaps, validateLevel } from './validate';
import {
  A_HILOS,
  airSteps,
  apart,
  arrivalsInK2,
  at,
  atT,
  backInCart,
  ball,
  BEAM_FACE,
  beamHilos,
  bot,
  brokenRides,
  brokenSweep,
  cartOf,
  causeOf,
  clears,
  dazedAtWall,
  drive,
  endOf,
  enemiesAt,
  entry,
  every,
  type Flight,
  floorBelow,
  fly,
  GROUND,
  headroom,
  hopIn,
  hopInto,
  idle,
  inCart,
  jumpAt,
  jumper,
  jumpFromCart,
  JUMPS,
  K1_ALACRAN,
  K2_BEAM_FACE,
  K_LIP,
  ketsu,
  L,
  landedAs,
  LAST_TILE_F,
  leap,
  LEDGE_F,
  ledgeF,
  type Letter,
  LETTERS,
  lostIn,
  mid,
  middleOf,
  OFRENDA_2,
  OFRENDA_HALF,
  pastBeam,
  PEN_BALL,
  periodOf,
  PIECES,
  PINATA_COL,
  PITS,
  play,
  railOf,
  RAMPS,
  RIB_FACE,
  rideA,
  rideE,
  rideF,
  rideFrom,
  rideK1,
  right,
  ROOF,
  runsOf,
  runTo,
  runUntil,
  SEAT_EDGE,
  SEAT_TOP,
  standing,
  standsOnFloor,
  sweep,
  takeOffs,
  tally,
  TEN,
  TEN_TO_ISLAND,
  tenLanding,
  took,
  upperLanding,
  waitFor,
  WALK_KETSU,
  windowOf,
  world,
  Y,
} from './level3-2.drive';

// GDD-WLD-17: level 3-2, "La Mina". Every number in these tests is the design's (GDD-WLD-17, laid out by the World 3 design swarm before
// any code); where the real simulation gives another, the test pins the measured value with a comment "GDD says N" (L-003). Part 1 is the
// layout; Part 2 measures Ki and Shō (columns 0 to 111) on the real level with everything in it (L-014).

/** Is tile (col, row) solid by GDD-WLD-17's tables (`GROUND`, `RAMPS`, `ROOF`, `PIECES`)? */
const solid = (col: number, row: number) => {
  const floor = GROUND.find(([a, b]) => col >= a && col <= b)?.[2];
  const ramp = RAMPS.find(([a, b]) => col >= a && col <= b);
  return (
    (floor !== undefined && row >= floor) ||
    (ramp !== undefined && row > ramp[2] + col - ramp[0]) ||
    ROOF.some(([a, b, last]) => col >= a && col <= b && row <= last) ||
    PIECES.some(([a, b, r0, r1]) => col >= a && col <= b && row >= r0 && row <= r1)
  );
};

describe('GDD-WLD-17 level 3-2 layout', () => {
  it('GDD-WLD-17 3-2 is 240 by 17 tiles, World 3 after 3-1, glides, and passes the validator', () => {
    const e = entry();
    expect(e).toMatchObject({ world: 3, test: false });
    expect(e.level).toBe(L);
    expect(worldLevels(3).map((x) => x.id)).toEqual(['3-1', '3-2']);
    expect(levelById('3-1')!.next).toBe('3-2');
    expect([world.width, world.height]).toEqual([240, 17]);
    // GDD-PRG-01: the glide on, the wall cling off, as 3-1.
    expect(L.abilities).toEqual({ glide: true });
    expect(validateLevel(e)).toEqual([]);
    // No crumbling tile, no Murciélago, no Tlacuache (GDD-WLD-17).
    expect(L.crumbles).toEqual([]);
    expect(L.enemies.filter((x) => ['murcielago', 'tlacuache'].includes(kindOf(x)))).toEqual([]);
  }, 30_000);

  it("GDD-WLD-17 3-2 floor, ramps and roof are the table's, tile for tile", () => {
    for (let col = 0; col < 240; col++) {
      for (let row = 0; row < 17; row++) {
        expect(world.solidTile(col, row), `${col},${row}`).toBe(solid(col, row));
        const ramp = RAMPS.find(([a, b]) => col >= a && col <= b);
        expect(world.slopeAt(col, row), `slope ${col},${row}`).toBe(ramp && row === ramp[2] + col - ramp[0] ? '\\' : null);
      }
    }
    // Every column is a floor, a pit or a ramp, and only one.
    for (let col = 0; col < 240; col++) {
      const kinds = [GROUND.some(([a, b]) => col >= a && col <= b), PITS.some(([a, b]) => col >= a && col <= b), RAMPS.some(([a, b]) => col >= a && col <= b)];
      expect(kinds.filter(Boolean).length, `column ${col}`).toBe(1);
    }
    // The ramps run from the upper gallery (row 9) down to the main gallery (row 13), and from the upper level (row 11) into the cuttings
    // (row 15): each ends one row over the floor after it.
    expect(RAMPS.map(([a, b, row]) => [row, row + b - a + 1])).toEqual([[9, 13], [11, 15], [11, 15]]);
  });

  it('GDD-WLD-17 3-2 headroom: 7 tiles at the start, 7 in the upper gallery, 8 in the main gallery, 6 in the pen, 4 at the hops (6 over the first hop, now a sunken floor), 8 on the upper level, 3 in the cuttings', () => {
    const table: readonly (readonly [number, number, number])[] = [
      [0, 7, 7], [8, 29, 7], [34, 57, 8], [63, 79, 8], [85, 96, 8], [98, 103, 8], [107, 115, 8], [118, 128, 6], [129, 130, 4], [131, 132, 6], [133, 136, 4],
      [139, 143, 8], [147, 164, 8], [169, 175, 3], [179, 187, 8], [191, 195, 8], [201, 208, 8], [210, 215, 8], [222, 227, 8], [232, 238, 3], [239, 239, 8],
    ];
    for (const [a, b, n] of table) for (let col = a; col <= b; col++) expect(headroom(col), `column ${col}`).toBe(n);
    // The roof's underside: y = 16 over the start (the table's 32 was a slip: GDD-WLD-03 wants 7 tiles of open air over the spawn), 32 over
    // the upper gallery, 80 over the main gallery, 112 over the pen (the table's 128, one row higher: the designer's change) and the hops, 48 over the upper level; the cutting ledges' at 192.
    expect(ROOF.map(([, , last]) => Y(last + 1))).toEqual([16, 32, 80, 112, 112, 48]);
    expect(Object.values(LEVEL_3_2_LEDGES).map((l) => Y(l.row + 1))).toEqual([192, 192]);
  });

  it('GDD-WLD-17 3-2 pits: 80 to 84, 137 and 138, 144 to 146, 188 to 190, 196 to 200 and 216 to 221; the sunken floors and the spike hollow are no pits', () => {
    // The first hop (131, 132) is a floor sunken 2 tiles (row 13), a 2-tile wall either side (the designer's change).
    for (let col = 131; col <= 132; col++) expect([world.solidTile(col, 13), world.solidTile(col, 12)], `${col}`).toEqual([true, false]);
    for (const col of [130, 133]) expect([world.solidTile(col, 11), world.solidTile(col, 10)], `${col}`).toEqual([true, false]);
    expect(gaps(world).map((g) => [g.col, g.col + g.width - 1])).toEqual(PITS);
    expect(openGaps(L).map((g) => [g.col, g.col + g.width - 1])).toEqual(PITS);
    expect([LEVEL_3_2_PIT_D.col0, LEVEL_3_2_PIT_D.col1]).toEqual([80, 84]);
    // The sunken floor under rail C's end: columns 58 to 62, row 15, 2 tiles down, with a 2-tile wall each side.
    expect(LEVEL_3_2_SUNKEN).toEqual({ col0: 58, col1: 62, row: 15 });
    for (const col of [57, 63]) expect([world.solidTile(col, 13), world.solidTile(col, 12)]).toEqual([true, false]);
    // The spike hollow under rail F's end: floor row 16, three spikes in row 15, a wall at 179.
    for (let col = 176; col <= 178; col++) expect([world.solidTile(col, 16), world.solidTile(col, 15)]).toEqual([true, false]);
    expect(L.spikes).toEqual([176, 177, 178].map((col) => ({ col, row: 15 })));
    expect(world.solidTile(179, 12)).toBe(true);
  });

  it('GDD-WLD-15 3-2 rails: each start, stretches and end, and each ride measured by rolling its cart', () => {
    const table = LETTERS.map((l) => {
      const r = railOf(l);
      return { l, middle: r.x + CART.width / 2, y: r.y, dir: r.dir, segments: r.segments.map((s) => `${s.kind} ${s.tiles}`), end: r.end, endX: endOf(l), endY: railGround(r, railLength(r)) };
    });
    expect(table).toEqual([
      { l: 'A', middle: 144, y: 144, dir: 1, segments: ['level 14'], end: 'buffer', endX: Y(22), endY: 144 },
      { l: 'B', middle: 416, y: 144, dir: 1, segments: ['level 5', 'descent 4', 'level 9'], end: 'buffer', endX: Y(43), endY: 208 },
      { l: 'C', middle: 752, y: 208, dir: 1, segments: ['level 14'], end: 'broken', endX: 960, endY: 208 },
      { l: 'D', middle: 1104, y: 208, dir: 1, segments: ['level 14'], end: 'broken', endX: 1312, endY: 208 },
      { l: 'E', middle: 1424, y: 208, dir: 1, segments: ['level 20'], end: 'buffer', endX: Y(108), endY: 208 },
      { l: 'F', middle: 2256, y: 176, dir: 1, segments: ['level 25', 'descent 4', 'level 7'], end: 'broken', endX: 2816, endY: 240 },
      { l: 'K1', middle: 2960, y: 176, dir: 1, segments: ['level 14'], end: 'broken', endX: 3168, endY: 176 },
      { l: 'K2', middle: 3232, y: 176, dir: 1, segments: ['level 17'], end: 'broken', endX: 3488, endY: 176 },
      { l: 'K3', middle: 3568, y: 176, dir: 1, segments: ['level 6', 'descent 4', 'level 6'], end: 'buffer', endX: Y(238), endY: 240 },
    ]);
    // B's and F's and K3's ramps lie over their slope tiles: the rail's ground at each ramp's top and foot is the floor's.
    expect([railGround(railOf('B'), Y(30) - railOf('B').x), railGround(railOf('B'), Y(34) - railOf('B').x)]).toEqual([Y(9), Y(13)]);
    expect([railGround(railOf('F'), Y(165) - railOf('F').x), railGround(railOf('F'), Y(169) - railOf('F').x)]).toEqual([Y(11), Y(15)]);
    expect([railGround(railOf('K3'), Y(228) - railOf('K3').x), railGround(railOf('K3'), Y(232) - railOf('K3').x)]).toEqual([Y(11), Y(15)]);
    // Each cart rolled alone from its start: the steps to its buffer or to leaving its broken end, and to the top of its ramp. The table's
    // rides: A 12 tiles, 1.28 s; B 1.78 s; C and D 13 tiles, 1.39 s; F 2.56 s to the ramp and 3.8 s to the end; K1 13 tiles, 1.39 s; K2 16
    // tiles, 1.71 s; K3 0.53 s to the ramp and 1.6 s to the buffer (E: the rider's stop, Part 2).
    const rides = LETTERS.map((l) => {
      const i = cartOf(l);
      let carts: CartState[] = LEVEL_3_2_RAILS.map((_, j) => ({ phase: j === i ? 'rolling' : 'waiting', m: CART.width / 2 }));
      let toRamp: number | undefined;
      const descent = railOf(l).segments.findIndex((s) => s.kind === 'descent');
      const rampAt = descent < 0 ? Infinity : TILE * railOf(l).segments.slice(0, descent).reduce((n, s) => n + s.tiles, 0);
      let n = 0;
      for (; n < 600 && carts[i]!.phase === 'rolling'; n++) {
        carts = rollCarts(LEVEL_3_2_RAILS, carts);
        if (toRamp === undefined && carts[i]!.m >= rampAt) toRamp = n + 1;
      }
      const tiles = (railLength(railOf(l)) - CART.width / 2 - (railOf(l).end === 'buffer' ? CART.width / 2 : 0)) / TILE;
      return { l, steps: n, tiles, ...(toRamp !== undefined ? { toRamp } : {}) };
    });
    expect(rides).toEqual([
      { l: 'A', steps: 77, tiles: 12 }, // 1.28 s
      { l: 'B', steps: 107, tiles: 16, toRamp: 26 }, // 1.78 s
      { l: 'C', steps: 84, tiles: 13 }, // 1.40 s; GDD says 1.39 s (83.2 steps): the cart leaves on the step its middle reaches the end
      { l: 'D', steps: 84, tiles: 13 },
      { l: 'E', steps: 116, tiles: 18 }, // 1.93 s to its buffer, empty
      { l: 'F', steps: 229, tiles: 35, toRamp: 154 }, // 3.82 s; 2.57 s to the ramp; GDD says 3.8 s and 2.56 s (153.6 steps)
      { l: 'K1', steps: 84, tiles: 13 },
      { l: 'K2', steps: 103, tiles: 16 }, // 1.72 s; GDD says 1.71 s
      { l: 'K3', steps: 95, tiles: 14, toRamp: 32 }, // 1.58 s; 0.53 s to the ramp
    ]);
  });

  it('GDD-WLD-15 3-2 every broken end has its lit post 6 tiles before it: columns 54, 76, 170, 192 and 212', () => {
    expect(LETTERS.map((l) => warningPost(railOf(l))?.x)).toEqual([undefined, undefined, Y(54), Y(76), undefined, Y(170), Y(192), Y(212), undefined]);
    for (const l of LETTERS) {
      const post = warningPost(railOf(l));
      if (post) expect(endOf(l) - post.x, l).toBe(96);
    }
  });

  it('GDD-WLD-15 3-2 the beams and the rib hang 32 px over their rails\' ground, with open space over each beam and ground beside the rail; the cutting ledges are 48 px over theirs', () => {
    expect(LEVEL_3_2_BEAMS).toEqual({ E: { col: 97, row: 10 }, K2: { col: 209, row: 8 } });
    expect(railOf('E').y - Y(LEVEL_3_2_BEAMS.E.row + 1)).toBe(32);
    expect(railOf('K2').y - Y(LEVEL_3_2_BEAMS.K2.row + 1)).toBe(32);
    for (const b of Object.values(LEVEL_3_2_BEAMS)) {
      expect(world.solidTile(b.col, b.row - 1), `over ${b.col}`).toBe(false);
      expect(world.solidTile(b.col, b.row + 3), `ground under ${b.col}`).toBe(true);
    }
    expect(LEVEL_3_2_RIB).toEqual({ col0: 104, col1: 106, row0: 5, row1: 10 });
    expect(railOf('E').y - Y(LEVEL_3_2_RIB.row1 + 1)).toBe(32);
    // The rib comes down from the roof: nothing over it is open.
    for (let col = 104; col <= 106; col++) for (let row = 0; row <= 10; row++) expect(world.solidTile(col, row), `${col},${row}`).toBe(true);
    expect(railGround(railOf('F'), Y(170) - railOf('F').x) - Y(LEVEL_3_2_LEDGES.F.row + 1)).toBe(48);
    expect(railGround(railOf('K3'), Y(233) - railOf('K3').x) - Y(LEVEL_3_2_LEDGES.K3.row + 1)).toBe(48);
    // The ledges' lips: F's at column 169 (x = 2704), K3's at 232.
    expect([LEVEL_3_2_LEDGES.F.col0 * TILE, LEVEL_3_2_LEDGES.K3.col0]).toEqual([2704, 232]);
  });

  it('GDD-WLD-04 3-2 has the 50 hilos as listed, none in a tile', () => {
    const listed: readonly (readonly [number, number])[] = [
      [4, 7], [5, 7],
      [12, 6], [15, 6], [18, 6], [26, 6], [37, 10], [40, 10], [52, 10], [73, 10], [93, 10], [145, 8], [150, 8], [154, 8], [158, 8], [188, 8], [191, 8],
      [31, 8], [32, 9], [33, 10],
      [59, 9], [61, 8], [64, 11], [81, 9], [83, 8], [86, 11], [164, 8], [166, 6], [168, 7], [171, 9], [197, 7], [199, 6], [202, 9], [217, 7], [219, 6], [223, 9], [227, 8], [229, 6], [231, 7],
      [97, 8], [209, 6], [104, 12], [106, 12],
      [116, 9], [121, 10], [123, 10], [125, 10], [132, 9], [138, 9],
      [236, 13],
    ];
    expect(L.hilos!.map((h) => [h.col, h.row])).toEqual(listed);
    for (const h of L.hilos!) {
      expect(world.solidTile(h.col, h.row), `${h.col},${h.row}`).toBe(false);
      expect(world.slopeAt(h.col, h.row), `${h.col},${h.row}`).toBeNull();
    }
  });

  it("GDD-WLD-04 3-2 each rider's hilo is touched by a still rider in his cart and by no walker on the floor below it", () => {
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'K1'] as const) {
      const hilos: readonly (readonly [number, number])[] = LEVEL_3_2_RIDER_HILOS[letter];
      const rail = railOf(letter);
      const i = cartOf(letter);
      // A still rider at the cart's middle, on its floor, at every step of its roll from its start to its end.
      let carts: CartState[] = LEVEL_3_2_RAILS.map((_, j) => ({ phase: j === i ? 'rolling' : 'waiting', m: CART.width / 2 }));
      const touched = new Set<string>();
      for (let n = 0; n < 600 && carts[i]!.phase === 'rolling'; n++) {
        const f = cartFloor(rail, carts[i]!);
        const rider = standing(f.x + f.w / 2, f.y);
        for (const [col, row] of hilos) if (touchesHilo(rider, { col, row })) touched.add(`${col},${row}`);
        carts = rollCarts(LEVEL_3_2_RAILS, carts);
      }
      expect(touched, letter).toEqual(new Set(hilos.map(([c, r]) => `${c},${r}`)));
      // A walker standing on the floor under it, wherever his box reaches its column (none over a pit: there is no floor there).
      for (const [col, row] of hilos) {
        for (let x = col * TILE - 8; x <= (col + 1) * TILE + 8; x++) {
          const y = floorBelow(x, row);
          if (y !== null) expect(touchesHilo(standing(x, y), { col, row }), `walker at ${x} under ${col},${row}`).toBe(false);
        }
      }
    }
  });

  it('GDD-ENM-04 3-2 enemies: Armadillos at 126 and 153, Alacranes at 149, 157 and 193', () => {
    expect(L.enemies).toBe(LEVEL_3_2_ENEMIES);
    expect(L.enemies).toEqual([
      { x: mid(126), y: Y(13), kind: 'armadillo' },
      { x: mid(149), y: Y(11) },
      { x: mid(153), y: Y(11), kind: 'armadillo' },
      { x: mid(157), y: Y(11) },
      { x: mid(193), y: Y(11) },
    ]);
  });

  it('GDD-ENM-04 3-2 every enemy starts 192 px or more from every respawn', () => {
    const near: string[] = [];
    for (const e of L.enemies) for (const r of [L.spawn, ...L.ofrendas]) if (Math.hypot(e.x - r.x, e.y - r.y) < 192) near.push(`${kindOf(e)} ${e.x} to ${r.x}`);
    expect(near).toEqual([]);
    // The nearest: K1's Alacrán, exactly 192 px from the third ofrenda.
    expect(Math.min(...L.enemies.flatMap((e) => [L.spawn, ...L.ofrendas].map((r) => Math.hypot(e.x - r.x, e.y - r.y))))).toBe(192);
  });

  it('GDD-WLD-03 3-2 ofrendas stand at columns 65, 110 and 181', () => {
    expect(L.ofrendas.map((o) => [o.id, o.x, o.y])).toEqual([
      ['3-2-1', mid(65), Y(13)],
      ['3-2-2', mid(110), Y(13)],
      ['3-2-3', mid(181), Y(11)],
    ]);
    [27.3, 46.0, 75.6].forEach((share, i) => expect((L.ofrendas[i]!.x / (240 * TILE)) * 100).toBeCloseTo(share, 1));
  });

  it("GDD-WLD-03 3-2 each ofrenda stands after a ride's end, on plain floor, 3 to 30 tiles before the next cart's start", () => {
    // [the ride before it ends, the next cart's start column]: C's torn end and D's cart; E's buffer and F's cart; F's torn end and K1's cart.
    const between: readonly (readonly [Letter, Letter])[] = [['C', 'D'], ['E', 'F'], ['F', 'K1']];
    L.ofrendas.forEach((o, i) => {
      const [before, next] = between[i]!;
      const col = Math.floor(o.x / TILE);
      expect(o.x - OFRENDA_HALF, o.id).toBeGreaterThan(endOf(before) + 8); // past the end and its buffer's 8 px
      const ahead = railOf(next).x / TILE - col;
      expect(ahead, o.id).toBeGreaterThanOrEqual(3);
      expect(ahead, o.id).toBeLessThanOrEqual(30);
      // On plain floor, 3 tiles wide.
      for (let c = col - 1; c <= col + 1; c++) expect([world.solidTile(c, o.y / TILE), world.solidTile(c, o.y / TILE - 1)], `${o.id} at ${c}`).toEqual([true, false]);
    });
    expect(L.ofrendas.map((o, i) => railOf(between[i]![1]).x / TILE - Math.floor(o.x / TILE))).toEqual([3, 30, 3]);
  });

  it('GDD-WLD-17 3-2 the spawn at column 3 on the step, the exit at column 234 on the last ledge, the veladora at 238 row 13, the piñata at 113 row 9', () => {
    expect(L.spawn).toEqual({ x: mid(3), y: Y(8) });
    expect(L.exit).toEqual({ x: 3752, y: 176 });
    expect(L.veladora).toEqual({ col: 238, row: 13 });
    expect(L.pinatas).toEqual([{ col: 113, row: 9 }]);
    // The piñata hangs 48 px over the floor.
    expect(Y(13) - Y(10)).toBe(48);
  });
});

describe('GDD-WLD-17 level 3-2 Ki and Sho, measured', () => {
  it('GDD-WLD-17 3-2 the first ride needs no jump: right held from the spawn drops him into cart A, which rides to its buffer with every start and rail A hilo', () => {
    for (const after of [right, idle]) {
      const states = rideA(after);
      const board = states.findIndex((s) => s.carts[cartOf('A')]!.phase === 'rolling');
      const stop = states.findIndex((s) => s.carts[cartOf('A')]!.phase === 'stopped');
      expect(board).toBeGreaterThan(0);
      // He never pressed jump: he walked off the step and landed in it, 8 px down.
      expect(states[board]!.player).toMatchObject({ grounded: true, y: Y(9) - CART.floorPx, x: 144 });
      // Measured: he lands on the 50th step from the spawn; the ride is 77 steps (1.28 s).
      expect([board, stop - board]).toEqual([49, 77]);
      expect(states.slice(board, stop + 1).every((s) => inCart(s, 'A'))).toBe(true);
      for (const [c, r] of A_HILOS) expect(took(states[stop]!, c, r), `${c},${r}`).toBe(true);
      expect(lostIn(states, startRun(L))).toBe(false);
    }
  });

  it('GDD-WLD-15 3-2 left held from the landing in cart A turns him only: he rides to the buffer at the cart\'s middle and then walks back to the step', () => {
    const states = rideA({ move: -1, jumpHeld: false }, 150);
    const board = states.findIndex((s) => s.carts[cartOf('A')]!.phase === 'rolling');
    const stop = states.findIndex((s) => s.carts[cartOf('A')]!.phase === 'stopped');
    // From the step after the landing (on which right was still held) to the stop: at the cart's middle, facing left.
    expect(states.slice(board + 1, stop).every((s) => inCart(s, 'A') && s.player.x === middleOf(s, 'A') && s.player.facing === -1)).toBe(true);
    // On the step it stops it anchors nobody, and he takes his first step back in it.
    expect(inCart(states[stop]!, 'A')).toBe(true);
    expect(states[stop]!.player.x).toBeLessThan(336);
    // Measured: 150 steps after the stop he has walked off its back and on to the start step's face (x = 128 + 6), where he stands.
    expect(states[states.length - 1]!.player).toMatchObject({ x: 134, y: Y(9), grounded: true });
  });

  it('GDD-WLD-15 3-2 past cart A\'s buffer he walks through cart B at the ground\'s height without boarding it, and a hop into it boards', () => {
    const a = rideA(idle);
    const stopped = a[a.length - 1]!;
    // Walking on: right held, until he is 2 tiles past B's front.
    const walk = play(stopped, 300, () => right, (r) => r.player.x > railOf('B').x + 2 * CART.width + 6);
    expect(walk[walk.length - 1]!.player.x).toBeGreaterThan(railOf('B').x + 2 * CART.width + 6);
    expect(walk.every((s) => s.carts[cartOf('B')]!.phase === 'waiting')).toBe(true);
    const passing = walk.filter((s) => s.player.x + 6 > railOf('B').x && s.player.x - 6 < railOf('B').x + CART.width);
    expect(passing.length).toBeGreaterThan(0);
    expect(passing.every((s) => s.player.grounded && s.player.y === Y(9))).toBe(true);
    // A hop into it boards it, from the floor before it.
    const hop = hopIn(a[a.length - 1]!, 'B');
    expect(hop[hop.length - 1]!.carts[cartOf('B')]!.phase).toBe('rolling');
    expect(inCart(hop[hop.length - 1]!, 'B')).toBe(true);
  });

  it('GDD-WLD-17 3-2 a jump from cart A at every step of its ride, four ways: where each lands, no life lost, and the take-offs that land in cart B', () => {
    // The ride's states from the landing in A (its step 0) to the stop at its buffer, he holding nothing.
    const a = rideA(idle);
    const board = a.findIndex((s) => s.carts[cartOf('A')]!.phase === 'rolling');
    const stop = a.findIndex((s) => s.carts[cartOf('A')]!.phase === 'stopped');
    const rides = a.slice(board, stop + 1);
    const flights = sweep(rides);
    // Nothing here can cost a life.
    for (const kind of JUMPS) expect(flights[kind].filter((f) => f.lost || lostIn(f.states, rides[0]!)).map((f) => f.k), kind).toEqual([]);
    const where = Object.fromEntries(JUMPS.map((kind) => [kind, runsOf(flights[kind])]));
    // Measured. Step 77 is the stop: from the stopped cart a jump has no carried speed. Held is the glide (GDD-MOV-07): it flies past cart
    // B and down the ramp into the main gallery from step 60 on.
    expect(where).toEqual({
      tap: ['0-68 cart A', '69-77 floor 9'],
      top: ['0-51 cart A', '52-65 floor 9', '66-76 cart B', '77 floor 9'],
      held: ['0-17 cart A', '18-31 floor 9', '32-49 cart B', '50-59 floor 9', '60-76 floor 13', '77 floor 9'],
      again: ['0-51 cart A', '52-65 floor 9', '66-76 cart B', '77 floor 9'],
    });
    // GDD: "a jump from cart A's last tile lands in cart B".
    const inB = Object.fromEntries(JUMPS.map((kind) => [kind, windowOf(flights[kind], (f) => landedAs(f) === 'cart B', endOf('A'))]));
    // Measured: the plain jump from the last 11 steps of the ride before the stop, its middle 43 to 18 px before the rail's end (the
    // cart's last tile is 32 to 16 px before it); the glide from 18 steps, 128 to 85.5 px before it; a tap never.
    expect(inB).toEqual({
      tap: { count: 0 },
      top: { first: 66, last: 76, count: 11, firstPx: 43, lastPx: 18 },
      held: { first: 32, last: 49, count: 18, firstPx: 128, lastPx: 85.5 },
      again: { first: 66, last: 76, count: 11, firstPx: 43, lastPx: 18 },
    });
  }, 30_000);

  it('GDD-WLD-17 3-2 rail B: a hop in rides the ramp at 180 px/s with its hilos to the buffer at 43; a jump at every step of the ride, four ways', () => {
    const a = rideA(idle);
    const hop = hopIn(a[a.length - 1]!, 'B');
    const landed = hop[hop.length - 1]!;
    expect(inCart(landed, 'B')).toBe(true);
    const ride = [landed, ...play(landed, 300, () => idle, (r) => r.carts[cartOf('B')]!.phase === 'stopped')];
    const last = ride[ride.length - 1]!;
    expect(last.carts[cartOf('B')]).toMatchObject({ phase: 'stopped', m: railLength(railOf('B')) - CART.width / 2 });
    expect(middleOf(last, 'B') + CART.width / 2).toBe(Y(43)); // its front at the buffer in column 43
    expect(ride.every((s) => inCart(s, 'B'))).toBe(true);
    // On the ramp the cart's middle moves 180 / sqrt 2 px across a step (180 px/s along it); on the level, 150.
    const onRamp = ride.slice(1).filter((_s, i) => {
      const was = ride[i]!.carts[cartOf('B')]!.m;
      return was >= 5 * TILE && was < 9 * TILE;
    });
    // (The last step, on which it reaches its buffer, is cut short there.)
    for (const [i, s] of ride.slice(1, -1).entries()) {
      const was = ride[i]!.carts[cartOf('B')]!.m;
      const moved = s.carts[cartOf('B')]!.m - was;
      expect(moved, `step ${i}`).toBeCloseTo(was >= 5 * TILE && was < 9 * TILE ? 180 / Math.SQRT2 / 60 : 150 / 60, 9);
    }
    // Measured: 30 steps on the ramp (0.50 s; 64 px across at 127.3 px/s), the ride 107 steps from the landing (1.78 s).
    expect([onRamp.length, ride.length - 1]).toEqual([30, 107]);
    for (const [c, r] of [[26, 6], [31, 8], [32, 9], [33, 10], [37, 10], [40, 10]] as const) expect(took(last, c, r), `${c},${r}`).toBe(true);
    expect(lostIn(ride, landed)).toBe(false);
    // The jump sweep over every step of the ride, the ramp included, to the stop.
    const flights = sweep(ride);
    for (const kind of JUMPS) expect(flights[kind].filter((f) => f.lost || lostIn(f.states, landed)).map((f) => f.k), kind).toEqual([]);
    // Measured. The ramp is under the cart's middle from step 26 to 55: a plain jump taken as it starts down (26 to 39) comes down past
    // the cart on the main gallery's floor, the cart having dropped away under him; 107 is the stop. Held (the glide) from the landing step
    // flies over the whole ramp.
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, runsOf(flights[kind])]))).toEqual({
      tap: ['0-98 cart B', '99-107 floor 13'],
      top: ['0-25 cart B', '26-39 floor 13', '40-81 cart B', '82-96 floor 13', '97-106 cart C', '107 floor 13'],
      held: ['0 floor 13', '1-39 cart B', '40-50 floor 13', '51-55 cart B', '56-62 floor 13', '63-79 cart C', '80-107 floor 13'],
      again: ['0-18 cart B', '19-39 floor 13', '40-81 cart B', '82-96 floor 13', '97-106 cart C', '107 floor 13'],
    });
    // GDD: "from B's last tile [a jump lands] in cart C".
    // Measured: the plain jump from B's last 10 steps of rolling, its middle 40.9 to 18.4 px before the rail's end; the glide from 125.9 to
    // 85.9 px before it; a tap never.
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, windowOf(flights[kind], (f) => landedAs(f) === 'cart C', endOf('B'))]))).toEqual({
      tap: { count: 0 },
      top: { first: 97, last: 106, count: 10, firstPx: 40.9, lastPx: 18.4 },
      held: { first: 63, last: 79, count: 17, firstPx: 125.9, lastPx: 85.9 },
      again: { first: 97, last: 106, count: 10, firstPx: 40.9, lastPx: 18.4 },
    });
  }, 30_000);
});

describe('GDD-WLD-17 level 3-2 Sho: the broken ends of rails C and D', () => {
  it('GDD-WLD-15 3-2 rail C: staying in, he falls onto the sunken floor with no life lost, the cart broken, and gets out to the left and to the right', () => {
    const start = at(mid(44), Y(13));
    const ride = rideFrom(mid(44), Y(13), 'C', 60);
    expect(lostIn(ride, start)).toBe(false);
    const down = ride.findIndex((s) => s.player.grounded && s.player.y === Y(15));
    expect(down).toBeGreaterThan(0);
    expect(ride.slice(down).some((s) => s.carts[cartOf('C')]!.phase === 'gone')).toBe(true);
    const leave = ride.findIndex((s) => s.carts[cartOf('C')]!.phase === 'falling');
    // Measured: he lands on the sunken floor 12 steps after the cart leaves the rail, 32 px past its end (lab-3c's R6: 12 steps, 31.5 px).
    expect([down - leave, ride[down]!.player.x - endOf('C')]).toEqual([12, 32]);
    // Out each way over its 2-tile wall: walk to the wall, jump held, on to the floor beyond.
    for (const dir of [-1, 1] as const) {
      let pressed = false;
      const out = play(ride[down]!, 300, (r) => {
        const wall = dir < 0 ? LEVEL_3_2_SUNKEN.col0 * TILE + 6 : (LEVEL_3_2_SUNKEN.col1 + 1) * TILE - 6;
        if (!pressed && r.player.grounded && Math.abs(r.player.x - wall) < 2) pressed = true;
        return { move: dir, jumpHeld: pressed };
      }, (r) => pressed && r.player.grounded && r.player.y === Y(13));
      const end = out[out.length - 1]!;
      expect(end.player, `${dir}`).toMatchObject({ grounded: true, y: Y(13) });
      expect(dir < 0 ? end.player.x < LEVEL_3_2_SUNKEN.col0 * TILE : end.player.x > (LEVEL_3_2_SUNKEN.col1 + 1) * TILE, `${dir}`).toBe(true);
      expect(lostIn(out, start)).toBe(false);
    }
  });

  it('GDD-WLD-15 3-2 rail C: a jump at every step of the ride and the coyote steps, four ways: the bank, the sunken floor or the cart, and no life lost', () => {
    const { rides, leave, flights, as } = brokenSweep('C', mid(44), Y(13));
    expect(leave).toBe(84);
    for (const kind of JUMPS) expect(flights[kind].filter((f) => f.lost || lostIn(f.states, rides[0]!)).map((f) => f.k), kind).toEqual([]);
    // Measured, by the take-off's step from the landing in C (the press on the next step); 84 is the step it leaves the rail, 84 to 88 the
    // coyote steps after the press on the leaving step (83). The glide from 64 to 81 flies past the bank into cart D.
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, runsOf(flights[kind], as)]))).toEqual({
      tap: ['0-66 cart C', '67-80 floor 15', '81-88 bank', '89 floor 15'],
      top: ['0-49 cart C', '50-64 floor 15', '65-88 bank', '89 floor 15'],
      held: ['0-15 cart C', '16-24 floor 15', '25-63 bank', '64-81 cart D', '82-88 bank', '89 floor 15'],
      again: ['0-49 cart C', '50-64 floor 15', '65-88 bank', '89 floor 15'],
    });
    // Measured: the bank from the plain jump taken 45.5 px before the end (the cart's middle there, its step 65) to the last coyote press,
    // 12 px past it (88); the glide from 145.5 px before it, with the cart-D landings inside; a tap only from 5.5 px before it.
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, windowOf(flights[kind], (f) => as(f) === 'bank', endOf('C'))]))).toEqual({
      tap: { first: 81, last: 88, count: 8, firstPx: 5.5, lastPx: -12 },
      top: { first: 65, last: 88, count: 24, firstPx: 45.5, lastPx: -12 },
      held: { first: 25, last: 88, count: 46, firstPx: 145.5, lastPx: -12 },
      again: { first: 65, last: 88, count: 24, firstPx: 45.5, lastPx: -12 },
    });
    // GDD: "a jump from the cart's last two tiles lands on the bank (a plain jump taken up to 2 tiles early)": every plain jump taken with
    // him at most 32 px before the rail's end, while the cart rolls.
    const lastTwo = flights.top.filter((f) => f.k < leave && endOf('C') - f.x <= 2 * TILE);
    expect(lastTwo.length).toBeGreaterThan(10);
    expect(lastTwo.filter((f) => as(f) !== 'bank').map((f) => f.k)).toEqual([]);
    // A glide that lands in cart D has flown over the ofrenda at 65: the checkpoint he has at that landing (-1, the level's start; 0, the
    // ofrenda at 65). Measured: some of them land in D without it, so a life lost at D's end would bring him back at the spawn.
    expect([...new Set(flights.held.filter((f) => as(f) === 'cart D').map((f) => f.landed!.checkpointIndex))]).toEqual([0, -1]);
  }, 30_000);

  it('GDD-WLD-15 3-2 rail C: from the step the cart passes the post at column 54 to its torn end at x = 960', () => {
    const ride = rideFrom(mid(44), Y(13), 'C', 0);
    const post = warningPost(railOf('C'))!.x;
    const passed = ride.findIndex((s) => middleOf(s, 'C') >= post);
    const leave = ride.findIndex((s) => s.carts[cartOf('C')]!.phase === 'falling');
    // GDD says 0.64 s (38.4 steps, 96 px at 150 px/s). Measured: 39 steps, the step its middle passes the post to the step it leaves.
    expect(leave - passed).toBe(39);
  });

  it('GDD-WLD-15 3-2 rail D equals rail C tile for tile but for the pit, its bank 3 tiles past its end as C\'s', () => {
    const [c, d] = [railOf('C'), railOf('D')];
    expect(d.segments).toEqual(c.segments);
    expect([d.y, d.end, d.dir]).toEqual([c.y, c.end, c.dir]);
    expect((d.x - c.x) / TILE).toBe(22);
    // The far bank's first column, 3 tiles past each end: 63 for C (the sunken floor's far wall), 85 for D (pit D's far bank).
    expect([(LEVEL_3_2_SUNKEN.col1 + 1) * TILE - endOf('C'), (LEVEL_3_2_PIT_D.col1 + 1) * TILE - endOf('D')]).toEqual([48, 48]);
    // Tile for tile: every tile from the cart's start to the far bank's first column is the same at C and D, the pit's columns (and the
    // sunken floor's) left out.
    for (let dc = -2; dc < 17; dc++) {
      const [cc, dd] = [c.x / TILE + dc, d.x / TILE + dc];
      const pit = dd >= LEVEL_3_2_PIT_D.col0 && dd <= LEVEL_3_2_PIT_D.col1;
      for (let row = 0; row < 17; row++) if (!pit || row < 13) expect(world.solidTile(dd, row), `${dd},${row} against ${cc},${row}`).toBe(world.solidTile(cc, row));
    }
  });

  it('GDD-WLD-15 3-2 rail D: a jump at every step of the ride and the coyote steps, four ways: the take-offs that land on the bank, and every lost one before or after the window', () => {
    const { leave, flights, as } = brokenSweep('D', mid(65), Y(13));
    expect(leave).toBe(84);
    // Measured, as for C. A plain jump pressed on the coyote steps 87 and 88 flies on into cart E, and the glide from 52 to 68.
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, runsOf(flights[kind], as)]))).toEqual({
      tap: ['0-66 cart D', '67-80 lost', '81-88 bank', '89 lost'],
      top: ['0-49 cart D', '50-64 lost', '65-86 bank', '87-88 cart E', '89 lost'],
      held: ['0-15 cart D', '16-24 lost', '25-51 bank', '52-68 cart E', '69-88 bank', '89 lost'],
      again: ['0-49 cart D', '50-64 lost', '65-86 bank', '87-88 cart E', '89 lost'],
    });
    const windows = Object.fromEntries(JUMPS.map((kind) => [kind, windowOf(flights[kind], (f) => as(f) === 'bank', endOf('D'))]));
    // Measured: as C's but for the coyote presses into cart E. The plain jump's window is 22 take-offs, 45.5 px before the end to 7 px past
    // it (19 of them while the cart rolls, 45.5 to 0.5 px; lab-3c's R5, the same pit: 44 to 1.5 px, 18 steps).
    expect(windows).toEqual({
      tap: { first: 81, last: 88, count: 8, firstPx: 5.5, lastPx: -12 },
      top: { first: 65, last: 86, count: 22, firstPx: 45.5, lastPx: -7 },
      held: { first: 25, last: 88, count: 47, firstPx: 145.5, lastPx: -12 },
      again: { first: 65, last: 86, count: 22, firstPx: 45.5, lastPx: -7 },
    });
    for (const kind of JUMPS) {
      const w = windows[kind]!;
      if (w.count === 0) continue;
      // No hole inside a window: every take-off that loses a life is before its first or after its last.
      const lost = flights[kind].filter((f) => as(f) === 'lost');
      expect(lost.every((f) => f.k < w.first! || f.k > w.last!), kind).toBe(true);
    }
    // The checkpoint he has on landing in cart E: the ofrenda at 65 (0), from which this ride started.
    expect([...new Set(JUMPS.flatMap((kind) => flights[kind].filter((f) => as(f) === 'cart E').map((f) => f.landed!.checkpointIndex)))]).toEqual([0]);
  }, 30_000);

  it('GDD-WLD-15 3-2 rail D: staying in costs one life; the respawn is the ofrenda at 65 with cart D at its start, and the walk to it boards it by a hop', () => {
    const start = at(mid(65), Y(13));
    const ride = rideFrom(mid(65), Y(13), 'D', 120);
    const fell = ride.findIndex((s) => s.phase === 'respawning');
    expect(fell).toBeGreaterThan(0);
    expect(ride[fell]!.lives.lives).toBe(start.lives.lives - 1);
    const back = ride.findIndex((s, i) => i > fell && s.phase === 'playing');
    expect(back).toBeGreaterThan(fell);
    expect(ride[back]!.player).toMatchObject({ x: mid(65), y: Y(13) });
    expect(ride[back]!.carts[cartOf('D')]).toEqual({ phase: 'waiting', m: CART.width / 2 });
    // The ofrenda is 3 tiles before the cart: the hop bot walks there and lands in it.
    const hop = hopIn(ride[back]!, 'D');
    const boarded = hop[hop.length - 1]!;
    expect(boarded.carts[cartOf('D')]!.phase).toBe('rolling');
    expect(inCart(boarded, 'D')).toBe(true);
    expect(boarded.lives.lives).toBe(start.lives.lives - 1);
  });
});

describe('GDD-WLD-17 level 3-2 Sho: rail E, the hanging beam and the rib', () => {
  it('GDD-WLD-15 3-2 rail E: a rider who does nothing is stopped by the beam and stands on the floor, and the cart rolls on to its buffer and is back 2 s after it stops', () => {
    const start = at(mid(86), Y(13));
    const ride = rideE();
    expect(lostIn(ride, start)).toBe(false);
    expect(Math.max(...ride.map((s) => s.player.x))).toBeLessThanOrEqual(BEAM_FACE - 6 + 1e-6);
    const left = ride.findIndex((s) => !inCart(s, 'E'));
    const stopped = ride.findIndex((s) => s.player.x >= BEAM_FACE - 6 - 1e-6);
    const stop = ride.findIndex((s) => s.carts[cartOf('E')]!.phase === 'stopped');
    expect(ride[stop]!.player).toMatchObject({ grounded: true, y: Y(13), x: BEAM_FACE - 6 });
    expect(ride[stop]!.carts[cartOf('E')]!.m).toBe(railLength(railOf('E')) - CART.width / 2);
    // Measured: he is off the cart's floor 57 steps after the landing and against the beam's face from step 58 (0.97 s);
    // the cart stops at its buffer 116 steps after the landing, and is back at its start 120 steps (2.0 s) after it stops. (GDD-WLD-17's
    // "stopped at x = 1664 (1.6 s)" is the rib's stop of a rider who hopped the beam: the next test.)
    expect([left, stopped, stop, ride.length - 1 - stop]).toEqual([57, 58, 116, 120]);
    expect(ride[ride.length - 1]!.carts[cartOf('E')]).toEqual({ phase: 'waiting', m: CART.width / 2 });
  });

  it('GDD-WLD-15 3-2 rail E: the take-offs from which a jump clears the hanging beam and lands back in the cart, and which take the hilos at 93 and over the beam', () => {
    const ride = rideE();
    const rides = ride.slice(0, ride.findIndex((s) => !inCart(s, 'E')));
    // Right held in the air (as every sweep here), and nothing held (as lab-3c's measure of the window).
    const flights = sweep(rides);
    const still = sweep(rides, 0);
    // Measured: with right held, a jump that meets the beam's face climbs onto its top (floor 10) once he is over it, the carried speed gone
    // and his own run taking him there; earlier ones land on it from above.
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, runsOf(flights[kind])]))).toEqual({
      tap: ['0-40 cart E', '41-56 floor 13'],
      top: ['0-21 cart E', '22-32 floor 10', '33-40 cart E', '41-56 floor 10'],
      held: ['0-14 floor 13', '15-25 floor 10', '26-34 cart E', '35-56 floor 13'],
      again: ['0-21 cart E', '22-32 floor 10', '33-40 cart E', '41-56 floor 10'],
    });
    // Nothing held: the same, but one who meets the face drops down it to the floor.
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, runsOf(still[kind])]))).toEqual({
      tap: ['0-40 cart E', '41-56 floor 13'],
      top: ['0-21 cart E', '22-32 floor 10', '33-40 cart E', '41-56 floor 13'],
      held: ['0-14 floor 13', '15-25 floor 10', '26-34 cart E', '35-56 floor 13'],
      again: ['0-21 cart E', '22-32 floor 10', '33-40 cart E', '41-56 floor 13'],
    });
    // GDD-WLD-15: the plain jump 8 steps, 45 to 27.5 px before the beam's near face; the glide 16 steps, 25 to 62.5 px (not measured before).
    // Measured, either way held: the plain jump 8 steps, 45.5 to 28 px (the ride's 2.5 px steps fall 0.5 px from the lab's); the glide 9
    // steps, 63 to 43 px (GDD says 16 steps, 25 to 62.5 px; the runs above: taken earlier it ends on the floor (0 to 14) or on the beam's
    // top (15 to 25), later on the floor (35 to 56)); a tap never.
    const window = {
      tap: { count: 0 },
      top: { first: 33, last: 40, count: 8, firstPx: 45.5, lastPx: 28 },
      held: { first: 26, last: 34, count: 9, firstPx: 63, lastPx: 43 },
      again: { first: 33, last: 40, count: 8, firstPx: 45.5, lastPx: 28 },
    };
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, windowOf(flights[kind], clears, BEAM_FACE)]))).toEqual(window);
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, windowOf(still[kind], clears, BEAM_FACE)]))).toEqual(window);
    for (const kind of JUMPS) expect([...flights[kind], ...still[kind]].filter((f) => f.lost || lostIn(f.states, rides[0]!)).map((f) => f.k), kind).toEqual([]);
    // Which take-offs take the rider's hilo (93, 10) and the hop's (97, 8), right held in the air.
    // Measured: (93, 10) by every rider who passes under it in the cart, and by every jump but one over it from 6 to 18 (the plain jump)
    // or from 0 to 18 (the glide), which flies over it; (97, 8) by every jump that lands on the beam, clears it, or (right held) climbs onto
    // it from its face.
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, runsOf(flights[kind], beamHilos)]))).toEqual({
      tap: ['0-56 93'],
      top: ['0-5 93', '6-18 none', '19-21 93', '22-56 93 97'],
      held: ['0-14 none', '15-18 97', '19-56 93 97'],
      again: ['0-5 93', '6-18 none', '19-21 93', '22-56 93 97'],
    });
  }, 30_000);

  it('GDD-WLD-15 3-2 rail E: the rib stops every rider whatever he does from the beam on, and he walks under it to the ofrenda at 110 with its two hilos', () => {
    // A ride with a plain jump over the beam, taken 40 px before its face; back in the cart, he holds nothing.
    const ride = rideE();
    const k = ride.findIndex((s, i) => inCart(s, 'E') && pastBeam(fly(s, 'top', i).landed ?? s));
    const hop = fly(ride[k]!, 'top', k);
    expect(hop.landed && pastBeam(hop.landed)).toBe(true);
    const on = play(hop.landed!, 200, () => idle, (r) => !inCart(r, 'E'));
    const rides = [hop.landed!, ...on.slice(0, -1)];
    expect(rides.every((s) => inCart(s, 'E'))).toBe(true);
    // GDD says the rider is stopped at x = 1664 (his box's front at the rib's face) 1.6 s (96 steps) after the landing. Measured, counted
    // from the landing in E with the hop's take-off at its step 33: his box's front reaches the rib's face on step 103 (1.72 s).
    const more = play(hop.landed!, 200, () => idle);
    const atRib = k + hop.states.length + 1 + more.findIndex((st) => st.player.x >= RIB_FACE - 6 - 1e-6);
    expect([k, atRib]).toEqual([33, 103]);
    // From every step of the ride between the beam's far face and the rib, each jump, then nothing held until the cart has stopped.
    const flights = sweep(rides);
    const ends = new Map<Flight, RunState>();
    for (const kind of JUMPS) {
      for (const f of flights[kind]) {
        const from = f.landed ?? f.states[f.states.length - 1]!;
        const tail = play(from, 300, () => idle, (r) => r.carts[cartOf('E')]!.phase !== 'rolling' && !inCart(r, 'E'));
        const all = [...f.states, ...tail];
        expect(Math.max(...all.map((s) => s.player.x)), `${kind} ${f.k}`).toBeLessThanOrEqual(RIB_FACE - 6 + 1e-6);
        expect(lostIn(all, rides[0]!), `${kind} ${f.k}`).toBe(false);
        ends.set(f, all[all.length - 1]!);
      }
    }
    // Where each leaves him: standing on the floor, at x.
    const leaves = (f: Flight) => {
      const end = ends.get(f)!;
      return `${end.player.grounded && end.player.y === Y(13) ? 'floor' : 'not floor'} ${Math.round(end.player.x)}`;
    };
    // Measured: every one of them ends standing on the floor against the rib's face (x = 1664 - 6).
    expect(Object.fromEntries(JUMPS.map((kind) => [kind, runsOf(flights[kind], leaves)]))).toEqual({ tap: ['0-34 floor 1658'], top: ['0-34 floor 1658'], held: ['0-34 floor 1658'], again: ['0-34 floor 1658'] });
    // Stopped at the rib, he walks right under it (2 tiles of room), takes its two hilos and reaches the second ofrenda.
    const stopped = on[on.length - 1]!;
    const walk = play(stopped, 300, () => right, (r) => r.checkpointIndex === 1);
    const end = walk[walk.length - 1]!;
    expect(end.checkpointIndex).toBe(1);
    expect([took(end, 104, 12), took(end, 106, 12)]).toEqual([true, true]);
    expect(walk.every((s) => s.player.y >= Y(13) - CART.floorPx && s.phase === 'playing')).toBe(true);
    expect(end.player).toMatchObject({ grounded: true, y: Y(13) });
    expect(world.solidTile(105, 10) && !world.solidTile(105, 11) && !world.solidTile(105, 12)).toBe(true);
  }, 60_000);
});

describe('GDD-WLD-17 level 3-2 Ki and Sho on foot: carts are never required', () => {
  it('GDD-WLD-17 3-2 a walker who never boards a cart gets from the spawn to the ofrenda at 110 with every life', () => {
    const start = startRun(L);
    const states = drive(
      [
        leap(7 * TILE + 4), // over cart A, off the step
        runTo((r) => r.player.grounded && r.player.y === Y(15) && r.player.x >= (LEVEL_3_2_SUNKEN.col1 + 1) * TILE - 7), // down the ramp, into the sunken floor, to its far wall
        leap(0), // out of it
        leap(LEVEL_3_2_PIT_D.col0 * TILE - 12, (LEVEL_3_2_PIT_D.col1 + 2) * TILE), // over pit D, gliding until past its far bank's first tile
        runTo((r) => r.checkpointIndex === 1), // under the beam and the rib to the ofrenda
      ],
      start,
    );
    const end = states[states.length - 1]!;
    expect(end.checkpointIndex).toBe(1);
    expect(lostIn(states, start)).toBe(false);
    expect(states.every((s) => s.carts.every((c) => c.phase === 'waiting'))).toBe(true);
    // He walked down the ramp, through carts B to E at the ground's height, and under the beam and the rib.
    expect(states.some((s) => s.player.grounded && world.slopeAt(Math.floor(s.player.x / TILE), Math.ceil(s.player.y / TILE) - 1) !== null)).toBe(true);
    // Which hilos of columns 0 to 111 a walker takes here, and which he leaves (those a rider's head or a jump from a cart reaches).
    const ki = L.hilos!.map((h, i) => ({ h, i })).filter(({ h }) => h.col <= 111);
    // Measured: the start's two, the ramp's three, C's and D's landing hilos (64,11 and 86,11), D's arc over the pit (the glide takes them)
    // and the two under the rib.
    expect(ki.filter(({ i }) => end.hilosTaken[i]).map(({ h }) => `${h.col},${h.row}`)).toEqual(['4,7', '5,7', '31,8', '32,9', '33,10', '64,11', '81,9', '83,8', '86,11', '104,12', '106,12']);
    expect(ki.filter(({ i }) => !end.hilosTaken[i]).map(({ h }) => `${h.col},${h.row}`)).toEqual(['12,6', '15,6', '18,6', '26,6', '37,10', '40,10', '52,10', '73,10', '93,10', '59,9', '61,8', '97,8']);
  });

  it('GDD-WLD-17 3-2 the ramp is walked down and back up', () => {
    const down = play(at(mid(28), Y(9)), 200, () => right, (r) => r.player.x >= mid(36));
    expect(down[down.length - 1]!.player).toMatchObject({ grounded: true, y: Y(13) });
    const up = play(down[down.length - 1]!, 200, () => ({ move: -1, jumpHeld: false }), (r) => r.player.x <= mid(28));
    expect(up[up.length - 1]!.player).toMatchObject({ grounded: true, y: Y(9) });
    expect([...down, ...up].every((s) => s.player.grounded)).toBe(true);
  });

  it('GDD-WLD-03 3-2 pit D on foot: take-offs over the 3 tiles before its lip, 0.2 tile apart, standing and running, a tap, a full jump and the glide', () => {
    const lip = LEVEL_3_2_PIT_D.col0 * TILE;
    const bank = (LEVEL_3_2_PIT_D.col1 + 1) * TILE;
    // The headroom over its left bank: 8 tiles.
    expect(headroom(LEVEL_3_2_PIT_D.col0 - 1)).toBe(8);
    // Per take-off way: how many land on the far bank (and the columns they land in), lose the life in the pit, or land on the near side.
    const result: Record<string, { far: number; lost: number; near: number; farCols?: string }> = {};
    for (const vx of [0, 120]) {
      for (const kind of ['tap', 'top', 'held'] as const) {
        const count = { far: 0, lost: 0, near: 0 };
        const cols: number[] = [];
        for (let x = lip - 3 * TILE; x <= lip + 1e-6; x += 0.2 * TILE) {
          const f = fly(at(x, Y(13), vx), kind, 0);
          if (f.lost) count.lost++;
          else if (f.landed && f.landed.player.x + 6 > bank) {
            count.far++;
            cols.push(f.landed.player.x / TILE);
          } else count.near++;
        }
        const farCols = cols.length > 0 ? `${Math.min(...cols).toFixed(1)} to ${Math.max(...cols).toFixed(1)}` : undefined;
        result[`${vx === 0 ? 'standing' : 'running'} ${kind}`] = farCols ? { ...count, farCols } : count;
      }
    }
    // Measured: only the glide crosses it from every take-off, landing in columns 84.8 to 89 (his middle; at 84.8 his box is on the bank's
    // edge); the plain full jump from none of them, standing or running; a tap falls short or in.
    expect(result).toEqual({
      'standing tap': { far: 0, lost: 6, near: 10 },
      'standing top': { far: 0, lost: 16, near: 0 },
      'standing held': { far: 16, lost: 0, near: 0, farCols: '84.8 to 87.8' },
      'running tap': { far: 0, lost: 9, near: 7 },
      'running top': { far: 0, lost: 16, near: 0 },
      'running held': { far: 16, lost: 0, near: 0, farCols: '85.5 to 89.0' },
    });
  }, 30_000);
});

describe('GDD-WLD-15 level 3-2 the plain jump from a cart, measured for the report', () => {
  it('GDD-WLD-15 3-2 a jump from a cart at 150 px/s: back in the cart, and down on the ground at the rail\'s height, under 7 and 8 tiles of roof', () => {
    // Back in the cart: from cart A (7 tiles of roof over its rail's ground) and cart C (8 tiles), taken 2 steps into the ride, so that the
    // glide comes down while the cart still rolls.
    const a = rideA(idle);
    const rideAStates = a.slice(a.findIndex((s) => s.carts[cartOf('A')]!.phase === 'rolling'));
    const c = rideFrom(mid(44), Y(13), 'C', 0);
    // Measured: GDD-WLD-15's 85.0 px in 33 steps and 170.0 px in 67, the same under either roof; a tap 42.5 px in 16 steps.
    const rolling = { tap: { cart: 'A', phase: 'rolling', px: 42.5, steps: 16 }, top: { cart: 'A', phase: 'rolling', px: 85, steps: 33 }, held: { cart: 'A', phase: 'rolling', px: 170, steps: 67 } };
    expect({ A: backInCart(rideAStates), C: backInCart(c) }).toEqual({
      A: rolling,
      C: { tap: { ...rolling.tap, cart: 'C' }, top: { ...rolling.top, cart: 'C' }, held: { ...rolling.held, cart: 'C' } },
    });
    // Down on the far bank past rail C's end (the ground at the rail's height): each jump's px and steps, for every take-off that lands there.
    const { flights, as } = brokenSweep('C', mid(44), Y(13));
    const onBank = Object.fromEntries((['tap', 'top', 'held'] as const).map((kind) => {
      const fs = flights[kind].filter((f) => as(f) === 'bank' && f.k < 84);
      return [kind, [...new Set(fs.map((f) => `${Math.round((f.landed!.player.x - f.x) * 10) / 10} px ${airSteps(f)} steps`))]];
    }));
    // Measured: 87.6 px in 34 steps (GDD-WLD-15's scratch figure: 86.1 px), the glide 187.6 px in 74 steps (187.1 px), a tap 47.6 px in 18.
    expect(onBank).toEqual({ tap: ['47.6 px 18 steps'], top: ['87.6 px 34 steps'], held: ['187.6 px 74 steps'] });
  }, 30_000);
});

describe('GDD-WLD-17 level 3-2 Ten: the piñata, the seat and the pen', () => {
  it('GDD-PWR-05 3-2 the piñata in Base: where its taco walks, and whether it comes back to a Poncho waiting under it', () => {
    // From every x under it from which a plain full jump bumps it, 0.2 tile apart, then nothing held until the taco is his.
    const out = apart(PINATA_COL * TILE - 5.6, (PINATA_COL + 1) * TILE + 5).map((x) => {
      const start = at(x, Y(13));
      const states = play(start, 600, jumper('top', 0), (r) => r.power === 'taco' || r.phase !== 'playing');
      const opened = states.findIndex((s) => s.pinatasOpen[0]);
      const items = states.map((s) => s.items[0]).filter((i) => i !== undefined);
      const got = states.findIndex((s) => s.power === 'taco');
      const floor = items.find((i) => i.y === Y(13));
      return { x, opened, got, lost: lostIn(states, start), first: items[0] && { x: items[0].x, y: items[0].y, kind: items[0].kind }, floorCol: floor && Math.floor(floor.x / TILE), farthest: items.length > 0 ? Math.max(...items.map((i) => i.x)) : undefined };
    });
    // Measured with the piñata at 113 (the designer's change; at 114 the taco fell onto the seat and walked into the pen, never his): the
    // jump bumps it from x 1808.8 to 1824.8; the taco comes out on its top (1816, 144), walks right, drops to the floor at column 115,
    // turns at the seat (x 1850 at the farthest) and comes back: his 79 to 98 steps after the bump from under it (33 from its right
    // edge, where it lands on him), with no life lost.
    const bumps = out.filter((o) => o.opened >= 0);
    expect({ bumps: bumps.map((o) => o.x.toFixed(1)), runs: [...new Set(bumps.map((o) => `opened ${o.opened}, his ${o.got}, lost ${o.lost}, first ${o.first?.kind} at ${o.first?.x},${o.first?.y}, on the floor at ${o.floorCol}, farthest ${o.farthest?.toFixed(1)}`))] }).toEqual({
      bumps: ['1808.8', '1812.0', '1815.2', '1818.4', '1821.6', '1824.8'],
      runs: [
        'opened 2, his 98, lost false, first taco at 1816,144, on the floor at 115, farthest 1850.0',
        'opened 2, his 93, lost false, first taco at 1816,144, on the floor at 115, farthest 1850.0',
        'opened 2, his 89, lost false, first taco at 1816,144, on the floor at 115, farthest 1850.0',
        'opened 2, his 84, lost false, first taco at 1816,144, on the floor at 115, farthest 1850.0',
        'opened 2, his 79, lost false, first taco at 1816,144, on the floor at 115, farthest 1850.0',
        'opened 2, his 33, lost false, first taco at 1816,144, on the floor at undefined, farthest 1836.0',
      ],
    });
  }, 30_000);

  it('GDD-PWR-05 3-2 the piñata in Taco and in Fuego: the chile rests on its top; the hops from the seat and the jumps from the floor that take it', () => {
    const result: Record<string, string[]> = {};
    for (const power of ['taco', 'fuego'] as const) {
      const start = { ...at(mid(PINATA_COL), Y(13)), power };
      const bumped = play(start, 120, jumper('top', 0), (r, i) => i > 5 && r.player.grounded);
      const rest = bumped[bumped.length - 1]!;
      expect(rest.items.map((i) => ({ kind: i.kind, x: i.x, y: i.y })), power).toEqual([{ kind: 'chile', x: mid(PINATA_COL), y: Y(9) }]);
      // From the seat (left or nothing held) and from the floor around the piñata, two tiles either side (left, right or nothing held).
      const places: readonly [string, number, readonly (-1 | 0 | 1)[], readonly number[]][] = [
        ['seat', SEAT_TOP, [-1, 0], apart(LEVEL_3_2_SEAT.col0 * TILE - 4.8, SEAT_EDGE + 4.8)],
        ['floor', Y(13), [-1, 0, 1], apart((PINATA_COL - 2) * TILE, (PINATA_COL + 3) * TILE)],
      ];
      for (const [where, y, moves, xs] of places) {
        for (const move of moves) {
          for (const kind of ['tap', 'top', 'held'] as const) {
            const taken: string[] = [];
            for (const x of xs) {
              const from: RunState = { ...rest, player: standing(x, y) };
              const input = jumper(kind, 0);
              const states = play(from, 120, (r, i) => ({ ...input(r, i), move }), (r, i) => (i > 3 && r.player.grounded) || r.items.length === 0);
              const end = states[states.length - 1]!;
              if (end.items.length === 0 && !lostIn(states, from)) taken.push(x.toFixed(1));
            }
            result[`${power} ${where} ${move < 0 ? 'left' : move > 0 ? 'right' : 'none'} ${kind}`] = taken;
          }
        }
      }
    }
    // Measured with the piñata at 113: the chile rests on its top (1816, 144); a hop left from the seat takes it, the plain jump from 7 of
    // the seat's 14 places (x 1851.2 to 1870.4), the glide from 10 (1857.6 to 1886.4); a tap never, nor any jump with nothing held, nor
    // any jump from the floor around it. In Taco he is in Fuego after. No life is lost.
    expect(result).toEqual({
      'taco seat left tap': [],
      'taco seat left top': ['1851.2', '1854.4', '1857.6', '1860.8', '1864.0', '1867.2', '1870.4'],
      'taco seat left held': ['1857.6', '1860.8', '1864.0', '1867.2', '1870.4', '1873.6', '1876.8', '1880.0', '1883.2', '1886.4'],
      'taco seat none tap': [],
      'taco seat none top': [],
      'taco seat none held': [],
      'taco floor left tap': [],
      'taco floor left top': [],
      'taco floor left held': [],
      'taco floor none tap': [],
      'taco floor none top': [],
      'taco floor none held': [],
      'taco floor right tap': [],
      'taco floor right top': [],
      'taco floor right held': [],
      'fuego seat left tap': [],
      'fuego seat left top': ['1851.2', '1854.4', '1857.6', '1860.8', '1864.0', '1867.2', '1870.4'],
      'fuego seat left held': ['1857.6', '1860.8', '1864.0', '1867.2', '1870.4', '1873.6', '1876.8', '1880.0', '1883.2', '1886.4'],
      'fuego seat none tap': [],
      'fuego seat none top': [],
      'fuego seat none held': [],
      'fuego floor left tap': [],
      'fuego floor left top': [],
      'fuego floor left held': [],
      'fuego floor none tap': [],
      'fuego floor none top': [],
      'fuego floor none held': [],
      'fuego floor right tap': [],
      'fuego floor right top': [],
      'fuego floor right held': [],
    });
  }, 60_000);

  it('GDD-ENM-04 3-2 standing anywhere on the seat he never startles the pen Armadillo, through its whole walk; its walk across the pen and its period', () => {
    const period = periodOf(PEN_BALL);
    const xs = enemiesAt(0) && Array.from({ length: period }, (_, t) => enemiesAt(t)[PEN_BALL]!.x);
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    // Measured: its period 962 steps, 481 from its left end (x 1896) to its right end (2056), as before its start moved to 126.
    expect({ period, across: Math.abs(xs.indexOf(hi) - xs.indexOf(lo)), lo, hi }).toEqual({
      period: 962,
      across: 481,
      lo: 1896,
      hi: 2056,
    });
    for (const x of apart(LEVEL_3_2_SEAT.col0 * TILE - 4.8, SEAT_EDGE + 4.8)) {
      const states = play(at(x, SEAT_TOP), period + 10, () => idle);
      expect(states.some((s) => ball(s).shell!.phase !== 'walk'), `${x}`).toBe(false);
    }
  }, 30_000);
});

describe('GDD-WLD-17 level 3-2 Ten: out of the pen and the hops', () => {
  it('GDD-WLD-17 3-2 the far wall from the pen floor over the dazed ball: take-offs over its last 3 tiles, a plain jump and the glide under the 6-tile roof', () => {
    const wall = LEVEL_3_2_FAR_WALL.col0 * TILE;
    const xs = apart(wall - 3 * TILE, wall - 6);
    const out = takeOffs((x, vx) => dazedAtWall(at(x, Y(LEVEL_3_2_PEN.row), vx)), xs, ['top', 'held']);
    // Measured under the pen's roof one row higher (C2, under 5 tiles: the plain jump only from 2032 standing, 2019.2 running): right held,
    // the plain jump now reaches the far wall from every take-off; the glide carries most of them on over the wall into the first hop's
    // sunken floor or to the pillar. With nothing held he comes down in the pen, or running on the wall.
    expect(out).toEqual({
      'standing right top': ['2016.0-2057.6 far wall'],
      'standing right held': ['2016.0-2028.8 far wall', '2032.0-2051.2 hop floor', '2054.4 pillar', '2057.6 hop floor'],
      'standing none top': ['2016.0-2057.6 pen'],
      'standing none held': ['2016.0-2057.6 pen'],
      'running right top': ['2016.0-2057.6 far wall'],
      'running right held': ['2016.0-2019.2 far wall', '2022.4-2038.4 hop floor', '2041.6-2044.8 pillar', '2048.0-2057.6 hop floor'],
      'running none top': ['2016.0-2035.2 pen', '2038.4-2048.0 far wall', '2051.2-2057.6 pen'],
      'running none held': ['2016.0-2035.2 pen', '2038.4-2048.0 far wall', '2051.2-2057.6 pen'],
    });
  }, 60_000);

  it('GDD-ENM-04 3-2 the dazed ball against the far wall: a stomp and the claw each defeat it', () => {
    const wall = LEVEL_3_2_FAR_WALL.col0 * TILE;
    // The claw, standing 20 px before its middle and facing it.
    const clawed = play(dazedAtWall(at(wall - 8 - 20, Y(LEVEL_3_2_PEN.row))), 30, (_r, i) => ({ move: 0, jumpHeld: false, claw: i === 0 }));
    expect(ball(clawed[clawed.length - 1]!).alive).toBe(false);
    // A tap or a plain full jump toward it, right held, from 12 to 60 px before its middle, every 4 px: those that come down on it stomp it.
    const stomps: string[] = [];
    for (const kind of ['tap', 'top'] as const) {
      for (let d = 12; d <= 60; d += 4) {
        // (50 steps: within its 60 dazed ones, before it gets up.)
        const stomped = play(dazedAtWall(at(wall - 8 - d, Y(LEVEL_3_2_PEN.row))), 50, jumper(kind, 1), (r) => !ball(r).alive);
        expect(lostIn(stomped, at(0, 0)), `${kind} ${d}`).toBe(false);
        if (stomped.some((st) => st.stomped) && !ball(stomped[stomped.length - 1]!).alive) stomps.push(`${kind} ${d}`);
      }
    }
    expect(lostIn(clawed, at(0, 0))).toBe(false);
    // Measured: a tap from 12 to 28 px before its middle, a plain jump from 44 to 60 px.
    expect(stomps).toEqual(['tap 12', 'tap 16', 'tap 20', 'tap 24', 'tap 28', 'top 44', 'top 48', 'top 52', 'top 56', 'top 60']);
  });

  it('GDD-WLD-17 3-2 the hops under the 4-tile roof: from the far wall to the pillar and from the pillar to the island, standing and running', () => {
    const hop1 = takeOffs((x, vx) => at(x, Y(11), vx), apart(LEVEL_3_2_FAR_WALL.col0 * TILE - 5.6, LEVEL_3_2_HOP1_FLOOR.col0 * TILE), ['tap', 'top', 'held']);
    const hop2 = takeOffs((x, vx) => at(x, Y(11), vx), apart(LEVEL_3_2_PITS.hop2.col0 * TILE - 3 * TILE, LEVEL_3_2_PITS.hop2.col0 * TILE), ['tap', 'top', 'held']);
    // The first hop is a sunken floor now: no take-off over it can cost a life.
    for (const [name, lines] of Object.entries(hop1)) expect(lines.filter((l) => l.endsWith('lost')), name).toEqual([]);
    // Under this roof (4 tiles) the farthest a held glide carries, take-off to landing, and the hilos (132, 9) and (138, 9): how many of
    // each sweep's flights take them.
    const glides: number[] = [];
    const hilos: Record<string, number> = {};
    for (const [name, xs, col] of [['hop1', apart(LEVEL_3_2_FAR_WALL.col0 * TILE - 5.6, LEVEL_3_2_HOP1_FLOOR.col0 * TILE), 132], ['hop2', apart(LEVEL_3_2_PITS.hop2.col0 * TILE - 3 * TILE, LEVEL_3_2_PITS.hop2.col0 * TILE), 138]] as const) {
      for (const vx of [0, 120]) {
        for (const kind of ['tap', 'top', 'held'] as const) {
          const flights = xs.map((x, k) => fly(at(x, Y(11), vx), kind, k, 1));
          if (kind === 'held') for (const f of flights) if (f.landed) glides.push(f.landed.player.x - f.x);
          hilos[`${name} ${vx === 0 ? 'standing' : 'running'} ${kind}`] = flights.filter((f) => took(f.states[f.states.length - 1]!, col, 9)).length;
        }
      }
    }
    const got = { hop1, hop2, farthest: Math.round((Math.max(...glides) / TILE) * 100) / 100, hilos };
    // Measured. The first hop: every jump that fell into its pit (C2) now comes down on its sunken floor, and the glide right held lands on
    // the pillar from every take-off but standing at 2058.4; it takes the hilo (132, 9) from all 12. The second hop as in C2: the plain
    // jump reaches the island only running from its last 9.6 px, a glide from the pillar's first places (2144 to 2156.8 standing) falls
    // short into its pit. The farthest glide under this roof: 4.8 tiles.
    expect(got).toEqual({
      hop1: {
        'standing right tap': ['2058.4-2077.6 far wall', '2080.8-2093.6 hop floor'],
        'standing right top': ['2058.4-2074.4 far wall', '2077.6-2093.6 hop floor'],
        'standing right held': ['2058.4 hop floor', '2061.6-2093.6 pillar'],
        'standing none tap': ['2058.4-2093.6 far wall'],
        'standing none top': ['2058.4-2093.6 far wall'],
        'standing none held': ['2058.4-2093.6 far wall'],
        'running right tap': ['2058.4-2064.8 far wall', '2068.0-2087.2 hop floor', '2090.4-2093.6 pillar'],
        'running right top': ['2058.4-2064.8 far wall', '2068.0-2084.0 hop floor', '2087.2-2093.6 pillar'],
        'running right held': ['2058.4-2093.6 pillar'],
        'running none tap': ['2058.4-2080.8 far wall', '2084.0-2093.6 hop floor'],
        'running none top': ['2058.4-2080.8 far wall', '2084.0-2093.6 hop floor'],
        'running none held': ['2058.4-2080.8 far wall', '2084.0-2093.6 hop floor'],
      },
      hop2: {
        'standing right tap': ['2144.0-2172.8 pillar', '2176.0-2192.0 lost'],
        'standing right top': ['2144.0-2172.8 pillar', '2176.0-2192.0 lost'],
        'standing right held': ['2144.0-2156.8 lost', '2160.0-2185.6 island', '2188.8-2192.0 cart F'],
        'standing none tap': ['2144.0-2192.0 pillar'],
        'standing none top': ['2144.0-2192.0 pillar'],
        'standing none held': ['2144.0-2192.0 pillar'],
        'running right tap': ['2144.0-2163.2 pillar', '2166.4-2182.4 lost', '2185.6-2192.0 island'],
        'running right top': ['2144.0-2160.0 pillar', '2163.2-2179.2 lost', '2182.4-2192.0 island'],
        'running right held': ['2144.0 lost', '2147.2-2176.0 island', '2179.2-2192.0 cart F'],
        'running none tap': ['2144.0-2179.2 pillar', '2182.4-2192.0 lost'],
        'running none top': ['2144.0-2176.0 pillar', '2179.2-2192.0 lost'],
        'running none held': ['2144.0-2176.0 pillar', '2179.2-2192.0 lost'],
      },
      farthest: 4.8,
      hilos: {
        'hop1 standing tap': 3,
        'hop1 standing top': 4,
        'hop1 standing held': 12,
        'hop1 running tap': 7,
        'hop1 running top': 7,
        'hop1 running held': 12,
        'hop2 standing tap': 4,
        'hop2 standing top': 4,
        'hop2 standing held': 16,
        'hop2 running tap': 7,
        'hop2 running top': 8,
        'hop2 running held': 16,
      },
    });
  }, 60_000);
});

describe('GDD-WLD-17 level 3-2 Ten: rail F, the jump to the ledge and staying in', () => {
  it('GDD-WLD-15 3-2 rail F: a jump at every step from the trestle to the torn end and the coyote steps, four ways, right held and nothing held: the ledge, the cart, the ramp, the cutting, the spikes', () => {
    // The ride with nothing held from a hop in at the enemies' start; its states from the step the cart's middle is over the trestle.
    const ride = rideF(0, () => idle, (r) => r.carts[cartOf('F')]!.phase === 'falling');
    const leave = ride.length - 1;
    const more = play(ride[leave]!, 6, () => idle);
    const from = ride.findIndex((st) => st.carts[cartOf('F')]!.phase === 'rolling' && middleOf(st, 'F') >= LEVEL_3_2_PITS.F.col0 * TILE);
    const rides = [...ride.slice(from, leave), ride[leave]!, ...more.slice(0, 5)];
    const as = ledgeF;
    const out: Record<string, unknown> = {};
    for (const move of [1, 0] as const) {
      const flights = sweep(rides, move);
      for (const kind of JUMPS) {
        const name = `${move ? 'right' : 'none'} ${kind}`;
        out[name] = runsOf(flights[kind], as);
        const ledge = flights[kind].filter((f) => as(f) === 'ledge');
        out[`${name} ledge`] = ledge.length === 0 ? 'none' : `${ledge.length}: x ${ledge[0]!.x.toFixed(1)} to ${ledge[ledge.length - 1]!.x.toFixed(1)}`;
        // No hole: every take-off between the ledge window's first and last lands on the ledge.
        if (ledge.length > 0) expect(flights[kind].filter((f) => f.k > ledge[0]!.k && f.k < ledge[ledge.length - 1]!.k && as(f) !== 'ledge').map((f) => f.k), name).toEqual([]);
        out[`${name} hilos`] = runsOf(flights[kind], (f) => [164, 166, 168, 171].filter((c, i) => took(f.landed ?? f.states[f.states.length - 1]!, c, [8, 6, 7, 9][i]!)).join(' ') || 'none');
      }
    }
    // Measured from the ride at the enemies' start: take-offs counted from the step the cart's middle is over the trestle (the ramp's top is
    // at 103, the torn end at 209, the coyote steps 209 to 214). The plain jump lands on the ledge from x = 2611 to 2681.3 with nothing
    // held, to 2698.3 with right held (GDD: 2612 to 2640); the glide from x = 2511 (GDD: 2511) to the same ends. Taken on the ramp's foot
    // (162), every jump but the second press meets the ledge's underside and is carried on with the cart onto the spikes: a life. A tap
    // never reaches the ledge. After the torn end (200 on) every jump comes down in the hollow: a life.
    expect({ from, leave, rides: rides.length, out }).toEqual({
      from: 51,
      leave: 260,
      rides: 215,
      out: {
        'right tap': ['0-149 cart F', '150-161 ramp', '162 lost', '163-199 cart F', '200-214 lost'],
        'right tap ledge': 'none',
        'right tap hilos': ['0-109 none', '110-214 164'],
        'right top': ['0-121 cart F', '122-161 ledge', '162 lost', '163-199 cart F', '200-214 lost'],
        'right top ledge': '40: x 2611.0 to 2698.3',
        'right top hilos': [
          '0-92 none',
          '93-107 164',
          '108-111 none',
          '112-120 166',
          '121-140 164 166 168',
          '141-148 164 168',
          '149-151 164 168 171',
          '152-153 164 171',
          '154-214 164',
        ],
        'right held': ['0-65 cart F', '66-81 floor 15', '82-161 ledge', '162 lost', '163-197 cart F', '198-214 lost'],
        'right held ledge': '80: x 2511.0 to 2698.3',
        'right held hilos': [
          '0-58 none',
          '59-94 164',
          '95-96 164 168',
          '97-120 166 168 171',
          '121-128 164 166 168 171',
          '129-133 164 166 168',
          '134-140 164 166 168 171',
          '141-151 164 168 171',
          '152-155 164 171',
          '156-214 164',
        ],
        'right again': ['0-102 cart F', '103-121 floor 15', '122-161 ledge', '162-199 cart F', '200-214 lost'],
        'right again ledge': '40: x 2611.0 to 2698.3',
        'right again hilos': [
          '0-92 none',
          '93-107 164',
          '108-111 none',
          '112-120 166',
          '121-140 164 166 168',
          '141-148 164 168',
          '149-151 164 168 171',
          '152-153 164 171',
          '154-214 164',
        ],
        'none tap': ['0-149 cart F', '150-161 ramp', '162 lost', '163-199 cart F', '200-214 lost'],
        'none tap ledge': 'none',
        'none tap hilos': ['0-109 none', '110-214 164'],
        'none top': ['0-121 cart F', '122-153 ledge', '154-161 ramp', '162 lost', '163-199 cart F', '200-214 lost'],
        'none top ledge': '32: x 2611.0 to 2681.3',
        'none top hilos': [
          '0-92 none',
          '93-107 164',
          '108-111 none',
          '112-120 166',
          '121 164 166',
          '122-140 164 166 168',
          '141-148 164 168',
          '149-151 164 168 171',
          '152-153 164 171',
          '154-214 164',
        ],
        'none held': ['0-65 cart F', '66-81 ramp', '82-153 ledge', '154-161 ramp', '162 lost', '163-197 cart F', '198-214 lost'],
        'none held ledge': '72: x 2511.0 to 2681.3',
        'none held hilos': [
          '0-58 none',
          '59-95 164',
          '96 164 168',
          '97-120 166 168 171',
          '121-128 164 166 168 171',
          '129-133 164 166 168',
          '134-140 164 166 168 171',
          '141-151 164 168 171',
          '152-153 164 171',
          '154-214 164',
        ],
        'none again': ['0-102 cart F', '103-121 ramp', '122-153 ledge', '154-161 ramp', '162-199 cart F', '200-214 lost'],
        'none again ledge': '32: x 2611.0 to 2681.3',
        'none again hilos': [
          '0-92 none',
          '93-107 164',
          '108-111 none',
          '112-120 166',
          '121 164 166',
          '122-140 164 166 168',
          '141-148 164 168',
          '149-151 164 168 171',
          '152-153 164 171',
          '154-214 164',
        ],
      },
    });
  }, 120_000);
});

describe('GDD-WLD-17 level 3-2 Ten: out of the first hop', () => {
  it('GDD-WLD-17 3-2 out of the first hop sunken floor, over its 2-tile walls to the far wall and to the pillar, a plain jump and the glide', () => {
    const out: Record<string, string> = {};
    for (const [dir, wall] of [[-1, LEVEL_3_2_HOP1_FLOOR.col0 * TILE + 6], [1, (LEVEL_3_2_HOP1_FLOOR.col1 + 1) * TILE - 6]] as const) {
      for (const start of [LEVEL_3_2_HOP1_FLOOR.col0, LEVEL_3_2_HOP1_FLOOR.col1]) {
        for (const hold of ['top', 'held'] as const) {
          const run = bot([runUntil(dir, (r) => Math.abs(r.player.x - wall) < 1), jumpAt(wall, hold === 'top' ? 'top' : wall + dir * 3 * TILE, dir)], at(mid(start), Y(LEVEL_3_2_HOP1_FLOOR.row)), 300);
          expect(run.lost, `${dir} ${hold}`).toEqual([]);
          const f = { lost: false, landed: run.end, states: run.states, k: 0, x: 0 };
          out[`${dir < 0 ? 'left' : 'right'} from ${start} ${hold}`] = tenLanding(f);
        }
      }
    }
    // Measured: out to the right onto the pillar by either jump; to the left the plain jump lands on the far wall and the glide carries him
    // on over it into the pen. No life lost (asserted).
    expect(out).toEqual({
      'left from 131 top': 'far wall',
      'left from 131 held': 'pen',
      'left from 132 top': 'far wall',
      'left from 132 held': 'pen',
      'right from 131 top': 'pillar',
      'right from 131 held': 'pillar',
      'right from 132 top': 'pillar',
      'right from 132 held': 'pillar',
    });
  });
});

describe('GDD-WLD-17 level 3-2 Ten: the replays', () => {
  it('GDD-WLD-17 3-2 a fall into the second hop pit respawns at the ofrenda at 110, and the walk from there to the pillar again is the pen again', () => {
    const to = TEN_TO_ISLAND().slice(0, 8);
    const there = bot(to, at(OFRENDA_2.x, OFRENDA_2.y));
    expect(there.lost).toEqual([]);
    expect(standsOnFloor(11, LEVEL_3_2_PILLAR.col0, LEVEL_3_2_PILLAR.col1)(there.end)).toBe(true);
    // Off the pillar into the second hop's pit, then the same way again from the respawn.
    const fall = bot([runUntil(1, (r) => r.player.y > Y(12)), ...TEN_TO_ISLAND().slice(0, 8)], there.end);
    expect(fall.lost.length).toBe(1);
    const back = fall.states.findIndex((st, i) => i > fall.lost[0]! && st.phase === 'playing');
    expect(fall.states[back]!.player).toMatchObject({ x: OFRENDA_2.x, y: OFRENDA_2.y });
    expect(standsOnFloor(11, LEVEL_3_2_PILLAR.col0, LEVEL_3_2_PILLAR.col1)(fall.end)).toBe(true);
    // The replay: steps from the respawn to standing on the pillar again (the first walk: from the ofrenda). Measured: 495 steps (8.3 s).
    expect({ first: there.states.length, replay: fall.states.length - back }).toEqual({
      first: 495,
      replay: 495,
    });
  }, 60_000);
});

describe('GDD-WLD-17 level 3-2 Ten: staying in F, and out of the cutting', () => {
  it('GDD-WLD-15 3-2 staying in F he falls onto the spikes: one life, a respawn at the ofrenda at 110, and Ten again by a bot', () => {
    const start = { ...atT(mid(LEVEL_3_2_ISLAND.col0), Y(11), 0), checkpoint: OFRENDA_2, checkpointIndex: 1 };
    const ride = bot([hopInto('F'), waitFor((r) => r.lives.lives < start.lives.lives), ...TEN()], start, 3000);
    expect(ride.lost.length).toBe(1);
    const fell = ride.states[ride.lost[0]!]!;
    expect(fell.player.x).toBeGreaterThan(LAST_TILE_F);
    const back = ride.states.findIndex((st, i) => i > ride.lost[0]! && st.phase === 'playing');
    expect(ride.states[back]!.player).toMatchObject({ x: OFRENDA_2.x, y: OFRENDA_2.y });
    expect(ride.states[back]!.carts.every((c) => c.phase === 'waiting')).toBe(true);
    expect(inCart(ride.end, 'F')).toBe(true);
    // Measured: the life is lost 236 steps after the landing in F (3.9 s); Ten again, from the respawn to riding F, is 563 steps (9.4 s;
    // C2, before the pen's changes: 579).
    expect({ lostAfter: ride.lost[0]! - ride.marks[0]!, ten: ride.states.length - back }).toEqual({
      lostAfter: 236,
      ten: 563,
    });
  }, 60_000);

  it('GDD-WLD-15 3-2 staying in F with a taco: the spikes take the taco and no life, and he hops out to the left', () => {
    const start = { ...atT(mid(LEVEL_3_2_ISLAND.col0), Y(11), 0), power: 'taco' as const };
    const ride = bot([hopInto('F'), waitFor((r) => r.power === 'base'), waitFor((r) => r.player.grounded), jumpAt(Infinity, 'top', -1), runUntil(-1, (r) => r.player.x < 172 * TILE)], start, 3000);
    expect(ride.lost).toEqual([]);
    expect(ride.end.power).toBe('base');
    expect(ride.end.player).toMatchObject({ grounded: true, y: Y(15) });
    // Measured: where he comes down in the hollow and the steps from the spikes' hit to standing on the cutting's floor.
    const hit = ride.marks[1]!;
    const out = ride.states.findIndex((st, i) => i > hit && st.player.grounded && st.player.y === Y(15));
    // Measured: he comes down in the hollow at x 2833.4 (column 177); a plain jump left lands him on the cutting's floor 16 steps after the
    // spikes' hit, with 103 of his 120 steps of invulnerability left.
    expect({ landed: Math.round(ride.states[ride.marks[2]!]!.player.x * 10) / 10, out: out - hit, invulnerableLeft: ride.states[out]!.invulnerable }).toEqual({ landed: 2833.4, out: 16, invulnerableLeft: 103 });
  }, 60_000);

  it("GDD-WLD-17 3-2 from F's cutting he walks back up the ramp, and the 4-tile jump from its top lands on the ledge or back on the ramp, no life lost", () => {
    const up = play(at(mid(172), Y(15)), 200, () => ({ move: -1, jumpHeld: false }), (r) => r.player.x <= 163 * TILE);
    expect(up[up.length - 1]!.player).toMatchObject({ grounded: true, y: Y(11) });
    expect(lostIn(up, at(0, 0))).toBe(false);
    const xs = apart(163 * TILE, 165 * TILE);
    const out = takeOffs((x, vx) => at(x, Y(11), vx), xs, ['top', 'held'], (f) => upperLanding(f, LEDGE_F));
    for (const lines of Object.values(out)) expect(lines.filter((l) => l.endsWith('lost'))).toEqual([]);
    // Measured: the glide with right held lands on the ledge from every take-off; a plain jump only running and from 2630.4 on (standing it
    // comes down on the ramp); with nothing held he lands back on the gallery's floor or on the ramp. No miss costs a life.
    expect(out).toEqual({
      'standing right top': ['2608.0-2640.0 ramp'],
      'standing right held': ['2608.0-2640.0 ledge'],
      'standing none top': ['2608.0-2640.0 floor 11'],
      'standing none held': ['2608.0-2640.0 floor 11'],
      'running right top': ['2608.0-2627.2 ramp', '2630.4-2640.0 ledge'],
      'running right held': ['2608.0-2640.0 ledge'],
      'running none top': ['2608.0-2617.6 floor 11', '2620.8-2640.0 ramp'],
      'running none held': ['2608.0-2617.6 floor 11', '2620.8-2640.0 ramp'],
    });
  }, 60_000);
});

describe('GDD-WLD-17 level 3-2 Ketsu: the three carts', () => {
  it('GDD-ENM-02 3-2 K1 runs down its Alacrán at every start time of its walk', () => {
    const period = periodOf(K1_ALACRAN);
    const down: number[] = [];
    for (let t = 0; t < period; t++) {
      const ride = rideK1(t);
      const k = ride.findIndex((st) => !st.enemies[K1_ALACRAN]!.alive);
      expect(k, `${t}`).toBeGreaterThan(0);
      expect(ride[k]!.carts[cartOf('K1')]!.phase, `${t}`).toBe('rolling');
      down.push(k);
    }
    // Measured: its period is 266 steps; at every one of them the cart runs it down, 33 to 59 steps after he lands in K1.
    expect({ period, first: Math.min(...down), last: Math.max(...down) }).toEqual({ period: 266, first: 33, last: 59 });
  }, 120_000);

  it('GDD-WLD-15 3-2 K1 to K2 and K2 to K3: the jump sweeps over every step and the coyote steps, four ways, right held and nothing held', () => {
    const k1 = brokenRides(rideK1(0), 'K1');
    const out: Record<string, unknown> = {};
    const arrivals: RunState[] = [];
    const checkpoints = new Set<number>();
    for (const move of [1, 0] as const) {
      const flights = sweep(k1, move);
      for (const kind of JUMPS) {
        out[`K1 ${move ? 'right' : 'none'} ${kind}`] = runsOf(flights[kind], ketsu);
        const inK2 = flights[kind].filter((f) => ketsu(f) === 'cart K2');
        out[`K1 ${move ? 'right' : 'none'} ${kind} into K2`] = windowOf(flights[kind], (f) => ketsu(f) === 'cart K2', endOf('K1'));
        for (const f of inK2) {
          arrivals.push(f.landed!);
          checkpoints.add(f.landed!.checkpointIndex);
        }
        const lost = flights[kind].filter((f) => f.lost);
        if (inK2.length > 0) expect(lost.every((f) => f.k < inK2[0]!.k || f.k > inK2[inK2.length - 1]!.k), `K1 ${kind}`).toBe(true);
      }
    }
    // K2: the ride of the first plain arrival, with a plain jump over its beam in the window, swept from every step in the cart.
    const first = arrivals[0]!;
    const k2 = play(first, 300, () => idle, (r) => r.carts[cartOf('K2')]!.phase === 'falling' && r.carts[cartOf('K2')]!.m >= railLength(railOf('K2')) + 15);
    const beamFace = LEVEL_3_2_BEAMS.K2.col * TILE;
    const hopAt = [first, ...k2].findIndex((st, i) => inCart(st, 'K2') && (() => { const f = fly(st, 'top', i, 0); return f.landed !== undefined && inCart(f.landed, 'K2') && f.landed.player.x - 6 > beamFace + TILE; })());
    const hop = fly([first, ...k2][hopAt]!, 'top', hopAt, 0);
    const after = [hop.landed!, ...play(hop.landed!, 300, () => idle, (r) => r.carts[cartOf('K2')]!.phase === 'falling' && r.carts[cartOf('K2')]!.m >= railLength(railOf('K2')) + 15)];
    const k2rides = [...[first, ...k2].slice(0, hopAt + 1).filter((st) => inCart(st, 'K2')), ...brokenRides(after, 'K2')];
    for (const move of [1, 0] as const) {
      const flights = sweep(k2rides, move);
      for (const kind of JUMPS) {
        out[`K2 ${move ? 'right' : 'none'} ${kind}`] = runsOf(flights[kind], ketsu);
        out[`K2 ${move ? 'right' : 'none'} ${kind} into K3`] = (() => {
          const w = flights[kind].filter((f) => ketsu(f) === 'cart K3');
          return w.length === 0 ? 'none' : `${w.length}: x ${w[0]!.x.toFixed(1)} to ${w[w.length - 1]!.x.toFixed(1)}`;
        })();
        for (const f of flights[kind].filter((g) => ketsu(g) === 'cart K3')) checkpoints.add(f.landed!.checkpointIndex);
      }
    }
    // Measured. K1 to K2: the plain jump from 43 px before the end to 0.5 px (18 take-offs; GDD: "from its last tiles"), the glide from
    // 128 to 85.5 px; earlier jumps fall into the pit 196 to 200 and later ones come down past K2 on the floor. Every landing in K2 or K3
    // has the ofrenda at 181 as its checkpoint (2). K2, its beam hopped at its ride's step 27: into K3 by the plain jump from x = 3462
    // (GDD: 3460) to 3499.5, the last coyote presses included, and by the glide from x = 3384.5 to 3419.5 (GDD: from 3359); a plain jump
    // taken between the beam and x = 3462 falls into the pit 216 to 221.
    expect({ hopAt, checkpoints: [...checkpoints], out }).toEqual({
      hopAt: 27,
      checkpoints: [2],
      out: {
        'K1 right tap': ['0-66 cart K1', '67-80 lost', '81-82 floor 11', '83-88 cart K2', '89 lost'],
        'K1 right tap into K2': {
          first: 83,
          last: 88,
          count: 6,
          firstPx: 0.5,
          lastPx: -12,
        },
        'K1 right top': ['0-49 cart K1', '50-64 lost', '65 floor 11', '66-83 cart K2', '84-88 floor 11', '89 lost'],
        'K1 right top into K2': {
          first: 66,
          last: 83,
          count: 18,
          firstPx: 43,
          lastPx: 0.5,
        },
        'K1 right held': ['0-15 cart K1', '16-24 lost', '25-31 floor 11', '32-49 cart K2', '50-88 floor 11', '89 lost'],
        'K1 right held into K2': {
          first: 32,
          last: 49,
          count: 18,
          firstPx: 128,
          lastPx: 85.5,
        },
        'K1 right again': ['0-49 cart K1', '50-64 lost', '65 floor 11', '66-83 cart K2', '84-88 floor 11', '89 lost'],
        'K1 right again into K2': {
          first: 66,
          last: 83,
          count: 18,
          firstPx: 43,
          lastPx: 0.5,
        },
        'K1 none tap': ['0-66 cart K1', '67-81 lost', '82-83 floor 11', '84-88 cart K2', '89 lost'],
        'K1 none tap into K2': {
          first: 84,
          last: 88,
          count: 5,
          firstPx: -2,
          lastPx: -12,
        },
        'K1 none top': ['0-49 cart K1', '50-65 lost', '66 floor 11', '67-83 cart K2', '84-88 floor 11', '89 lost'],
        'K1 none top into K2': {
          first: 67,
          last: 83,
          count: 17,
          firstPx: 40.5,
          lastPx: 0.5,
        },
        'K1 none held': ['0-15 cart K1', '16-25 lost', '26-32 floor 11', '33-49 cart K2', '50-88 floor 11', '89 lost'],
        'K1 none held into K2': {
          first: 33,
          last: 49,
          count: 17,
          firstPx: 125.5,
          lastPx: 85.5,
        },
        'K1 none again': ['0-49 cart K1', '50-65 lost', '66 floor 11', '67-83 cart K2', '84-88 floor 11', '89 lost'],
        'K1 none again into K2': {
          first: 67,
          last: 83,
          count: 17,
          firstPx: 40.5,
          lastPx: 0.5,
        },
        'K2 right tap': ['0-52 cart K2', '53-75 lost'],
        'K2 right tap into K3': 'none',
        'K2 right top': ['0-15 cart K2', '16-26 floor 8', '27-35 cart K2', '36-57 lost', '58 floor 11', '59-74 cart K3', '75 lost'],
        'K2 right top into K3': '16: x 3462.0 to 3499.5',
        'K2 right held': [
          '0-8 floor 11',
          '9-19 floor 8',
          '20-27 cart K2',
          '28-42 cart K3',
          '43-58 floor 11',
          '59-74 floor 15',
          '75 lost',
        ],
        'K2 right held into K3': '15: x 3384.5 to 3419.5',
        'K2 right again': ['0-15 cart K2', '16-26 floor 8', '27-35 cart K2', '36-57 lost', '58 floor 11', '59-74 cart K3', '75 lost'],
        'K2 right again into K3': '16: x 3462.0 to 3499.5',
        'K2 none tap': ['0-52 cart K2', '53-75 lost'],
        'K2 none tap into K3': 'none',
        'K2 none top': ['0-15 cart K2', '16-26 floor 8', '27-35 cart K2', '36-57 lost', '58 floor 11', '59-74 cart K3', '75 lost'],
        'K2 none top into K3': '16: x 3462.0 to 3499.5',
        'K2 none held': ['0-8 floor 11', '9-19 floor 8', '20-27 cart K2', '28-42 cart K3', '43-58 floor 11', '59-74 ramp', '75 lost'],
        'K2 none held into K3': '15: x 3384.5 to 3419.5',
        'K2 none again': ['0-15 cart K2', '16-26 floor 8', '27-35 cart K2', '36-57 lost', '58 floor 11', '59-74 cart K3', '75 lost'],
        'K2 none again into K3': '16: x 3462.0 to 3499.5',
      },
    });
  }, 300_000);
});

describe("GDD-WLD-17 level 3-2 Ketsu: K2's beam, K3 and the secret", () => {
  it("GDD-WLD-15 3-2 K2's hanging beam: after each way of arriving from K1, the plain jump's window over it, counted from the landing", () => {
    const arrivals = arrivalsInK2();
    const windows: string[] = [];
    const short: string[] = [];
    for (const a of arrivals) {
      const ride = [a, ...play(a, 200, () => idle, (r) => !inCart(r, 'K2'))].filter((st) => inCart(st, 'K2'));
      for (const move of [0, 1] as const) {
        const over = ride.map((st, i) => ({ i, f: fly(st, 'top', i, move) })).filter(({ f }) => f.landed !== undefined && inCart(f.landed, 'K2') && f.landed.player.x - 6 > K2_BEAM_FACE + TILE);
        const [first, last] = [over[0]?.i, over[over.length - 1]?.i];
        windows.push(`m ${a.carts[cartOf('K2')]!.m} ${move ? 'right' : 'none'}: ${first} to ${last}`);
        if (last !== undefined && last < 12) short.push(`m ${a.carts[cartOf('K2')]!.m} ${move ? 'right' : 'none'}`);
      }
    }
    // A rider who does nothing at the beam is stopped by it and stands on the floor, no life lost.
    const still = play(arrivals[0]!, 200, () => idle);
    expect(Math.max(...still.map((st) => st.player.x))).toBeLessThanOrEqual(K2_BEAM_FACE - 6 + 1e-6);
    expect(still[still.length - 1]!.player).toMatchObject({ grounded: true, y: Y(11) });
    expect(lostIn(still, arrivals[0]!)).toBe(false);
    // Measured: K2 stands until he lands in it, so every arrival from K1 is the same ride: the plain jump clears the beam from the 27th to
    // the 34th step after the landing (0.45 to 0.57 s; GDD: 0.45 to 0.58 s), right held or not; no arrival has under 12 steps.
    expect({ arrivals: arrivals.length, windows, short }).toEqual({
      arrivals: 1,
      windows: ['m 16 none: 27 to 34', 'm 16 right: 27 to 34'],
      short: [],
    });
  }, 300_000);

  it('GDD-WLD-15 3-2 K3: a jump at every step of its ride to the buffer, four ways, right held and nothing held: the ledge past its lip at 232', () => {
    const o = L.ofrendas[2]!;
    const k = bot([hopInto('K1'), jumpFromCart((r) => endOf('K1') - r.player.x <= 30, 'top'), jumpFromCart((r) => K2_BEAM_FACE - r.player.x <= 40, 'top'), jumpFromCart((r) => endOf('K2') - r.player.x <= 20, 'top')], at(o.x, o.y));
    expect(inCart(k.end, 'K3')).toBe(true);
    const ride = [k.end, ...play(k.end, 300, () => idle, (r) => r.carts[cartOf('K3')]!.phase === 'stopped')];
    const out: Record<string, unknown> = {};
    for (const move of [1, 0] as const) {
      const flights = sweep(ride, move);
      for (const kind of JUMPS) {
        out[`${move ? 'right' : 'none'} ${kind}`] = runsOf(flights[kind], ketsu);
        const w = flights[kind].filter((f) => ketsu(f) === 'ledge');
        out[`${move ? 'right' : 'none'} ${kind} ledge`] = w.length === 0 ? 'none' : `${w.length}: x ${w[0]!.x.toFixed(1)} to ${w[w.length - 1]!.x.toFixed(1)}`;
        expect(flights[kind].filter((f) => f.lost).map((f) => f.k), kind).toEqual([]);
      }
    }
    // Measured (k from the landing in K3; its ramp's top at 32). The plain jump lands on the ledge from x = 3620.5 (GDD: "from before the
    // ramp") and, from 45 to 52, flies on into the exit's box and clears the level in the air; the glide reaches the exit from every step
    // before the ramp. Nothing here costs a life.
    expect(out).toEqual({
      'right tap': ['0-47 cart K3', '48-60 ramp', '61-95 cart K3'],
      'right tap ledge': 'none',
      'right top': ['0-20 cart K3', '21-44 ledge', '45-52 exit', '53-60 ledge', '61-95 cart K3'],
      'right top ledge': '32: x 3620.5 to 3707.4',
      'right held': ['0-55 exit', '56-60 ledge', '61-92 cart K3', '93-94 floor 15', '95 cart K3'],
      'right held ledge': '5: x 3698.9 to 3707.4',
      'right again': ['0 cart K3', '1-20 floor 15', '21-44 ledge', '45-52 exit', '53-60 ledge', '61-95 cart K3'],
      'right again ledge': '32: x 3620.5 to 3707.4',
      'none tap': ['0-47 cart K3', '48-60 ramp', '61-95 cart K3'],
      'none tap ledge': 'none',
      'none top': ['0-20 cart K3', '21-44 ledge', '45-52 exit', '53-60 ramp', '61-95 cart K3'],
      'none top ledge': '24: x 3620.5 to 3673.5',
      'none held': ['0-52 exit', '53-60 ramp', '61-92 cart K3', '93-94 floor 15', '95 cart K3'],
      'none held ledge': 'none',
      'none again': ['0 cart K3', '1-20 ramp', '21-44 ledge', '45-52 exit', '53-60 ramp', '61-95 cart K3'],
      'none again ledge': '24: x 3620.5 to 3673.5',
    });
  }, 120_000);

  it('GDD-WLD-17 3-2 the secret: staying in K3 to the buffer, the veladora and the hilo at 236 are his; back up the ramp, the 4-tile jump to the lip, and the exit', () => {
    const o = L.ofrendas[2]!;
    const k = bot([hopInto('K1'), jumpFromCart((r) => endOf('K1') - r.player.x <= 30, 'top'), jumpFromCart((r) => K2_BEAM_FACE - r.player.x <= 40, 'top'), jumpFromCart((r) => endOf('K2') - r.player.x <= 20, 'top'), waitFor((r) => r.carts[cartOf('K3')]!.phase === 'stopped'), runUntil(1, (r) => r.player.grounded && r.player.x >= 238 * TILE + 2)], at(o.x, o.y));
    expect(k.lost).toEqual([]);
    expect(took(k.end, 236, 13)).toBe(true);
    expect(k.end.lives.used.has(`veladora:${L.veladora!.col},${L.veladora!.row}`)).toBe(true);
    // Back up the ramp on foot to its top (column 227).
    const up = play(k.end, 300, () => ({ move: -1, jumpHeld: false }), (r) => r.player.x <= 227 * TILE + 8);
    expect(up[up.length - 1]!.player).toMatchObject({ grounded: true, y: Y(11) });
    // The 4-tile jump from the ramp's top over it to the lip at 232: take-offs over the ramp's top 2 tiles (226 and 227).
    const out = takeOffs((x, vx) => at(x, Y(11), vx), apart(226 * TILE, 228 * TILE), ['top', 'held'], ketsu);
    for (const lines of Object.values(out)) expect(lines.filter((l) => l.endsWith('lost'))).toEqual([]);
    // Then on to the exit.
    const out2 = bot([jumpAt(227 * TILE + 8, K_LIP + TILE), runUntil(1, (r) => r.phase === 'clear')], up[up.length - 1]!, 600);
    expect(out2.end.phase).toBe('clear');
    // Measured: K3 stops at its buffer 95 steps after the landing; from the ramp's top the plain jump reaches the ledge only running from
    // x = 3638.4, the glide carries him on into the exit's box; misses land on the ramp. From the ramp's top to the clear: 60 steps.
    expect({ toBuffer: k.marks[4]! - k.marks[3]!, out, toExit: out2.states.length }).toEqual({
      toBuffer: 95,
      out: {
        'standing right top': ['3616.0-3648.0 ramp'],
        'standing right held': ['3616.0-3648.0 exit'],
        'standing none top': ['3616.0-3648.0 floor 11'],
        'standing none held': ['3616.0-3648.0 floor 11'],
        'running right top': ['3616.0-3635.2 ramp', '3638.4-3648.0 ledge'],
        'running right held': ['3616.0-3648.0 exit'],
        'running none top': ['3616.0-3625.6 floor 11', '3628.8-3648.0 ramp'],
        'running none held': ['3616.0-3625.6 floor 11', '3628.8-3648.0 ramp'],
      },
      toExit: 60,
    });
  }, 120_000);
});

describe('GDD-WLD-17 level 3-2 Ketsu on foot', () => {
  it("GDD-WLD-03 3-2 Ketsu on foot: take-offs over the 3 tiles before each pit's lip, standing and running, a plain jump and the glide, right held and nothing held", () => {
    const lips = { '188-190': 188 * TILE, '196-200': 196 * TILE, '216-221': 216 * TILE };
    const out: Record<string, Record<string, string[]>> = {};
    for (const [name, lip] of Object.entries(lips)) out[name] = takeOffs((x, vx) => at(x, Y(11), vx), apart(lip - 3 * TILE, lip), ['top', 'held'], ketsu);
    // Measured. Over 188 to 190 the plain jump crosses from the last tile, the glide from most take-offs (a few land in cart K2). Over 196
    // to 200 the plain jump never crosses; the glide lands in cart K2, which stands on the far bank's first two columns, from most take-offs,
    // and past it only running from the last 3.2 px. Over 216 to 221 the plain jump never crosses; the glide lands in cart K3 (on the far
    // bank's first two columns) or, from 3411.2 to 3430.4, past it on the floor. A walker who never boards a cart has two or three
    // take-offs at each of the last two pits.
    expect(out).toEqual({
      '188-190': {
        'standing right top': ['2960.0-2992.0 lost', '2995.2-3008.0 floor 11'],
        'standing right held': ['2960.0-2988.8 floor 11', '2992.0-2998.4 lost', '3001.6-3004.8 cart K2', '3008.0 floor 11'],
        'standing none top': ['2960.0-2979.2 cart K1', '2982.4-3008.0 floor 11'],
        'standing none held': ['2960.0-2979.2 cart K1', '2982.4-3008.0 floor 11'],
        'running right top': ['2960.0-2979.2 lost', '2982.4-3008.0 floor 11'],
        'running right held': ['2960.0-2979.2 floor 11', '2982.4-2988.8 lost', '2992.0 cart K2', '2995.2-3008.0 floor 11'],
        'running none top': ['2960.0 cart K1', '2963.2-2992.0 floor 11', '2995.2-3008.0 lost'],
        'running none held': ['2960.0 cart K1', '2963.2-2992.0 floor 11', '2995.2-3008.0 lost'],
      },
      '196-200': {
        'standing right top': ['3088.0-3136.0 lost'],
        'standing right held': ['3088.0-3107.2 lost', '3110.4-3136.0 cart K2'],
        'standing none top': ['3088.0-3107.2 lost', '3110.4-3136.0 floor 11'],
        'standing none held': ['3088.0-3107.2 lost', '3110.4-3136.0 floor 11'],
        'running right top': ['3088.0-3136.0 lost'],
        'running right held': ['3088.0-3104.0 lost', '3107.2-3129.6 cart K2', '3132.8-3136.0 floor 11'],
        'running none top': ['3088.0-3104.0 lost', '3107.2-3120.0 floor 11', '3123.2-3136.0 lost'],
        'running none held': ['3088.0-3104.0 lost', '3107.2-3116.8 floor 11', '3120.0-3136.0 lost'],
      },
      '216-221': {
        'standing right top': ['3408.0-3456.0 lost'],
        'standing right held': ['3408.0-3420.8 lost', '3424.0-3430.4 floor 11', '3433.6-3456.0 cart K3'],
        'standing none top': ['3408.0-3456.0 floor 11'],
        'standing none held': ['3408.0-3456.0 floor 11'],
        'running right top': ['3408.0-3456.0 lost'],
        'running right held': ['3408.0 lost', '3411.2-3420.8 floor 11', '3424.0-3456.0 cart K3'],
        'running none top': ['3408.0-3440.0 floor 11', '3443.2-3456.0 lost'],
        'running none held': ['3408.0-3440.0 floor 11', '3443.2-3456.0 lost'],
      },
    });
  }, 120_000);

  it('GDD-WLD-17 3-2 Ketsu on foot: from the ofrenda at 181 to the exit without a cart, at every 8th start time of the Alacrán', () => {
    const o = L.ofrendas[2]!;
    const result: Record<string, number> = {};
    for (const t of every(8, periodOf(K1_ALACRAN))) {
      const run = bot(WALK_KETSU(), atT(o.x, o.y, t), 2000, true);
      const boarded = LETTERS.find((l) => run.states.some((st) => st.carts[cartOf(l)]!.phase !== 'waiting'));
      tally(result, boarded ? `boarded ${boarded}` : run.end.phase === 'clear' ? `exit in ${run.states.length}` : run.lost.length > 0 ? `lost to ${causeOf(run.states, run.lost[0]!)} after task ${run.marks.length}` : `stuck at ${Math.floor(run.end.player.x / TILE)}`);
    }
    // Measured over 34 start times: the walker exits in 28 (422 to 472 steps) and loses one to K1's Alacrán in 6, as it comes down from a
    // jump straight up at it; it boards no cart.
    expect(result).toEqual({
      'exit in 472': 8,
      'exit in 451': 2,
      'lost to alacran 4 after task 2': 1,
      'exit in 422': 18,
      'lost to alacran 4 after task 1': 1,
      'lost to alacran 4 after task 3': 4,
    });
  }, 120_000);
});
