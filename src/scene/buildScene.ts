import * as THREE from 'three';
import {loadTerrain} from './terrain';
import {frameObject} from '../utils/frameObject';
import {addOutdoorLights} from "./lighting.ts";

export async function buildScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera, gltf: any, urls: { island: string }) {
    const sun = addOutdoorLights(scene);
    const root = await loadTerrain(gltf, urls.island);
    scene.add(root);
    //printTree(root)
    // برای فریم کردن، بزرگ‌ترین Mesh را پیدا کن:
    let biggest: THREE.Mesh | null = null;
    let maxVerts = -1;
    root.traverse((o: any) => {
        if (o.isMesh && o.geometry?.attributes?.position) {
            const v = o.geometry.attributes.position.count;
            if (v > maxVerts) { maxVerts = v; biggest = o; }
        }
    });
    if (biggest) frameObject(biggest, camera, 1.2);

    return { sun, terrainRoot: root }; // توجه: terrainRoot = root (Group)
}
function printTree(root: THREE.Object3D) {
    console.group('GLTF Tree');
    root.traverse((o: any) => {
        const t = o.type; // Group / Mesh / SkinnedMesh ...
        const name = o.name || '(no-name)';
        const vcount = o.isMesh ? o.geometry?.attributes?.position?.count : 0;
        console.log(`${t.padEnd(12)} | ${name} | verts: ${vcount}`);
    });
    console.groupEnd();
}
//
// export async function buildScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera, gltf: any, urls: { island: string }) {
//     const island = await loadTerrain(gltf, urls.island);
//     scene.background = new THREE.Color(0x7ec8e3)
//     scene.add(island);
//     frameObject(island, camera, 1.2);
// }