// GDD-ART-06: the image files of each art set (`scripts/art/make-desert.mjs`, `scripts/art/make-mercado.mjs`, `scripts/art/make-sierra.mjs`),
// as URLs Vite serves. Only the files of the level's world, and in World 3 of its place, are loaded (GDD-TEC-03).
import desiertoSkyStrips from '../../../assets/sprites/desierto/sky-strips.png';
import desiertoSun from '../../../assets/sprites/desierto/sun.png';
import desiertoCloud0 from '../../../assets/sprites/desierto/cloud-0.png';
import desiertoCloud1 from '../../../assets/sprites/desierto/cloud-1.png';
import desiertoCloud2 from '../../../assets/sprites/desierto/cloud-2.png';
import desiertoCloud3 from '../../../assets/sprites/desierto/cloud-3.png';
import desiertoMountains from '../../../assets/sprites/desierto/mountains.png';
import desiertoFarDesert from '../../../assets/sprites/desierto/far-desert.png';
import desiertoGround from '../../../assets/sprites/desierto/ground.png';
import desiertoPlants from '../../../assets/sprites/desierto/plants.png';
import mercadoSkyStrips from '../../../assets/sprites/mercado/sky-strips.png';
import mercadoCloud0 from '../../../assets/sprites/mercado/cloud-0.png';
import mercadoCloud1 from '../../../assets/sprites/mercado/cloud-1.png';
import mercadoCloud2 from '../../../assets/sprites/mercado/cloud-2.png';
import mercadoFarTown from '../../../assets/sprites/mercado/far-town.png';
import mercadoMidRoofs from '../../../assets/sprites/mercado/mid-roofs.png';
import mercadoPlaza from '../../../assets/sprites/mercado/plaza.png';
import mercadoGround from '../../../assets/sprites/mercado/ground.png';
import mercadoDecor from '../../../assets/sprites/mercado/decor.png';
import sierraSkyStrips from '../../../assets/sprites/sierra/sky-strips.png';
import sierraCloud0 from '../../../assets/sprites/sierra/cloud-0.png';
import sierraCloud1 from '../../../assets/sprites/sierra/cloud-1.png';
import sierraCloud2 from '../../../assets/sprites/sierra/cloud-2.png';
import sierraFarBarranca from '../../../assets/sprites/sierra/far-barranca.png';
import sierraMidBarranca from '../../../assets/sprites/sierra/mid-barranca.png';
import sierraGround from '../../../assets/sprites/sierra/ground.png';
import sierraDecor from '../../../assets/sprites/sierra/decor.png';
import minaSkyStrip from '../../../assets/sprites/sierra/sky-mina.png';
import minaFar from '../../../assets/sprites/sierra/far-mina.png';
import minaMid from '../../../assets/sprites/sierra/mid-mina.png';
import minaGround from '../../../assets/sprites/sierra/ground-mina.png';
import minaDecor from '../../../assets/sprites/sierra/decor-mina.png';
import type { ArtSet, Place } from './looks';

export interface ArtFiles {
  /** The sky's dither strips, one frame per strip. */
  readonly skyStrips: string;
  readonly sun: string | null;
  readonly clouds: readonly string[];
  /** The far band (World 1's mountains, World 2's hill town), the mid band (the far desert strip, the rooftops) and World 2's arena plaza. */
  readonly far: string;
  readonly mid: string;
  readonly plaza: string | null;
  /** The ground sheet, 28 frames in `groundFrame`'s layout (the mine's 7 more after them, `mineGroundFrame`), and the decor sheet, one frame per kind. */
  readonly ground: string;
  readonly decor: string;
}

export const FILES: Readonly<Record<ArtSet, ArtFiles>> = {
  desierto: {
    skyStrips: desiertoSkyStrips,
    sun: desiertoSun,
    clouds: [desiertoCloud0, desiertoCloud1, desiertoCloud2, desiertoCloud3],
    far: desiertoMountains,
    mid: desiertoFarDesert,
    plaza: null,
    ground: desiertoGround,
    decor: desiertoPlants,
  },
  mercado: {
    skyStrips: mercadoSkyStrips,
    sun: null,
    clouds: [mercadoCloud0, mercadoCloud1, mercadoCloud2],
    far: mercadoFarTown,
    mid: mercadoMidRoofs,
    plaza: mercadoPlaza,
    ground: mercadoGround,
    decor: mercadoDecor,
  },
  sierra: {
    skyStrips: sierraSkyStrips,
    sun: null,
    clouds: [sierraCloud0, sierraCloud1, sierraCloud2],
    far: sierraFarBarranca,
    mid: sierraMidBarranca,
    plaza: null,
    ground: sierraGround,
    decor: sierraDecor,
  },
};

/** GDD-ART-06: the mine's images (`scripts/art/sierra-mina.mjs`): the roof band's dither strip, no sun and no clouds. */
const MINA_FILES: ArtFiles = {
  skyStrips: minaSkyStrip,
  sun: null,
  clouds: [],
  far: minaFar,
  mid: minaMid,
  plaza: null,
  ground: minaGround,
  decor: minaDecor,
};

/** GDD-ART-06, GDD-TEC-03: the files a level of art set `set` in `place` loads: the mine's in the mine, else its set's. */
export const artFiles = (set: ArtSet, place: Place | null): ArtFiles => (place === 'mina' ? MINA_FILES : FILES[set]);
