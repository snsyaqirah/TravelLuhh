// Suitcase (§7.6 #10). The lid hinges on the back edge: rotation.x = −lidAngle. At p = 1 it is shut and buckled.
import { useIso } from '@/iso/canvas/context';
import { rectFootprint } from '@/iso/geometry2d';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { IsoEdges } from '@/iso/primitives/Edges';
import { HardShadow } from '@/iso/primitives/HardShadow';
import { boxGeo, suitcaseCornersGeo, suitcaseHandleGeo, suitcaseShellGeo } from '@/iso/primitives/geometries';
import { SUITCASE } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

export interface SuitcaseProps {
  /** Lid opening in DEGREES (spec: 100° × (1 − p)^0.6). 0 = shut. */
  lidAngle: number;
  buckled?: boolean;
  position?: Vec3;
  shadow?: boolean;
}

const DEG = Math.PI / 180;

export function Suitcase({ lidAngle, buckled = false, position, shadow = true }: SuitcaseProps) {
  const { theme, palette } = useIso();
  const { w, d, wallH, strapW, strapT, strapX } = SUITCASE;
  const shell = suitcaseShellGeo();
  const corners = suitcaseCornersGeo();
  const shellMat = faceToneMaterial(palette.suitcase.shell, theme);
  const cornerMat = faceToneMaterial(palette.suitcase.corners, theme);
  const strapMat = faceToneMaterial(palette.suitcase.straps, theme);
  const strapTop = boxGeo(strapW, strapT, d + 0.02);
  const strapDrop = boxGeo(strapW, wallH * 0.6, strapT);
  const strapLower = boxGeo(strapW, wallH * 0.5, strapT);
  const buckle = boxGeo(strapW + 0.04, 0.06, 0.02);
  const closed = lidAngle <= 0.5;
  return (
    <group position={position}>
      {shadow ? <HardShadow footprint={rectFootprint(w, d)} h={closed ? wallH * 2 : wallH} /> : null}
      {/* Tray */}
      <mesh geometry={shell} material={shellMat}>
        <IsoEdges geometry={shell} />
      </mesh>
      <mesh geometry={corners} material={cornerMat} />
      <mesh geometry={suitcaseHandleGeo()} material={faceToneMaterial(palette.ink2, theme, { curved: true })} />
      {buckled
        ? [-strapX, strapX].map((x) => (
            <group key={x}>
              <mesh geometry={strapLower} material={strapMat} position={[x, wallH - wallH * 0.25, d / 2 + strapT / 2]} />
              <mesh geometry={buckle} material={cornerMat} position={[x, wallH, d / 2 + 0.012]} />
            </group>
          ))
        : null}
      {/* Lid: pivot on the back top edge. In pivot space the lid shell is the tray shell flipped over. */}
      <group position={[0, wallH, -d / 2]} rotation={[-lidAngle * DEG, 0, 0]}>
        <group position={[0, wallH, d / 2]} rotation={[Math.PI, 0, 0]}>
          <mesh geometry={shell} material={shellMat}>
            <IsoEdges geometry={shell} />
          </mesh>
          <mesh geometry={corners} material={cornerMat} />
        </group>
        {[-strapX, strapX].map((x) => (
          <group key={x}>
            <mesh geometry={strapTop} material={strapMat} position={[x, wallH + strapT / 2, d / 2]} />
            <mesh geometry={strapDrop} material={strapMat} position={[x, wallH - wallH * 0.3, d + strapT / 2]} />
          </group>
        ))}
      </group>
    </group>
  );
}
