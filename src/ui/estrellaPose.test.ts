import { describe, expect, it } from 'vitest';
import { ESTRELLA_ART } from '../config/tuning';
import { aimAt, estrellaStart, type Estrella, type EstrellaMode, type EstrellaState } from '../sim/estrella';
import { spawn } from '../sim/movement';
import { ESTRELLA_DEFEAT_LOOKS, ESTRELLA_LOOKS, estrellaFrameInfo, estrellaPose, tejocoteBoxes } from './estrellaPose';

const DEF: Estrella = { floor: 224, spots: [[400, 80], [320, 160], [400]], tear: { x: 240, y: 176, awning: 1 } };
/** Her in `mode` at age `age` with `hits` taken, her middle across at x and her box's bottom at y, heading for (tx, ty). */
const posed = (mode: EstrellaMode, age = 0, hits = 0, x = 240, y = 112, ty = y): EstrellaState => ({ ...estrellaStart(DEF, hits), mode, age, x, y, tx: x, ty });
/** Poncho standing at x on the floor. */
const poncho = (x: number) => spawn(x, 224);
/** The look the pose shows, with the flash's colour dropped (`Red` and `White` looks are the flashes). */
const look = (e: EstrellaState, x = 100) => estrellaPose(e, poncho(x), DEF).look;
const pose = (e: EstrellaState, x = 100) => estrellaPose(e, poncho(x), DEF);
const hangFrame = (hits: number) => pose(posed('hang', 0, hits)).frame;
const telegraphLook = (x: number, age = 4) => pose(posed('telegraph', age, 0, 240, 40), x).look;
const telegraphFlash = (age: number) => pose(posed('telegraph', age, 0, 240, 40)).flash;
const dormantFlash = (mode: 'hurt' | 'defeated', age: number) => pose(posed(mode, age, mode === 'hurt' ? 1 : 3)).flash;
const trolleyFrame = (mode: EstrellaMode, x: number) => pose(posed(mode, 3, 0, x, 40)).trolley.frame;
const shaken = (age: number) => pose(posed('telegraph', age, 0, 240, 40));
const tejocoteFrame = (x: number) => tejocoteBoxes([{ x, y: 224, dir: 1, wait: 0 }])[0]!.frame;

