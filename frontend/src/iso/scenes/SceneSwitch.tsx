// Renders the lazy scene for `kind` inside the canvas and reports its first rendered frame, which is when
// IsoStage crossfades from the SVG twin. Kind changes keep the canvas and swap only this subtree.
import { Suspense, useEffect, useRef, type ComponentType } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { SceneKind } from '@/iso/specs';
import type { IsoSceneProps } from '@/iso/types';

function FirstFrame({ token, onFrame }: { token: string; onFrame: (token: string) => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const done = useRef(false);
  const cb = useRef(onFrame);
  cb.current = onFrame;
  useEffect(() => {
    done.current = false;
    invalidate();
  }, [token, invalidate]);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    // useFrame runs just before gl.render; report on the next frame, once this one is on screen.
    requestAnimationFrame(() => cb.current(token));
  });
  return null;
}

export interface SceneSwitchProps {
  kind: SceneKind;
  /** sceneRegistry[kind].Scene (lazy). */
  Scene: ComponentType<IsoSceneProps>;
  sceneProps: IsoSceneProps;
  onFirstFrame: (kind: SceneKind) => void;
}

export function SceneSwitch({ kind, Scene, sceneProps, onFirstFrame }: SceneSwitchProps) {
  return (
    <Suspense fallback={null}>
      <Scene key={kind} {...sceneProps} />
      <FirstFrame key={`ff-${kind}`} token={kind} onFrame={(t) => onFirstFrame(t as SceneKind)} />
    </Suspense>
  );
}
