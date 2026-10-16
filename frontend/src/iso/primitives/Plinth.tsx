// Plinth (§7.6 #1). Ground slab over a soil under-layer; `ledger` adds a ruled top (passbook paper).
// Local origin = centre of the top surface, so everything placed on a plinth stands at y = 0.
import { CanvasTexture, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { ThemeName } from '@/design/tokens';
import { useIso } from '@/iso/canvas/context';
import { cached } from '@/iso/material/cache';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { palette3d } from '@/iso/palette3d';
import { IsoEdges } from '@/iso/primitives/Edges';
import { boxGeo, ledgerPlaneGeo } from '@/iso/primitives/geometries';
import { LAYER, PLINTH } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

/** 256² ruled paper, one rule every 16px in --rule. One of the scene's ≤ 2 CanvasTextures. */
function ledgerMaterial(theme: ThemeName): MeshBasicMaterial {
  return cached(`mat:ledger|${theme}`, () => {
    const p = palette3d(theme);
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = p.ground;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = p.rule;
      for (let y = 15; y < size; y += 16) ctx.fillRect(0, y, size, 2);
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.anisotropy = 4;
    return new MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: 0.5, polygonOffsetUnits: 0.5 });
  });
}

export interface PlinthProps {
  w: number;
  d: number;
  variant?: 'plain' | 'ledger';
  position?: Vec3;
}

export function Plinth({ w, d, variant = 'plain', position }: PlinthProps) {
  const { theme, tier, palette } = useIso();
  const top = boxGeo(w, PLINTH.topH, d);
  const under = boxGeo(w - PLINTH.underInset, PLINTH.underH, d - PLINTH.underInset);
  const topY = -PLINTH.topH / 2;
  return (
    <group position={position}>
      <mesh geometry={top} material={faceToneMaterial(palette.ground, theme)} position={[0, topY, 0]} renderOrder={LAYER.ground}>
        <IsoEdges geometry={top} />
      </mesh>
      <mesh
        geometry={under}
        material={faceToneMaterial(palette.soil, theme)}
        position={[0, topY - PLINTH.underDrop, 0]}
        renderOrder={LAYER.ground}
      />
      {variant === 'ledger' && tier === 'high' ? (
        <mesh
          geometry={ledgerPlaneGeo(w - 0.02, d - 0.02)}
          material={ledgerMaterial(theme)}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, PLINTH.ledgerLift, 0]}
          renderOrder={LAYER.ground}
        />
      ) : null}
    </group>
  );
}
