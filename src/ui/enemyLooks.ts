// GDD-ENM-02, GDD-ENM-03, GDD-ENM-04, GDD-ART-05: the looks of the enemy sheets and of the defeat poof, in sheet order (the order of each
// `scripts/art/enemies1/<kind>.mjs`'s, `enemies2/<kind>.mjs`'s and `enemies3/<kind>.mjs`'s LOOKS: a test compares them). A look's frame is
// its index here.
import { kindOf, type Enemy, type EnemyKind } from '../sim/enemy';

export const ALACRAN_LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'squash', 'hit'] as const;
export const ZOPILOTE_LOOKS = ['flap0', 'flap1', 'flap2', 'flap3', 'tele', 'teleRed', 'diveSteep', 'diveShallow', 'climb0', 'climb1', 'hit'] as const;
export const CACTUS_LOOKS = ['doze0', 'doze1', 'peek', 'alarm0', 'alarm1'] as const;
export const TLACUACHE_LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'tele', 'teleRed', 'run0', 'run1', 'run2', 'run3', 'dead', 'deadTwitch', 'squash', 'hit'] as const;
export const PALOMA_LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'tele', 'teleRed', 'flap0', 'flap1', 'flap2', 'flap3', 'glide', 'squash', 'hit'] as const;
export const CHAPULIN_LOOKS = ['crouch0', 'crouch1', 'tele', 'teleRed', 'rise', 'fall', 'boing', 'squash', 'hit'] as const;
export const TROMPO_LOOKS = ['spin0', 'spin1', 'spin2', 'spin3', 'stun', 'stunWobble', 'squash'] as const;
export const MURCIELAGO_LOOKS = ['flap0', 'flap1', 'flap2', 'flap3', 'squash', 'hit'] as const;
export const POOF_LOOKS = ['poof0', 'poof1', 'poof2', 'poof3'] as const;
/**
 * GDD-ENM-04 (Proposed): the Armadillo's sheet (`scripts/art/enemies3/armadillo.mjs`), cells of 28 x 16 game px, and the box each look is
 * drawn in within its cell, in game px: walking, dazed and squashed the whole cell, the tuck and the roll its 20 x 16 middle. Its defeat's
 * knocked-over frame is `dazed` (it has no hit frame).
 */
export const ARMADILLO_LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'tuck', 'tuckRed', 'roll0', 'roll1', 'roll2', 'roll3', 'dazed', 'dazedKick', 'squash'] as const;
const WIDE = { x: 0, y: 0, w: 28, h: 16 } as const;
const BALL = { x: 4, y: 0, w: 20, h: 16 } as const;
export const ARMADILLO_LOOK_BOXES: Readonly<Record<(typeof ARMADILLO_LOOKS)[number], { readonly x: number; readonly y: number; readonly w: number; readonly h: number }>> = {
  walk0: WIDE, walk1: WIDE, walk2: WIDE, walk3: WIDE, tuck: BALL, tuckRed: BALL, roll0: BALL, roll1: BALL, roll2: BALL, roll3: BALL, dazed: WIDE, dazedKick: WIDE, squash: WIDE,
};

/**
 * GDD-ENM-04, L-059: the bottom of each Armadillo look, copied from its drawing (`scripts/art/enemies3/armadillo.mjs`; a test compares
 * them): for each of the cell's 56 drawing px columns, facing right, how far its lowest drawn pixel's bottom is above the cell's bottom row
 * (the feet), in drawing px as a base-36 digit, or '.' where nothing is drawn. The scene shifts a look off a wall and raises it off a slope
 * by it (`enemyPose`).
 */
export const ARMADILLO_BOTTOMS: Readonly<Partial<Record<EnemyLook, string>>> = {
  walk0: '..433344445555610001666661000166661000016677777777789...',
  walk1: '..43344455566677100017771000177771000000178888888889a...',
  walk2: '..433344445555666661000001666610001666610001777777789...',
  walk3: '..43344455566677771000100017777100017710001888888889a...',
  tuck: '............21111232211000000000011111123...............',
  tuckRed: '............21111232211000000000011111123...............',
  roll0: '........83333.0000332111000000001112334679..............',
  roll1: '.........444400004332111000000001112334679..............',
  roll2: '........2222770000332111000000001112334679..............',
  roll3: '........9944000064332111000000001112334679..............',
  dazed: '..ba9988777665665432111000000000011123456765432123889a..',
  dazedKick: '..ba9988777665665432111000000000011123456765432123889a..',
  squash: '..433322222111222111000000000000000011122211111111124...',
};

/** The sheets: World 1's four kinds, World 2's three, World 3's Murciélago and Armadillo, and the poof. */
export const ENEMY_LOOKS = { alacran: ALACRAN_LOOKS, zopilote: ZOPILOTE_LOOKS, cactus: CACTUS_LOOKS, tlacuache: TLACUACHE_LOOKS, paloma: PALOMA_LOOKS, chapulin: CHAPULIN_LOOKS, trompo: TROMPO_LOOKS, murcielago: MURCIELAGO_LOOKS, armadillo: ARMADILLO_LOOKS, poof: POOF_LOOKS } as const;
export type Sheet = keyof typeof ENEMY_LOOKS;
/** The sheets every level loads: they are small. Not the Armadillo's (`sheetsFor`). */
export const SHEETS: readonly Sheet[] = ['alacran', 'zopilote', 'cactus', 'tlacuache', 'paloma', 'chapulin', 'trompo', 'murcielago', 'poof'];

/** GDD-ENM-04, GDD-TEC-03: the sheets a level loads: `SHEETS`, and the Armadillo's only in a level that has one. */
export const sheetsFor = (level: { readonly enemies: readonly Enemy[] }): readonly Sheet[] => (level.enemies.some((e) => kindOf(e) === 'armadillo') ? [...SHEETS, 'armadillo'] : SHEETS);
/** The kinds of enemy, which each have a sheet of their own. */
export type EnemySheet = Exclude<Sheet, 'poof'>;
/** World 1's kinds. */
export const isWorld1 = (kind: EnemyKind): kind is 'alacran' | 'zopilote' | 'cactus' | 'tlacuache' => kind === 'alacran' || kind === 'zopilote' || kind === 'cactus' || kind === 'tlacuache';
/** World 2's kinds (GDD-ENM-03). */
export const isWorld2 = (kind: EnemyKind): kind is 'paloma' | 'chapulin' | 'trompo' => kind === 'paloma' || kind === 'chapulin' || kind === 'trompo';
export type EnemyLook = (typeof ENEMY_LOOKS)[Sheet][number];

/** The frame of `look` in `sheet`'s sheet. */
export const lookFrame = (sheet: Sheet, look: EnemyLook): number => (ENEMY_LOOKS[sheet] as readonly EnemyLook[]).indexOf(look);

/** The look a frame of `sheet`'s sheet shows, to read back what was drawn (L-010): `lookFrame`'s inverse. */
export const frameLook = (sheet: Sheet, frame: number): EnemyLook => ENEMY_LOOKS[sheet][frame]!;
