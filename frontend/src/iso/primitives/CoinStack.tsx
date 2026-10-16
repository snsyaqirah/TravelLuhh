// Day coin stacks (§7.6 #4). Every stack in a scene writes into one shared <CoinInstances> pool: three
// InstancedMeshes (one per tint) for the whole scene, however many stones there are.
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Matrix4, type InstancedMesh } from 'three';
import { useThree } from '@react-three/fiber';
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { cylinderGeo } from '@/iso/primitives/geometries';
import { COIN_STACK, coinStackLayout } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

interface PoolCoin {
  matrix: Matrix4;
  tint: 0 | 1 | 2;
}

interface CoinPool {
  set(id: string, coins: PoolCoin[]): void;
  remove(id: string): void;
}

const PoolContext = createContext<CoinPool | null>(null);

export interface CoinInstancesProps {
  /** Max coins across all stacks (each tint mesh is allocated this many). */
  capacity?: number;
  children?: ReactNode;
}

/** Shared pool. Put every CoinStack of a scene inside one of these. */
export function CoinInstances({ capacity = 720, children }: CoinInstancesProps) {
  const { theme, palette } = useIso();
  const invalidate = useThree((s) => s.invalidate);
  const geo = cylinderGeo(COIN_STACK.r, COIN_STACK.r, COIN_STACK.h, COIN_STACK.segments);
  const mats = palette.coins.map((hex) => faceToneMaterial(hex, theme, { curved: true }));
  const refs = [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)];
  const entries = useRef(new Map<string, PoolCoin[]>());
  const scheduled = useRef(false);

  const flush = useRef(() => {});
  flush.current = () => {
    scheduled.current = false;
    const counts = [0, 0, 0];
    entries.current.forEach((coins) => {
      for (const c of coins) {
        const mesh = refs[c.tint].current;
        if (!mesh || counts[c.tint] >= capacity) continue;
        mesh.setMatrixAt(counts[c.tint]++, c.matrix);
      }
    });
    refs.forEach((ref, tint) => {
      if (!ref.current) return;
      ref.current.count = counts[tint];
      ref.current.instanceMatrix.needsUpdate = true;
    });
    invalidate();
  };

  const pool = useMemo<CoinPool>(() => {
    const schedule = () => {
      if (scheduled.current) return;
      scheduled.current = true;
      queueMicrotask(() => flush.current());
    };
    return {
      set(id, coins) {
        entries.current.set(id, coins);
        schedule();
      },
      remove(id) {
        entries.current.delete(id);
        schedule();
      },
    };
  }, []);

  // Theme change recreates the meshes (material is in args): rewrite every matrix into the new ones.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => flush.current(), [mats[0], mats[1], mats[2], capacity]);

  return (
    <>
      {refs.map((ref, tint) => (
        <instancedMesh key={tint} ref={ref} args={[geo, mats[tint], capacity]} frustumCulled={false} />
      ))}
      <PoolContext.Provider value={pool}>{children}</PoolContext.Provider>
    </>
  );
}

export interface CoinStackProps {
  /** Base of the stack, in the CoinInstances' coordinate space (don't nest inside transformed groups). */
  at: Vec3;
  count: number;
  seed: string | number;
  /** Lift the top coin by this much (animate a landing coin without a separate mesh). */
  topLift?: number;
}

const rot = new Matrix4();

function StackInPool({ pool, at, count, seed, topLift = 0 }: CoinStackProps & { pool: CoinPool }) {
  const id = useId();
  const layout = useMemo(() => coinStackLayout(count, seed), [count, seed]);
  const [x, y, z] = at;
  useLayoutEffect(() => {
    pool.set(
      id,
      layout.map((c, i) => {
        const lift = i === layout.length - 1 ? topLift : 0;
        const matrix = new Matrix4()
          .makeTranslation(x + c.position[0], y + c.position[1] + lift, z + c.position[2])
          .multiply(rot.makeRotationY(c.rotY));
        return { matrix, tint: c.tint };
      }),
    );
  }, [pool, id, layout, x, y, z, topLift]);
  useEffect(() => () => pool.remove(id), [pool, id]);
  return null;
}

/** One day's coins. Inside a CoinInstances it shares the pool; on its own it brings a tiny pool. */
export function CoinStack(props: CoinStackProps) {
  const pool = useContext(PoolContext);
  if (!pool)
    return (
      <CoinInstances capacity={Math.max(1, props.count)}>
        <CoinStack {...props} />
      </CoinInstances>
    );
  return <StackInPool pool={pool} {...props} />;
}

