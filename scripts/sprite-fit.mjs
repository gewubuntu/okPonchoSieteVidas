// L-059: a character's sprite sheet is drawn against the places the game shows its frames. Every sheet of characters (each folder of
// `assets/sprites/` but the scenery sets', and Poncho's own sheet) needs a test that pins how far its frames reach past their box and
// checks them over the real levels: a test file that cites L-059 and names the sheet's path (`sprites/<folder>` or `sprites/<file>`).

/** Scenery folders: backdrops and tiles, not characters (one per art set, `src/ui/scenery/looks.ts`). */
export const SCENERY = ['desierto', 'mercado', 'sierra'];

/** Sheets that have no fit test yet, each with the reason. None now: Poncho's frames (GDD-ART-04) brought his. */
export const EXEMPT = {};

/**
 * The sheets the rule covers, from the entries of `assets/sprites/` (`{ name, dir }`): every folder but the scenery ones, named with its
 * trailing slash (so `sprites/poncho.png` never counts for the `sprites/poncho/` folder, L-059), and every PNG at its top.
 */
export const sheetsOf = (entries) => entries.filter((e) => (e.dir ? !SCENERY.includes(e.name) : e.name.endsWith('.png'))).map((e) => (e.dir ? `${e.name}/` : e.name));

/** The errors for sheets with no test (`{ path, text }`) that cites L-059 and names them, but the exempt ones. */
export function spriteFitErrors(sheets, tests, exempt = EXEMPT) {
  const citing = tests.filter((t) => /\bL-059\b/.test(t.text));
  return sheets
    .filter((s) => !(s in exempt))
    .filter((s) => !citing.some((t) => t.text.includes(`sprites/${s}`)))
    .map((s) => `assets/sprites/${s}: no test cites L-059 and names it; pin how far its frames reach past their box and check them over the real levels (harness-feature step 5, Sprite frames, L-059)`);
}
