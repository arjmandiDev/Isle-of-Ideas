import * as THREE from 'three';
import type { Capsule } from 'three/examples/jsm/math/Capsule.js';

export type WorldBoundsOpts = {
    center: THREE.Vector3;
    softRadius: number;   // از اینجا به بعد کند می‌شویم
    hardRadius: number;   // از این بیشتر، کلمپ سخت
    waterY?: number;
};

export function createWorldBounds(opts: WorldBoundsOpts) {
    const { center, softRadius, hardRadius } = opts;
    const group = new THREE.Group();

    const EPS = 0.05;
    const pullStrength = 6.0; // m/s
    const slowMax = 0.25;

    function distanceXZ(p: THREE.Vector3) {
        return Math.hypot(p.x - center.x, p.z - center.z);
    }

    function slowdownFactor(pos: THREE.Vector3) {
        const d = distanceXZ(pos);
        if (d <= softRadius) return 1.0;
        if (d >= hardRadius) return slowMax;
        const t = (d - softRadius) / (hardRadius - softRadius);
        return THREE.MathUtils.lerp(1.0, slowMax, t);
    }

    function clampCapsule(dt: number, capsule: Capsule) {
        const centerCap = capsule.start.clone().add(capsule.end).multiplyScalar(0.5);
        const dir = new THREE.Vector3(centerCap.x - center.x, 0, centerCap.z - center.z);
        const d = dir.length();

        if (d <= hardRadius) {
            if (d > softRadius) {
                dir.normalize();
                const over = (d - softRadius) / Math.max(1e-6, (hardRadius - softRadius));
                const push = dir.multiplyScalar(-pullStrength * over * dt); // به داخل
                capsule.start.add(push);
                capsule.end.add(push);
            }
            return;
        }

        // بیرون hard → پروجکت به مرز
        dir.normalize();
        const targetX = center.x + dir.x * (hardRadius - EPS);
        const targetZ = center.z + dir.z * (hardRadius - EPS);
        const off = new THREE.Vector3(targetX - centerCap.x, 0, targetZ - centerCap.z);
        capsule.start.add(off);
        capsule.end.add(off);
    }

    function update(dt: number, player: { capsule: Capsule; camera: THREE.Camera }) {
        clampCapsule(dt, player.capsule);
    }

    return { group, update, slowdownFactor };
}
