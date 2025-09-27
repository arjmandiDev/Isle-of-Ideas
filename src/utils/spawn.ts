import * as THREE from 'three';
import {Capsule} from 'three/examples/jsm/math/Capsule.js';

/**
 * پلیر را بالای سطح زمین می‌نشاند:
 * - اول با Box3 مرکز و ارتفاع صحنه را پیدا می‌کند
 * - بعد یک ری‌کست عمودی از بالا می‌زند و دقیقاً روی برخورد اول قرار می‌گیرد
 */
export function spawnOnTerrain(
    scene: THREE.Scene,
    terrainRoot: THREE.Object3D,
    capsule: Capsule,
    camera: THREE.PerspectiveCamera,
    eyeHeight = 1.8
) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(terrainRoot);
    const center = box.getCenter(new THREE.Vector3());
    const topY = box.max.y;

    const ray = new THREE.Raycaster(new THREE.Vector3(center.x, topY + 5000, center.z), new THREE.Vector3(0, -1, 0), 0, 10000);
    const hit = ray.intersectObject(terrainRoot, true)[0];
    const groundY = hit ? hit.point.y : topY;

    const headY = groundY + eyeHeight;
    const h = capsule.end.y - capsule.start.y;
    capsule.start.set(center.x, headY - h, center.z);
    capsule.end.set(center.x, headY, center.z);
    camera.position.copy(capsule.end);
}
