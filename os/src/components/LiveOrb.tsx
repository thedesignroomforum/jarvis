"use client";

import { Orb } from "./Orb";
import { useJarvis } from "./JarvisProvider";

export function LiveOrb({ size }: { size: number }) {
  const { orbState, level } = useJarvis();
  return <Orb size={size} state={orbState} level={level} />;
}
