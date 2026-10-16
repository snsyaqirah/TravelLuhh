import {
  PREF_3D_KEY,
  dprFor,
  evaluateGate,
  get3DGate,
  get3DPreference,
  noteContextLost,
  resetGateForTests,
  set3DPreference,
  subscribe3DPreference,
  tierFor,
  type GateEnv,
} from '@/iso/gate';

const env = (o: Partial<GateEnv> = {}): GateEnv => ({
  pref: 'auto',
  saveData: false,
  probeWebGL: () => true,
  envFlag: undefined,
  hardwareConcurrency: 8,
  deviceMemory: 8,
  ...o,
});

describe('evaluateGate (spec order)', () => {
  it('passes on a capable device', () => {
    expect(evaluateGate(env())).toEqual({ ok: true, tier: 'high' });
  });
  it('user setting off wins before anything is probed', () => {
    const probe = vi.fn(() => true);
    expect(evaluateGate(env({ pref: 'off', saveData: true, probeWebGL: probe }))).toEqual({ ok: false, reason: 'pref-off' });
    expect(probe).not.toHaveBeenCalled();
  });
  it('Save-Data comes next and skips the probe', () => {
    const probe = vi.fn(() => true);
    expect(evaluateGate(env({ saveData: true, probeWebGL: probe }))).toEqual({ ok: false, reason: 'save-data' });
    expect(probe).not.toHaveBeenCalled();
  });
  it('then the WebGL probe', () => {
    expect(evaluateGate(env({ probeWebGL: () => false, envFlag: 'false' }))).toEqual({ ok: false, reason: 'no-webgl' });
  });
  it('then VITE_ENABLE_3D=false', () => {
    expect(evaluateGate(env({ envFlag: 'false' }))).toEqual({ ok: false, reason: 'env-disabled' });
    expect(evaluateGate(env({ envFlag: 'true' })).ok).toBe(true);
  });
  it('picks lite on small devices', () => {
    expect(evaluateGate(env({ hardwareConcurrency: 4, deviceMemory: 4 }))).toEqual({ ok: true, tier: 'lite' });
  });
});

describe('tierFor / dprFor', () => {
  it('needs both cores and memory to be small', () => {
    expect(tierFor(4, 4)).toBe('lite');
    expect(tierFor(2, 8)).toBe('high');
    expect(tierFor(8, 2)).toBe('high');
    expect(tierFor(4, undefined)).toBe('high'); // Safari/Firefox: no deviceMemory
  });
  it('DPR per tier and pointer', () => {
    expect(dprFor('lite', true)).toBe(1);
    expect(dprFor('high', true)).toEqual([1, 1.5]);
    expect(dprFor('high', false)).toEqual([1, 1.75]);
  });
});

describe('live gate with a mocked navigator', () => {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  let getContext: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGateForTests();
    localStorage.clear();
    getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => ({ getExtension: () => ({ loseContext() {} }) }) as unknown as RenderingContext);
    Object.defineProperty(nav, 'hardwareConcurrency', { value: 8, configurable: true });
    Object.defineProperty(nav, 'deviceMemory', { value: 8, configurable: true });
    Object.defineProperty(nav, 'connection', { value: { saveData: false }, configurable: true });
  });
  afterEach(() => {
    getContext.mockRestore();
  });

  it('probes once per session and caches the answer', () => {
    expect(get3DGate()).toEqual({ ok: true, tier: 'high' });
    expect(get3DGate().ok).toBe(true);
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledWith('webgl2', { failIfMajorPerformanceCaveat: true });
  });

  it('falls back to webgl1 when webgl2 is missing', () => {
    getContext.mockImplementation(((kind: string) =>
      kind === 'webgl' ? ({ getExtension: () => null } as unknown as RenderingContext) : null) as never);
    expect(get3DGate().ok).toBe(true);
  });

  it('a failed probe sticks for the session', () => {
    getContext.mockImplementation(() => null);
    expect(get3DGate()).toEqual({ ok: false, reason: 'no-webgl' });
    getContext.mockImplementation(() => ({ getExtension: () => null }) as unknown as RenderingContext);
    expect(get3DGate()).toEqual({ ok: false, reason: 'no-webgl' });
  });

  it('honours Save-Data', () => {
    Object.defineProperty(nav, 'connection', { value: { saveData: true }, configurable: true });
    expect(get3DGate()).toEqual({ ok: false, reason: 'save-data' });
  });

  it('reads lite tier from the navigator', () => {
    Object.defineProperty(nav, 'hardwareConcurrency', { value: 4, configurable: true });
    Object.defineProperty(nav, 'deviceMemory', { value: 2, configurable: true });
    expect(get3DGate()).toEqual({ ok: true, tier: 'lite' });
  });

  it('the user setting is live, stored, and broadcast', () => {
    const seen: string[] = [];
    const off = subscribe3DPreference((p) => seen.push(p));
    expect(get3DPreference()).toBe('auto');
    set3DPreference('off');
    expect(localStorage.getItem(PREF_3D_KEY)).toBe('off');
    expect(get3DGate()).toEqual({ ok: false, reason: 'pref-off' });
    set3DPreference('auto');
    expect(localStorage.getItem(PREF_3D_KEY)).toBeNull();
    expect(get3DGate().ok).toBe(true);
    expect(seen).toEqual(['off', 'auto']);
    off();
  });

  it('survives blocked storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const spy2 = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(get3DPreference()).toBe('auto');
    set3DPreference('off');
    expect(get3DPreference()).toBe('off');
    spy.mockRestore();
    spy2.mockRestore();
  });

  it('allows one context-loss retry, then SVG for the session', () => {
    expect(noteContextLost()).toBe(true);
    expect(get3DGate().ok).toBe(true);
    expect(noteContextLost()).toBe(false);
    expect(get3DGate()).toEqual({ ok: false, reason: 'context-lost' });
  });
});
