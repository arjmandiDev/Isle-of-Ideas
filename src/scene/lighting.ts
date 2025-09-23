import * as THREE from 'three';
export function addOutdoorLights(scene: THREE.Scene) {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(800, 1200, 600);
    sun.castShadow = false;
    scene.add(sun);
}
