/// <reference types="vite/client" />

declare module 'virtual:vcpl-build-meta' {
  export interface VcplBuildMetadata {
    stableVersion: string;
    nextGenVersion: string;
    buildHash: string;
    toolCount: number;
    lastUpdatedIso: string;
    lastUpdatedDateIst: string;
    lastUpdatedTimeIst: string;
  }

  export const vcplBuildMeta: VcplBuildMetadata;
}
