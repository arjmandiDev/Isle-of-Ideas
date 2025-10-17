import * as THREE from 'three';
import { buildChunkedInstancedTrees } from './buildInstancedTrees';
import type { TreeProto } from './preloadTreePrototypes';

export type TreeRecord = { type: string; pos: [number, number, number]; rotY?: number; scale?: number };

export function spawnTreesFromLayout(
    scene: THREE.Scene,
    protos: Map<string, TreeProto>,
    records: TreeRecord[],
    opts?: { chunkSize?: number; cullDistance?: number }
) {
    const root = new THREE.Group();
    root.name = 'TreesRoot';

    const byType = new Map<string, TreeRecord[]>();
    for (const r of records) (byType.get(r.type) ?? byType.set(r.type, []).get(r.type)!).push(r);

    for (const [type, list] of byType) {
        const proto = protos.get(type);
        if (!proto) { console.warn('[trees] unknown type:', type); continue; }

        const positions = list.map(r => r.pos);
        const rotationsY = list.map(r => r.rotY ?? 0);
        const scales = list.map(r => r.scale ?? 1);

        const group = buildChunkedInstancedTrees(proto.parts, positions, {
            rotationsY, scales,
            chunkSize: opts?.chunkSize ?? 128,
            cullDistance: opts?.cullDistance ?? 0,
            anchorCorrection: proto.anchorCorrection,
            orientCorrection: proto.orientCorrection,  // ⬅️ جدید
            yLift: proto.yLift-2            // ⬅️ جدید
        });

        group.name = `Trees_${type}`;
        root.add(group);
    }

    scene.add(root);
    (scene as any).__treesTick__ = (cam: THREE.Camera) => {
        root.children.forEach((g: any) => g?.tick?.(cam));
    };

    return root;
}
