import { describe, expect, it } from 'vitest';
import { decorInView, tilesInView } from './view';

// The screen is 480 x 270 game px: 30 columns of 16 px and 16.875 rows. At a scroll of (0, 0) its pixels are columns 0 to 29 and rows 0 to
// 16 (row 16 only its top 14 px); with 2 tiles more on every side, columns -2 to 31 and rows -2 to 18: 34 by 21 tiles.

describe('GDD-TEC-03 the ground drawn', () => {
  it('GDD-TEC-03 the ground drawn is the screen\'s tiles and 2 more on every side', () => {
    expect(tilesInView(0, 0)).toEqual({ col0: -2, col1: 31, row0: -2, row1: 18 });
    // 1 px short of a tile boundary (15, 15): the screen's pixels are x 15 to 494 (columns 0 to 30) and y 15 to 284 (rows 0 to 17).
    expect(tilesInView(15, 15)).toEqual({ col0: -2, col1: 32, row0: -2, row1: 19 });
    // On the boundary (16, 16): x 16 to 495 (columns 1 to 30), y 16 to 285 (rows 1 to 17).
    expect(tilesInView(16, 16)).toEqual({ col0: -1, col1: 32, row0: -1, row1: 19 });
    // 1 px past it (17, 17): x 17 to 496 (columns 1 to 31), y 17 to 286 (rows 1 to 17).
    expect(tilesInView(17, 17)).toEqual({ col0: -1, col1: 33, row0: -1, row1: 19 });
    // A scroll at whole art pixels, a quarter px past a boundary (in 3-1 the camera starts at y 8): x 160.25 to 640.x, y 8 to 277.x.
    expect(tilesInView(160.25, 8)).toEqual({ col0: 8, col1: 42, row0: -2, row1: 19 });
  });

  it('GDD-TEC-03 a decor item counts while any of it is inside the view', () => {
    const view = tilesInView(0, 0); // rows -2 to 18: y -32 to 304
    // A 40 px tall item in column 5: its foot (1 px into its tile) just below the view, its top 1 px inside it.
    expect(decorInView(view, 5, 343, 40)).toBe(true);
    // 1 px lower, all of it is below.
    expect(decorInView(view, 5, 344, 40)).toBe(false);
    // Its foot just under the view's top: in; 40 px higher than that, all of it is above.
    expect(decorInView(view, 5, -31, 40)).toBe(true);
    expect(decorInView(view, 5, -32, 40)).toBe(false);
    // Its column at the view's sides, and one past each.
    expect(decorInView(view, -2, 100, 40)).toBe(true);
    expect(decorInView(view, 31, 100, 40)).toBe(true);
    expect(decorInView(view, -3, 100, 40)).toBe(false);
    expect(decorInView(view, 32, 100, 40)).toBe(false);
  });
});
