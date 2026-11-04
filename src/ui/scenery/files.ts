// GDD-ART-06: the image files of each art set (`scripts/art/make-desert.mjs`, `scripts/art/make-mercado.mjs`), as URLs Vite serves. Only
// the files of the level's world are loaded (GDD-TEC-03).
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
import type { ArtSet } from './looks';

export interface ArtFiles {
  /** The sky's dither strips, one frame per strip. */
  readonly skyStrips: string;
  readonly sun: string | null;
  readonly clouds: readonly string[];
  /** The far band (World 1's mountains, World 2's hill town), the mid band (the far desert strip, the rooftops) and World 2's arena plaza. */
  readonly far: string;
  readonly mid: string;
  readonly plaza: string | null;
  /** The ground sheet, 28 frames in `groundFrame`'s layout, and the decor sheet, one frame per kind. */
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
};
