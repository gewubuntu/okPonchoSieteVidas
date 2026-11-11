// GDD-WLD-05, GDD-UI-03: how a crumbling tile is drawn in each state, for both its dresses (the sandy placeholder and World 3's rock
// ledge, GDD-ART-06). Pure, no Phaser, so the shake and the flash are unit-tested.
import type { CrumbleState } from '../sim/crumble';

/** Where and how a crumbling tile is drawn: moved `dx` px sideways, in its frame (0 at rest, 1 its pale flash), or not at all. */
export interface CrumbleLook {
  readonly dx: number;
  readonly frame: 0 | 1;
  readonly visible: boolean;
}

/**
 * GDD-WLD-05: at rest it is still; in its warning it shakes 1 px left and right in turn, two steps each way, and flashes pale for 4 steps
 * of every 8, counted on its steps left (movement and colour, GDD-UI-03); gone, it is not drawn.
 */
export function crumbleLook(state: CrumbleState): CrumbleLook {
  if (state.phase === 'gone') return { dx: 0, frame: 0, visible: false };
  if (state.phase === 'idle') return { dx: 0, frame: 0, visible: true };
  return { dx: state.steps % 4 < 2 ? -1 : 1, frame: state.steps % 8 < 4 ? 1 : 0, visible: true };
}
