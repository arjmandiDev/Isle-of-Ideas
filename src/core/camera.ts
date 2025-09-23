import * as THREE from 'three';

export function createCamera() {
    const c = new THREE.PerspectiveCamera(60, 1, 0.1, 10000);
    return c;
}