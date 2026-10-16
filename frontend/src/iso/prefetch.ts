// Lazy entry to the 3D world. The only path from page code to three.js is this dynamic import.
export type IsoRegistryModule = typeof import('@/iso/scenes/registry');

let registryModule: IsoRegistryModule | null = null;
let registryPromise: Promise<IsoRegistryModule> | null = null;

/** The registry if it has already loaded (lets a second stage mount its canvas without waiting a tick). */
export function loadedIsoRegistry(): IsoRegistryModule | null {
  return registryModule;
}

/** Start loading three + r3f + the scene registry, e.g. on requestIdleCallback after login. */
export function prefetchIsoScenes(): Promise<IsoRegistryModule> {
  if (!registryPromise) {
    registryPromise = import('@/iso/scenes/registry').then((m) => {
      registryModule = m;
      return m;
    });
    registryPromise.catch(() => {
      registryPromise = null; // allow a later retry after a chunk error
    });
  }
  return registryPromise;
}
