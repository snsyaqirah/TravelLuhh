import { describe, expect, it } from 'vitest';
import {
  clearDraft,
  daysNightsLabel,
  DRAFT_KEY,
  EMPTY_DRAFT,
  firstInvalidStep,
  isDraftTouched,
  loadDraft,
  resumeStep,
  saveDraft,
  savingPlan,
  suggestName,
  toCreateRequest,
  validateStep,
  withDates,
  withDestination,
  withName,
  type CreateDraft,
} from './createDraft';

const HOME = 'MYR';

function memoryStorage(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
}

const full: CreateDraft = {
  ...EMPTY_DRAFT,
  step: 4,
  destinationCountry: 'JP',
  startDate: '2026-11-12',
  endDate: '2026-11-20',
  name: 'Tokyo 9D8N',
  budgetType: 'shared',
  budget: '4,000',
  saved: '300',
};

describe('names and labels', () => {
  it('suggests "<Capital> 9D8N" once there are dates', () => {
    expect(suggestName('JP', null, null)).toBe('Tokyo');
    expect(suggestName('JP', '2026-11-12', '2026-11-20')).toBe('Tokyo 9D8N');
    expect(suggestName('TH', '2026-08-14', '2026-08-14')).toBe('Bangkok 1D');
    expect(suggestName(null, '2026-08-14', '2026-08-17')).toBe('');
  });

  it('keeps refreshing the suggestion until the traveller types their own name', () => {
    let d = withDestination(EMPTY_DRAFT, 'kr');
    expect(d.destinationCountry).toBe('KR');
    expect(d.name).toBe('Seoul');
    d = withDates(d, '2026-12-18', '2026-12-24');
    expect(d.name).toBe('Seoul 7D6N');
    d = withName(d, 'Seoul winter');
    d = withDestination(d, 'JP');
    expect(d.name).toBe('Seoul winter');
    // clearing the field hands it back to the suggestion
    d = withName(d, '');
    d = withDates(d, '2026-11-12', '2026-11-20');
    expect(d.name).toBe('Tokyo 9D8N');
  });

  it('drops a destination currency when the destination changes', () => {
    const d = withDestination({ ...EMPTY_DRAFT, destinationCountry: 'JP', currency: 'JPY' }, 'KR');
    expect(d.currency).toBeNull();
  });

  it('says days and nights', () => {
    expect(daysNightsLabel(9)).toBe('9 days, 8 nights');
    expect(daysNightsLabel(2)).toBe('2 days, 1 night');
    expect(daysNightsLabel(1)).toBe('1 day');
    expect(daysNightsLabel(0)).toBe('');
  });
});

