// src/scene/terrain.ts
import * as THREE from 'three';
import { applyFoliageMask } from '../materials/applyFoliageMask';
import { hardenMaterials } from '../materials/commonTweaks';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

// ❗️ یک‌بار و زود: جایگزینی raycast
(THREE.Mesh as any).prototype.raycast = acceleratedRaycast as any;

export async function loadTerrain(gltfLoader: any, url: string): Promise<THREE.Object3D> {
    const glb = await gltfLoader.loadAsync(url);
    const root = glb.scene as THREE.Object3D;

    hardenMaterials(root);
    applyFoliageMask(root);

    // روی همهٔ Meshهای بزرگ، BVH بساز (زمین/صخره‌ها/…)
    root.traverse((o: any) => {
        if (o.isMesh && o.geometry?.attributes?.position) {
            const verts = o.geometry.attributes.position.count;
            if (verts >= 1000) {
                (o.geometry as any).boundsTree = new MeshBVH(o.geometry, { lazyGeneration: false });
            }
        }
    });

    return root; // فقط root برمی‌گردونیم
}