// GDD-ART-04: the looks of Poncho's sheet and of his item sheets, in sheet order: `PONCHO_LOOKS` is scripts/art/make-sprites.mjs's,
// the item sheets' are the LOOKS of scripts/art/poncho/items.mjs (tests compare them). A look's frame is its index here.

export const PONCHO_LOOKS = [
  'idle', 'run0', 'run1', 'run2', 'run3', 'blink', 'glance', 'jump0', 'jump1', 'apex', 'fall0', 'fall1', 'land', 'skid',
  'flip0', 'flip1', 'flip2', 'flip3', 'flip4', 'flip5', 'flip6', 'flip7',
  'clawWind', 'clawSwipe', 'clawFollow', 'hurt0', 'hurt1', 'eat0', 'eat1', 'spit0', 'spit1',
] as const;
export type PonchoLook = (typeof PONCHO_LOOKS)[number];

/** The pickups (GDD-PWR-02, GDD-PWR-03), what he holds, the claw swipe (GDD-CMB-02) and the effects at his mouth, one sheet each. */
export const ITEM_LOOKS = {
  taco: ['tacoBob0', 'tacoBob1', 'tacoBob2', 'tacoBob3', 'tacoGlint', 'tacoBitten'],
  chile: ['chileBob0', 'chileBob1', 'chileBob2', 'chileBob3', 'chileGlint'],
  held: ['tacoHeld', 'chileHeld', 'tacoFood', 'chileFood', 'tacoBittenHeld'],
  swipe: ['swipe0', 'swipe1', 'swipe2', 'swipe3'],
  fx: ['flame0', 'flame1', 'crumbs0', 'crumbs1'],
} as const;
export type ItemSheet = keyof typeof ITEM_LOOKS;
export const ITEM_SHEETS: readonly ItemSheet[] = ['taco', 'chile', 'held', 'swipe', 'fx'];
export type HeldLook = (typeof ITEM_LOOKS.held)[number];
export type SwipeLook = (typeof ITEM_LOOKS.swipe)[number];
export type FxLook = (typeof ITEM_LOOKS.fx)[number];
export type PickupLook = (typeof ITEM_LOOKS.taco)[number] | (typeof ITEM_LOOKS.chile)[number];
export type ItemLook = (typeof ITEM_LOOKS)[ItemSheet][number];

/** The frame of `look` in Poncho's sheet. */
export const ponchoFrame = (look: PonchoLook): number => PONCHO_LOOKS.indexOf(look);

/** The look a frame of Poncho's sheet shows, to read back what was drawn (L-010): `ponchoFrame`'s inverse. */
export const ponchoLookAt = (frame: number): PonchoLook => PONCHO_LOOKS[frame]!;

/** The frame of `look` in `sheet`'s sheet. */
export const itemFrame = (sheet: ItemSheet, look: ItemLook): number => (ITEM_LOOKS[sheet] as readonly ItemLook[]).indexOf(look);

/** The look a frame of `sheet`'s sheet shows (L-010): `itemFrame`'s inverse. */
export const itemLookAt = (sheet: ItemSheet, frame: number): ItemLook => ITEM_LOOKS[sheet][frame]!;
