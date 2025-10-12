// src/scene/preloadTreePrototypes.ts
import * as THREE from 'three';
import type { TreePart } from './loadTreePrototype';
import { loadTreePrototype } from './loadTreePrototype';

export type TreeProto = {
    parts: TreePart[];
    chosenMode: 'base';
    anchorCorrection: THREE.Matrix4;  // C
    orientCorrection: THREE.Matrix4;  // O
    yLift: number;
};

export async function preloadTreePrototypes(
    gltf: { loadAsync: (u: string) => Promise<any> },
    paths: Record<string, string>
): Promise<Map<string, TreeProto>> {
    const out = new Map<string, TreeProto>();
    await Promise.all(Object.entries(paths).map(async ([key, url]) => {
        const proto = await loadTreePrototype(gltf, url);
        out.set(key, proto);
    }));
    return out;
}
