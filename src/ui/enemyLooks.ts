// GDD-ENM-02, GDD-ENM-03, GDD-ENM-04, GDD-ART-05: the looks of the enemy sheets and of the defeat poof, in sheet order (the order of each
// `scripts/art/enemies1/<kind>.mjs`'s, `enemies2/<kind>.mjs`'s and `enemies3/<kind>.mjs`'s LOOKS: a test compares them). A look's frame is
// its index here.
import type { EnemyKind } from '../sim/enemy';

export const ALACRAN_LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'squash', 'hit'] as const;
export const ZOPILOTE_LOOKS = ['flap0', 'flap1', 'flap2', 'flap3', 'tele', 'teleRed', 'diveSteep', 'diveShallow', 'climb0', 'climb1', 'hit'] as const;
export const CACTUS_LOOKS = ['doze0', 'doze1', 'peek', 'alarm0', 'alarm1'] as const;
export const TLACUACHE_LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'tele', 'teleRed', 'run0', 'run1', 'run2', 'run3', 'dead', 'deadTwitch', 'squash', 'hit'] as const;
export const PALOMA_LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'tele', 'teleRed', 'flap0', 'flap1', 'flap2', 'flap3', 'glide', 'squash', 'hit'] as const;
export const CHAPULIN_LOOKS = ['crouch0', 'crouch1', 'tele', 'teleRed', 'rise', 'fall', 'boing', 'squash', 'hit'] as const;
export const TROMPO_LOOKS = ['spin0', 'spin1', 'spin2', 'spin3', 'stun', 'stunWobble', 'squash'] as const;
export const MURCIELAGO_LOOKS = ['flap0', 'flap1', 'flap2', 'flap3', 'squash', 'hit'] as const;
export const POOF_LOOKS = ['poof0', 'poof1', 'poof2', 'poof3'] as const;

/** The sheets: World 1's four kinds, World 2's three, World 3's Murciélago and the poof. */
export const ENEMY_LOOKS = { alacran: ALACRAN_LOOKS, zopilote: ZOPILOTE_LOOKS, cactus: CACTUS_LOOKS, tlacuache: TLACUACHE_LOOKS, paloma: PALOMA_LOOKS, chapulin: CHAPULIN_LOOKS, trompo: TROMPO_LOOKS, murcielago: MURCIELAGO_LOOKS, poof: POOF_LOOKS } as const;
export type Sheet = keyof typeof ENEMY_LOOKS;
export const SHEETS: readonly Sheet[] = ['alacran', 'zopilote', 'cactus', 'tlacuache', 'paloma', 'chapulin', 'trompo', 'murcielago', 'poof'];
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
