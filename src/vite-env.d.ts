/// <reference types="vite/client" />

declare module 'virtual:vcpl-build-meta' {
  export interface ToolBuildStamp {
    version: string;
    hash: string;
    lastUpdatedIso: string;
    lastUpdatedDateIst: string;
    lastUpdatedTimeIst: string;
  }

  export interface VcplBuildMetadata {
    stableVersion: string;
    nextGenVersion: string;
    buildHash: string;
    toolCount: number;
    lastUpdatedIso: string;
    lastUpdatedDateIst: string;
    lastUpdatedTimeIst: string;
    toolMetaByKind: Record<string, ToolBuildStamp>;
  }

  export const vcplBuildMeta: VcplBuildMetadata;
}
