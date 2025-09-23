import * as THREE from 'three';
export function hardenMaterials(root: THREE.Object3D) {
    root.traverse((o: any) => {
        if (o.isMesh && o.material) {
            o.material.transparent = false;
            o.material.side = THREE.FrontSide;
            o.material.depthWrite = true;
        }
    });
}
