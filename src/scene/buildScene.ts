import * as THREE from 'three';
import { addOutdoorLights } from './lighting';
import { loadTerrain } from './terrain';
import { frameObject } from '../utils/frameObject';

export async function buildScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera, gltf: any, urls: { island: string }) {
    addOutdoorLights(scene);
    const island = await loadTerrain(gltf, urls.island);
    scene.background = new THREE.Color(0x7ec8e3)
    scene.add(island);
    frameObject(island, camera, 1.2);
}
