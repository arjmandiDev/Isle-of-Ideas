import * as THREE from 'three';
import { applyFoliageMask } from '../materials/applyFoliageMask';
import { hardenMaterials } from '../materials/commonTweaks';

export async function loadTerrain(gltfLoader: any, url: string): Promise<THREE.Object3D> {
    const glb = await gltfLoader.loadAsync(url);
    const root = glb.scene as THREE.Object3D;

    // ترتیب: اول محکم‌کاری عمومی، بعد ماسک گیاه‌ها
    hardenMaterials(root);
    applyFoliageMask(root);

    return root;
}