describe('GDD-BOS-03 which frame of her sheet is drawn', () => {
  it('GDD-BOS-03 the frames come in the order of her sheet: 15 looks for each of 0, 1 and 2 hits, then the four defeat looks', () => {
    expect(ESTRELLA_LOOKS).toEqual(['glide', 'telegraphL', 'telegraphLRed', 'telegraphR', 'telegraphRRed', 'drop', 'land', 'bounce', 'rest', 'rise', 'hangL', 'hangR', 'yank', 'hurt', 'hurtWhite']);
    expect(ESTRELLA_DEFEAT_LOOKS).toEqual(['fall', 'fallWhite', 'lie', 'lieWhite']);
    expect(ESTRELLA_ART.looks).toBe(15);
    // Frame = hits * 15 + the look's place in the list; her hang with Poncho on her left is hangL, the eleventh look.
    expect([0, 1, 2].map(hangFrame)).toEqual([10, 25, 40]);
    // The defeat looks follow the 45 living frames: fall, fallWhite, lie, lieWhite.
    expect([150, 224].map((y) => estrellaPose(posed('defeated', 4, 3, 240, y), poncho(100), DEF).frame)).toEqual([45, 47]);
  });

  it('GDD-BOS-03 estrellaFrameInfo reads a frame back: its look, the hits it shows, its cones and its flash', () => {
    expect(estrellaFrameInfo(0)).toEqual({ look: 'glide', hits: 0, cones: 7, flash: null });
    expect(estrellaFrameInfo(2)).toEqual({ look: 'telegraphLRed', hits: 0, cones: 7, flash: 'red' });
    expect(estrellaFrameInfo(15 + 14)).toEqual({ look: 'hurtWhite', hits: 1, cones: 5, flash: 'white' });
    expect(estrellaFrameInfo(30 + 6)).toEqual({ look: 'land', hits: 2, cones: 3, flash: null });
    expect(estrellaFrameInfo(45)).toEqual({ look: 'fall', hits: 3, cones: 0, flash: null });
    expect(estrellaFrameInfo(48)).toEqual({ look: 'lieWhite', hits: 3, cones: 0, flash: 'white' });
  });

  it('GDD-BOS-03 she is drawn about her box middle', () => {
    expect(estrellaPose(posed('hang'), poncho(100), DEF)).toMatchObject({ x: 240, y: 96 });
  });

  it('GDD-BOS-03 her cones follow her hits: 7, then 5, 3 and none once defeated', () => {
    const cones = [0, 1, 2].map((hits) => estrellaFrameInfo(estrellaPose(posed('hang', 0, hits), poncho(100), DEF).frame).cones);
    expect(cones).toEqual([7, 5, 3]);
    expect(estrellaFrameInfo(estrellaPose(posed('defeated', 0, 3), poncho(100), DEF).frame).cones).toBe(0);
    for (const hits of [0, 1, 2]) expect(estrellaPose(posed('hang', 0, hits), poncho(100), DEF).frame, `hits ${hits}`).toBe(hits * 15 + 10);
  });

  it('GDD-BOS-03 her looks by mode: glide, drop, bounce, rise, hang, yank and hurt', () => {
    // High on the cable, or low, away from any surface.
    expect(look(posed('glide', 3, 0, 300, 40))).toBe('glide');
    expect(look(posed('drop', 3, 0, 240, 100, 176))).toBe('drop');
    expect(look(posed('bounce', 3, 0, 80, 150, 72))).toBe('bounce');
    expect(look(posed('rise', 3, 0, 160, 150, 72))).toBe('yank'); // more than 14 px clear of the floor
    expect(look(posed('hang', 3, 0, 80, 112))).toMatch(/^hang[LR]$/);
    expect(look(posed('yank', 3, 0, 80, 100, 40))).toBe('yank');
    expect(look(posed('hurt', 4, 1, 80, 112))).toBe('hurt');
  });

  it('GDD-BOS-03 the landing look from 14 px above the surface she drops onto: 13 and 14 px above, the splayed look; 15, the drop', () => {
    // Onto an awning top (176) and onto the floor (224), and in phase 3 through an awning to the floor (the target is the floor).
    for (const surface of [176, 224]) {
      expect(look(posed('drop', 3, 0, 240, surface - 13, surface)), `13 above ${surface}`).toBe('rest');
      expect(look(posed('drop', 3, 0, 240, surface - 14, surface)), `14 above ${surface}`).toBe('rest');
      expect(look(posed('drop', 3, 0, 240, surface - 15, surface)), `15 above ${surface}`).toBe('drop');
    }
    expect(look(posed('drop', 3, 2, 240, 176 - 13, 224))).toBe('drop'); // phase 3, 13 px above the awning she tears through, 61 above the floor
    expect(look(posed('drop', 3, 2, 240, 224 - 13, 224))).toBe('rest');
  });

  it('GDD-BOS-03 on the step she lands she is squashed: the land look, on the awning (a bounce) and on the floor (a rest)', () => {
    expect(look(posed('bounce', 0, 0, 80, 176))).toBe('land');
    expect(look(posed('bounce', 1, 0, 80, 172, 112))).toBe('bounce');
    expect(look(posed('rest', 0, 0, 160, 224))).toBe('land');
    expect(look(posed('rest', 1, 0, 160, 224))).toBe('rest');
    expect(look(posed('rest', 17, 1, 160, 224))).toBe('rest');
  });

  it('GDD-BOS-03 in her rise she keeps the splayed look until 14 px clear of the floor: 13 and 14 px up, rise; 15, in the air', () => {
    expect(look(posed('rise', 3, 0, 160, 224 - 13, 112))).toBe('rise');
    expect(look(posed('rise', 3, 0, 160, 224 - 14, 112))).toBe('rise');
    expect(look(posed('rise', 3, 0, 160, 224 - 15, 112))).toBe('yank');
  });

  it('GDD-BOS-03 her telegraph looks the way Poncho is from her: left when he is to her left, right otherwise', () => {
    expect(telegraphLook(100)).toBe('telegraphL');
    expect(telegraphLook(239)).toBe('telegraphL');
    expect(telegraphLook(241)).toBe('telegraphR');
    expect(telegraphLook(400)).toBe('telegraphR');
    // And in the red steps, the red frames of the same side.
    expect(telegraphLook(100, 0)).toBe('telegraphLRed');
    expect(telegraphLook(400, 0)).toBe('telegraphRRed');
  });

  it('GDD-BOS-03 her glide trails its tassels against the way she moves: drawn as it is going right, mirrored going left', () => {
    const glide = (x: number, spot: number, hits = 0, player = poncho(100)) => estrellaPose({ ...estrellaStart(DEF, hits), x, y: 40, tx: x, ty: 40, spot, mode: 'glide', age: 3 }, player, DEF);
    // Phase 1: her spots are x 400 and 80; spot 0 is on her right at x 300, spot 1 on her left.
    expect(glide(300, 0)).toMatchObject({ look: 'glide', flipX: false });
    expect(glide(300, 1)).toMatchObject({ look: 'glide', flipX: true });
    expect(glide(100, 1)).toMatchObject({ flipX: true }); // at 100 the spot at 80 is still on her left
    expect(glide(60, 1)).toMatchObject({ flipX: false }); // and from 60 it is on her right
    // Phase 3: first for the tear's x (240), then for the spot above Poncho.
    expect(glide(400, 0, 2)).toMatchObject({ flipX: true });
    expect(glide(100, 0, 2)).toMatchObject({ flipX: false });
    const tore = (x: number, player: ReturnType<typeof poncho>) => estrellaPose({ ...estrellaStart(DEF, 2, true), x, y: 40, tx: x, ty: 40, mode: 'glide', age: 3 }, player, DEF);
    expect(aimAt(poncho(300))).toBe(300);
    expect(tore(400, poncho(300))).toMatchObject({ flipX: true });
    expect(tore(100, poncho(300))).toMatchObject({ flipX: false });
    // No other look is mirrored.
    expect(estrellaPose(posed('telegraph', 4, 0, 240, 40), poncho(100), DEF).flipX).toBe(false);
    expect(estrellaPose(posed('hang', 4, 1, 240, 72), poncho(100), DEF).flipX).toBe(false);
  });

  it('GDD-BOS-03 her hang leans with the sign of her sway velocity: right while she swings right, left while she swings left', () => {
    // Phase 2 sways 8 px on a 60 step sine, x = tx + 8 sin(2 pi age / 60): rising to age 15, falling to 45, rising to 60.
    const lean = (age: number) => look(posed('hang', age, 1, 160, 72), 100);
    expect([1, 7, 15].map(lean)).toEqual(['hangR', 'hangR', 'hangR']);
    expect([16, 30, 45].map(lean)).toEqual(['hangL', 'hangL', 'hangL']);
    expect([46, 59].map(lean)).toEqual(['hangR', 'hangR']);
    // Poncho to her right makes no difference while she sways: the sway decides.
    expect(look(posed('hang', 30, 1, 160, 72), 400)).toBe('hangL');
    expect(look(posed('hang', 7, 1, 160, 72), 20)).toBe('hangR');
    // With no sway (phase 1) or no velocity yet (the first step of the hang) she leans to Poncho, as her telegraph does.
    expect(look(posed('hang', 30, 0, 80, 112), 20)).toBe('hangL');
    expect(look(posed('hang', 30, 0, 80, 112), 300)).toBe('hangR');
    expect(look(posed('hang', 0, 1, 160, 72), 20)).toBe('hangL');
    expect(look(posed('hang', 0, 1, 160, 72), 300)).toBe('hangR');
  });

  it('GDD-BOS-03 in her telegraph her body flashes red every other 4 steps', () => {
    expect([0, 3, 4, 7, 8, 29].map(telegraphFlash)).toEqual(['red', 'red', null, null, 'red', null]);
    expect([0, 4].map((age) => look(posed('telegraph', age, 0, 240, 40)))).toEqual(['telegraphLRed', 'telegraphL']);
  });

  it('GDD-BOS-03 hurt or defeated her body flashes white every other 4 steps', () => {
    for (const mode of ['hurt', 'defeated'] as const) expect([0, 3, 4, 8].map((a) => dormantFlash(mode, a)), mode).toEqual(['white', 'white', null, 'white']);
    expect([0, 4].map((age) => look(posed('hurt', age, 1)))).toEqual(['hurtWhite', 'hurt']);
    expect([0, 4].map((age) => look(posed('defeated', age, 3, 240, 150)))).toEqual(['fallWhite', 'fall']);
    expect([0, 4].map((age) => look(posed('defeated', age, 3, 240, 224)))).toEqual(['lieWhite', 'lie']);
  });

  it('GDD-BOS-03 otherwise her body does not flash', () => {
    for (const mode of ['glide', 'drop', 'bounce', 'rest', 'rise', 'hang', 'yank'] as const) expect(estrellaPose(posed(mode), poncho(100), DEF).flash, mode).toBeNull();
  });

  it('GDD-BOS-03 defeated she falls without her rope, and lies once her box is on the floor', () => {
    expect(look(posed('defeated', 5, 3, 240, 150))).toBe('fall');
    // The falling pot's frame reaches 2 px below its box, so it lies from 1 px above the floor: it is never drawn into it.
    expect(look(posed('defeated', 5, 3, 240, 222))).toBe('fall');
    expect(look(posed('defeated', 5, 3, 240, 223))).toBe('lie');
    expect(look(posed('defeated', 5, 3, 240, 224))).toBe('lie');
    expect(estrellaFrameInfo(estrellaPose(posed('defeated', 5, 3, 240, 224), poncho(100), DEF).frame).look).toBe('lie');
  });

  it('GDD-BOS-03 her rope hangs from the trolley\'s eye 2.75 px under the cable at y 8 to 4 px under her top cone\'s tip', () => {
    // Low in phase 1 (her middle at 96) the tip is 28 px above it, at y 68.
    expect(estrellaPose(posed('hang'), poncho(100), DEF).rope).toEqual({ x: 240, top: 10.75, end: 72 });
    // High on the cable her tip is above the trolley's eye, so the rope has no length.
    const high = estrellaPose(posed('glide', 3, 0, 240, 40), poncho(100), DEF).rope!;
    expect(high.end).toBeLessThan(high.top);
  });

  it('GDD-BOS-03 her trolley rides the cable at y 8 above her middle, and keeps there once she is defeated', () => {
    for (const mode of ['glide', 'drop', 'hang', 'yank', 'hurt'] as const) expect(estrellaPose(posed(mode), poncho(100), DEF).trolley, mode).toMatchObject({ x: 240, y: 8 });
    expect(estrellaPose(posed('defeated', 0, 3), poncho(100), DEF).trolley).toMatchObject({ x: 240, y: 8 });
  });

  it('GDD-BOS-03 her trolley\'s frame alternates with each eighth turn of its wheel while she glides, and is the first one otherwise', () => {
    // The wheel is 3.6 px in radius: an eighth turn rolls 3.6 * pi / 4 = 2.83 px, so x 100 (35 eighths) and 103 (36) are different frames.
    expect([100, 103, 106, 109].map((x) => trolleyFrame('glide', x))).toEqual([1, 0, 1, 0]);
    expect(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => trolleyFrame('glide', 100 + x)))).toEqual(new Set([0, 1]));
    for (const mode of ['telegraph', 'hang', 'yank', 'hurt', 'defeated'] as const) expect([100, 103].map((x) => trolleyFrame(mode, x)), mode).toEqual([0, 0]);
  });

  it('GDD-BOS-03 in her telegraph her body, rope and trolley shake 2 px right then left, flipping every 4 steps', () => {
    // High on the cable (her bottom at 40) her rope has no length, so the shake is drawn on her body and the trolley.
    expect([0, 3, 4, 7, 8, 29].map((a) => shaken(a).x)).toEqual([242, 242, 238, 238, 242, 238]);
    expect([0, 4].map((a) => [shaken(a).x, shaken(a).trolley.x, shaken(a).rope!.x])).toEqual([[242, 242, 242], [238, 238, 238]]);
  });

  it('GDD-BOS-03 outside her telegraph she does not shake', () => {
    for (const mode of ['glide', 'drop', 'bounce', 'rest', 'rise', 'hang', 'yank', 'hurt'] as const) {
      for (const age of [0, 4]) expect(estrellaPose(posed(mode, age), poncho(100), DEF).x, `${mode} ${age}`).toBe(240);
    }
  });

  it('GDD-BOS-03 defeated, her rope has snapped', () => {
    expect(estrellaPose(posed('defeated', 0, 3), poncho(100), DEF).rope).toBeNull();
  });

  it('GDD-BOS-03 her tejocotes are drawn as 8 px squares, only once out of her, the calyx a quarter turn for each 6.28 px they roll', () => {
    // A circle 8 px across turns a quarter over pi * 8 / 4 = 6.28 px of floor.
    expect(
      tejocoteBoxes([
        { x: 100, y: 224, dir: 1, wait: 0 },
        { x: 160, y: 224, dir: -1, wait: 24 },
      ]),
    ).toEqual([{ x: 96, y: 216, w: 8, h: 8, frame: 3 }]);
    expect([0, 6, 7, 12.5, 13, 19, 26, 31.5, 100, 145].map(tejocoteFrame)).toEqual([0, 0, 1, 1, 2, 3, 0, 1, 3, 3]);
  });
});
