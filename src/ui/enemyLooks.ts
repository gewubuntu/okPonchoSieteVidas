// GDD-ENM-02, GDD-ART-05: the looks of World 1's enemy sheets and of the defeat poof, in sheet order (the order of each
// `scripts/art/enemies1/<kind>.mjs`'s LOOKS: a test compares them). A look's frame is its index here.
import type { EnemyKind } from '../sim/enemy';

export const ALACRAN_LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'squash', 'hit'] as const;
export const ZOPILOTE_LOOKS = ['flap0', 'flap1', 'flap2', 'flap3', 'tele', 'teleRed', 'diveSteep', 'diveShallow', 'climb0', 'climb1', 'hit'] as const;
export const CACTUS_LOOKS = ['doze0', 'doze1', 'peek', 'alarm0', 'alarm1'] as const;
export const TLACUACHE_LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'tele', 'teleRed', 'run0', 'run1', 'run2', 'run3', 'dead', 'deadTwitch', 'squash', 'hit'] as const;
export const POOF_LOOKS = ['poof0', 'poof1', 'poof2', 'poof3'] as const;

/** The sheets: World 1's four kinds and the poof. */
export const ENEMY_LOOKS = { alacran: ALACRAN_LOOKS, zopilote: ZOPILOTE_LOOKS, cactus: CACTUS_LOOKS, tlacuache: TLACUACHE_LOOKS, poof: POOF_LOOKS } as const;
export type Sheet = keyof typeof ENEMY_LOOKS;
export const SHEETS: readonly Sheet[] = ['alacran', 'zopilote', 'cactus', 'tlacuache', 'poof'];
/** World 1's kinds, which have a sheet of their own (World 2's are drawn by `mercadoEnemies.ts`). */
export type World1Kind = Exclude<Sheet, 'poof'>;
export const isWorld1 = (kind: EnemyKind): kind is World1Kind => kind === 'alacran' || kind === 'zopilote' || kind === 'cactus' || kind === 'tlacuache';
export type EnemyLook = (typeof ENEMY_LOOKS)[Sheet][number];

/** The frame of `look` in `sheet`'s sheet. */
export const lookFrame = (sheet: Sheet, look: EnemyLook): number => (ENEMY_LOOKS[sheet] as readonly EnemyLook[]).indexOf(look);

/** The look a frame of `sheet`'s sheet shows, to read back what was drawn (L-010): `lookFrame`'s inverse. */
export const frameLook = (sheet: Sheet, frame: number): EnemyLook => ENEMY_LOOKS[sheet][frame]!;
