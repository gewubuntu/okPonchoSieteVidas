// GDD-TEC-09: the types of `sim-version.mjs`, for `vite.config.ts`.
export interface SimFile {
  readonly path: string;
  readonly text: string;
}
export declare const inSimulation: (path: string) => boolean;
export declare function simVersion(files: readonly SimFile[]): string;
export declare function readSimFiles(root?: string): SimFile[];
export declare const currentSimVersion: (root?: string) => string;
