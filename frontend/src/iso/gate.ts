// WebGL gate and render tier (§7.8). Any failure means SVG twins only for the rest of the session, except the
// user's own setting, which is read live so the Me page toggle applies at once.
// Pure decision logic (evaluateGate, tierFor, dprFor) is separated from browser reads for testing.
import type { IsoTier } from '@/iso/types';

export type Pref3D = 'auto' | 'off';
export type GateReason = 'pref-off' | 'save-data' | 'no-webgl' | 'env-disabled' | 'context-lost' | 'render-error';

export type GateResult = { ok: true; tier: IsoTier } | { ok: false; reason: GateReason };

export const PREF_3D_KEY = 'travelluhh_pref_3d';
const PREF_EVENT = 'travelluhh:pref3d';

/** In-tab fallback when localStorage is blocked. */
let memoryPref: Pref3D | null = null;

export interface GateEnv {
  pref: Pref3D;
  saveData: boolean;
  /** Lazily probes; only called when the earlier checks pass. */
  probeWebGL: () => boolean;
  /** Raw VITE_ENABLE_3D value. */
  envFlag: string | undefined;
  hardwareConcurrency: number | undefined;
  deviceMemory: number | undefined;
}

/** Checked in the spec's order: user setting, Save-Data, WebGL probe, build flag. */
export function evaluateGate(env: GateEnv): GateResult {
  if (env.pref === 'off') return { ok: false, reason: 'pref-off' };
  if (env.saveData) return { ok: false, reason: 'save-data' };
  if (!env.probeWebGL()) return { ok: false, reason: 'no-webgl' };
  if (env.envFlag === 'false') return { ok: false, reason: 'env-disabled' };
  return { ok: true, tier: tierFor(env.hardwareConcurrency, env.deviceMemory) };
}

/** lite when both CPU cores and memory are small. Unknown values (Safari, Firefox) never force lite. */
export function tierFor(cores: number | undefined, memoryGb: number | undefined): IsoTier {
  return cores !== undefined && memoryGb !== undefined && cores <= 4 && memoryGb <= 4 ? 'lite' : 'high';
}

/** Canvas DPR range per tier. */
export function dprFor(tier: IsoTier, touch: boolean): number | [number, number] {
  if (tier === 'lite') return 1;
  return touch ? [1, 1.5] : [1, 1.75];
}

// ---- user preference (localStorage, always try/catch) ----

export function get3DPreference(): Pref3D {
  try {
    return localStorage.getItem(PREF_3D_KEY) === 'off' ? 'off' : 'auto';
  } catch {
    return memoryPref ?? 'auto';
  }
}

/** For the Me page ("3D scenes: Auto / Off"). Mounted stages switch immediately. */
export function set3DPreference(pref: Pref3D): void {
  try {
    if (pref === 'auto') localStorage.removeItem(PREF_3D_KEY);
    else localStorage.setItem(PREF_3D_KEY, pref);
  } catch {
    // storage blocked: memoryPref and the event below still update this tab
  }
  memoryPref = pref;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PREF_EVENT, { detail: pref }));
}


export function subscribe3DPreference(fn: (pref: Pref3D) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onPref = (e: Event) => fn((e as CustomEvent<Pref3D>).detail);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PREF_3D_KEY) fn(get3DPreference());
  };
  window.addEventListener(PREF_EVENT, onPref);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PREF_EVENT, onPref);
    window.removeEventListener('storage', onStorage);
  };
}

// ---- browser reads, cached for the session ----

interface NavigatorExtras {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
}

/**
 * WebGL2 only: three r163+ (we ship 0.170) creates nothing but WebGL2 contexts, so a WebGL1-only device passing
 * the probe would just crash the canvas later.
 */
export function probeWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const opts: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true };
    const gl = canvas.getContext('webgl2', opts) as WebGL2RenderingContext | null;
    if (!gl) return false;
    // Free the probe context straight away; browsers cap live contexts at ~16.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

let probeCache: boolean | null = null;
let sessionFailure: GateReason | null = null;
let contextLosses = 0;

function readEnv(): GateEnv {
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & NavigatorExtras;
  return {
    pref: get3DPreference(),
    saveData: !!nav.connection?.saveData,
    probeWebGL: () => {
      if (probeCache === null) probeCache = probeWebGL();
      return probeCache;
    },
    envFlag: import.meta.env.VITE_ENABLE_3D as string | undefined,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
  };
}

/** The live gate: user pref re-read every call; hardware/probe/context-loss failures stick for the session. */
export function get3DGate(): GateResult {
  const env = readEnv();
  if (env.pref === 'off') return { ok: false, reason: 'pref-off' };
  if (sessionFailure) return { ok: false, reason: sessionFailure };
  const result = evaluateGate(env);
  if ('reason' in result && result.reason !== 'pref-off') sessionFailure = result.reason;
  return result;
}

/** Record a lost WebGL context. Returns true when one retry is still allowed this session. */
export function noteContextLost(): boolean {
  contextLosses += 1;
  if (contextLosses > 1) {
    sessionFailure = 'context-lost';
    return false;
  }
  return true;
}

/**
 * The canvas or a scene threw while mounting or rendering (e.g. the WebGL2 context couldn't be created after
 * all). Stages fall back to their SVG twins for the rest of the session.
 */
export function note3DFailure(): void {
  sessionFailure = 'render-error';
}

const CHUNK_ERROR = /dynamically imported module|importing a module script failed|loading (css )?chunk|error loading dynamically/i;

/** A scene chunk that failed to download (flaky network): that stage stays flat, the session keeps 3D. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'ChunkLoadError' || CHUNK_ERROR.test(error.message);
}

export function isTouchDevice(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/** Test helper: forget cached probe results and session failures. */
export function resetGateForTests(): void {
  probeCache = null;
  sessionFailure = null;
  contextLosses = 0;
  memoryPref = null;
}
