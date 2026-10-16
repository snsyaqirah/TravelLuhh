// Module-level GPU resource cache shared by every iso canvas. Materials and geometries are built once per
// key and disposed when the last canvas unmounts (IsoCanvas calls retain/release).
import type { BufferGeometry, Material, Texture } from 'three';

type Disposable = BufferGeometry | Material | Texture;

const store = new Map<string, Disposable>();
let users = 0;

/** Get or build a cached resource. Keys are namespaced by the caller, e.g. `mat:face|#D8A93B|light|1`. */
export function cached<T extends Disposable>(key: string, create: () => T): T {
  const hit = store.get(key);
  if (hit) return hit as T;
  const made = create();
  store.set(key, made);
  return made;
}

/** Called by each canvas on mount. */
export function retainIsoResources(): void {
  users += 1;
}

/** Called by each canvas on unmount; the last one out frees every cached GPU resource. */
export function releaseIsoResources(): void {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  store.forEach((r) => r.dispose());
  store.clear();
}

/** For tests and the dev kit. */
export function isoResourceCount(): number {
  return store.size;
}
