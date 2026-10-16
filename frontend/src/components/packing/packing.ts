// Pure helpers for the Pack tab (§9.6): progress and the checklist grouped by packing category, in the
// suitcase order (documents first, general last). Unknown or empty categories file under General.
import type { PackingItem } from '@/types';
import { PACKING_CATEGORIES, packingCategoryMeta, type PackingCategoryMeta } from '@/data/packing';

export interface PackGroup {
  meta: PackingCategoryMeta;
  items: PackingItem[];
  packed: number;
}

export interface PackProgress {
  packed: number;
  total: number;
  /** 0..1 */
  ratio: number;
  /** Everything ticked, and there is at least one thing to tick. */
  done: boolean;
}

export function packProgress(items: readonly Pick<PackingItem, 'isChecked'>[]): PackProgress {
  const total = items.length;
  const packed = items.reduce((n, i) => n + (i.isChecked ? 1 : 0), 0);
  return { packed, total, ratio: total ? packed / total : 0, done: total > 0 && packed === total };
}

/**
 * Groups in PACKING_CATEGORIES order, empty groups left out. Rows keep the order they were added in, so a
 * ticked row doesn't jump away from your thumb.
 */
export function groupPacking(items: readonly PackingItem[]): PackGroup[] {
  const byKey = new Map<string, PackingItem[]>();
  for (const it of items) {
    const key = packingCategoryMeta(it.category).key;
    const list = byKey.get(key);
    if (list) list.push(it);
    else byKey.set(key, [it]);
  }
  const out: PackGroup[] = [];
  for (const meta of PACKING_CATEGORIES) {
    const list = byKey.get(meta.key);
    if (!list?.length) continue;
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
    out.push({ meta, items: list, packed: list.filter((i) => i.isChecked).length });
  }
  return out;
}

/** '23 / 31 PACKED' */
export const progressText = (p: Pick<PackProgress, 'packed' | 'total'>) => `${p.packed} / ${p.total} packed`;

/** Toast after a quick pack: the server returns only the items it actually added. */
export function presetToast(added: number, label: string): string {
  if (added === 0) return `Everything from the ${label} list is already on yours.`;
  return `Added ${added} ${added === 1 ? 'thing' : 'things'} from the ${label} list.`;
}