describe('validateStep', () => {
  it('step 1 needs a known destination', () => {
    expect(validateStep(EMPTY_DRAFT, 1, HOME).destinationCountry).toBe("Pick where you're going.");
    expect(validateStep({ ...EMPTY_DRAFT, destinationCountry: 'XX' }, 1, HOME).destinationCountry).toBeTruthy();
    expect(validateStep({ ...EMPTY_DRAFT, destinationCountry: 'JP' }, 1, HOME)).toEqual({});
  });

  it('step 2 needs dates in order, at most a year, and a name', () => {
    const e = validateStep({ ...full, startDate: null, endDate: null, name: ' ' }, 2, HOME);
    expect(e.dates).toMatch(/first day/);
    expect(e.name).toBe('Give the trip a name.');
    expect(validateStep({ ...full, startDate: '2026-11-20', endDate: '2026-11-12' }, 2, HOME).dates).toMatch(/on or after/);
    expect(validateStep({ ...full, startDate: '2026-01-01', endDate: '2027-03-01' }, 2, HOME).dates).toMatch(/up to a year/);
    expect(validateStep({ ...full, name: 'x'.repeat(101) }, 2, HOME).name).toMatch(/under 100/);
    expect(validateStep(full, 2, HOME)).toEqual({});
    // a day trip is fine
    expect(validateStep({ ...full, endDate: full.startDate }, 2, HOME)).toEqual({});
  });

  it('step 3 needs who is coming', () => {
    expect(validateStep({ ...full, budgetType: null }, 3, HOME).budgetType).toBeTruthy();
    expect(validateStep(full, 3, HOME)).toEqual({});
  });

  it('step 4 needs a positive, readable budget; already-saved is optional', () => {
    expect(validateStep({ ...full, budget: '' }, 4, HOME).budget).toMatch(/how much/);
    expect(validateStep({ ...full, budget: 'abc' }, 4, HOME).budget).toMatch(/doesn't look like an amount/);
    expect(validateStep({ ...full, budget: '0' }, 4, HOME).budget).toMatch(/more than zero/);
    expect(validateStep({ ...full, budget: '-5' }, 4, HOME).budget).toMatch(/more than zero/);
    expect(validateStep({ ...full, budget: '99999999999' }, 4, HOME).budget).toMatch(/more than we can count/);
    expect(validateStep({ ...full, budget: 'RM 4,000.50' }, 4, HOME)).toEqual({});
    expect(validateStep({ ...full, saved: '' }, 4, HOME)).toEqual({});
    expect(validateStep({ ...full, saved: 'lots' }, 4, HOME).saved).toBeTruthy();
    expect(validateStep({ ...full, saved: '-1' }, 4, HOME).saved).toMatch(/leave it empty/);
  });

  it('finds the first incomplete step for the final check', () => {
    expect(firstInvalidStep(EMPTY_DRAFT, HOME)).toBe(1);
    expect(firstInvalidStep({ ...full, budgetType: null }, HOME)).toBe(3);
    expect(firstInvalidStep(full, HOME)).toBeNull();
  });
});

describe('toCreateRequest', () => {
  it('builds the contract body in the chosen trip currency, with the derived season', () => {
    expect(toCreateRequest(full, HOME)).toEqual({
      name: 'Tokyo 9D8N',
      destinationCountry: 'JP',
      startDate: '2026-11-12',
      endDate: '2026-11-20',
      budget: 4000,
      currency: 'MYR',
      budgetType: 'shared',
      season: 'autumn',
    });
    const jpy = toCreateRequest({ ...full, currency: 'JPY', budget: '155,000.4', season: 'winter' }, HOME);
    expect(jpy.currency).toBe('JPY');
    expect(jpy.budget).toBe(155000);
    expect(jpy.season).toBe('winter');
  });
});

describe('savingPlan', () => {
  const today = new Date(2026, 9, 16);
  it('splits what is still to save over the whole weeks before departure', () => {
    // 27 days away → 3 weeks; RM 4,000 − RM 300 = RM 3,700 → RM 1,234 a week (rounded up)
    expect(savingPlan(full, HOME, today)).toEqual({ perWeek: 1234, weeks: 3, until: '2026-11-12', currency: 'MYR' });
  });
  it('stays quiet within two weeks of the trip, without a budget, or when the jar is already full', () => {
    expect(savingPlan({ ...full, startDate: '2026-10-29', endDate: '2026-11-02' }, HOME, today)).toBeNull();
    expect(savingPlan({ ...full, budget: '' }, HOME, today)).toBeNull();
    expect(savingPlan({ ...full, saved: '4000' }, HOME, today)).toBeNull();
  });
});

describe('draft persistence', () => {
  it('round-trips through storage and clears', () => {
    const store = memoryStorage();
    saveDraft(full, store);
    expect(store.data.has(DRAFT_KEY)).toBe(true);
    expect(loadDraft(store)).toEqual(full);
    clearDraft(store);
    expect(loadDraft(store)).toBeNull();
  });

  it('ignores corrupt, foreign-version or tampered drafts', () => {
    const store = memoryStorage();
    store.setItem(DRAFT_KEY, '{not json');
    expect(loadDraft(store)).toBeNull();
    store.setItem(DRAFT_KEY, JSON.stringify({ ...full, v: 2 }));
    expect(loadDraft(store)).toBeNull();
    store.setItem(DRAFT_KEY, JSON.stringify({ ...full, step: 9 }));
    expect(loadDraft(store)).toBeNull();
    store.setItem(DRAFT_KEY, JSON.stringify({ ...full, startDate: 'next week' }));
    expect(loadDraft(store)).toBeNull();
    store.setItem(DRAFT_KEY, JSON.stringify({ ...full, destinationCountry: 'XX', budgetType: 'everyone', season: 'monsoon' }));
    const d = loadDraft(store);
    expect(d?.destinationCountry).toBeNull();
    expect(d?.budgetType).toBeNull();
    expect(d?.season).toBeNull();
  });

  it('survives storage that throws (private mode, blocked site data)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => saveDraft(full, throwing)).not.toThrow();
    expect(loadDraft(throwing)).toBeNull();
    expect(() => clearDraft(throwing)).not.toThrow();
    expect(loadDraft(null)).toBeNull();
  });

  it('resumes at the saved step, but never past a step whose inputs are missing', () => {
    expect(resumeStep(full, HOME)).toBe(4);
    expect(resumeStep({ ...full, step: 5, budgetType: null }, HOME)).toBe(3);
    expect(resumeStep({ ...EMPTY_DRAFT, step: 3 }, HOME)).toBe(1);
  });

  it('only counts a draft as worth keeping once something is filled in', () => {
    expect(isDraftTouched(EMPTY_DRAFT)).toBe(false);
    expect(isDraftTouched({ ...EMPTY_DRAFT, destinationCountry: 'JP' })).toBe(true);
  });
});
