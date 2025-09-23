import * as THREE from 'three';
// @ts-ignore
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

export function createControls(camera: THREE.Camera, dom: HTMLElement) {
    const ctr = new OrbitControls(camera as any, dom);
    ctr.enableDamping = true; ctr.dampingFactor = 0.08;
    ctr.maxPolarAngle = Math.PI*0.49;
    ctr.minDistance = 50; ctr.maxDistance = 3000;
    return ctr;
}