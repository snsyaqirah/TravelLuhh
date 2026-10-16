// Packed items (§7.6 #11): rounded fabric bricks, one InstancedMesh per fabric tone; documents are a thin
// passport slab. Positions are base centres (items stand on y).
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Matrix4, type InstancedMesh } from 'three';
import type { FabricKey } from '@/design/tokens';
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { packedBoxGeo, passportSlabGeo } from '@/iso/primitives/geometries';
import { PACKED } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

export interface PackedItem {
  /** Base centre. */
  at: Vec3;
  tone: FabricKey;
  /** Small seeded twist so a full case doesn't look machine-stacked. */
  rotY?: number;
}

const rot = new Matrix4();
const mtx = new Matrix4();

function ToneInstances({ items, tone }: { items: PackedItem[]; tone: FabricKey }) {
  const { theme, palette } = useIso();
  const ref = useRef<InstancedMesh>(null);
  const slab = tone === 'passport';
  const geo = slab ? passportSlabGeo() : packedBoxGeo();
  const h = slab ? PACKED.slab[1] : PACKED.box[1];
  const mat = faceToneMaterial(palette.fabric[tone], theme, { curved: !slab });
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      mtx.makeTranslation(it.at[0], it.at[1] + h / 2, it.at[2]).multiply(rot.makeRotationY(it.rotY ?? 0));
      mesh.setMatrixAt(i, mtx);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [items, h, mat]);
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} />;
}

export function PackedItems({ items }: { items: PackedItem[] }) {
  const byTone = useMemo(() => {
    const map = new Map<FabricKey, PackedItem[]>();
    for (const it of items) {
      const list = map.get(it.tone);
      if (list) list.push(it);
      else map.set(it.tone, [it]);
    }
    return [...map.entries()];
  }, [items]);
  return (
    <group>
      {byTone.map(([tone, list]) => (
        <ToneInstances key={tone} tone={tone} items={list} />
      ))}
    </group>
  );
}
