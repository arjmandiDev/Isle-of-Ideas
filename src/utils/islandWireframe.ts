// utils/islandWireframe.ts
import * as THREE from 'three';

type WireCache = Map<THREE.Material, boolean>;
const _wireCache: WireCache = new Map();

export function setIslandWireframe(root: THREE.Object3D, on: boolean) {
    root.traverse((o: any) => {
        if (!o.isMesh) return;

        const apply = (m: THREE.Material) => {
            // یک‌بار وضعیت قبلی را ذخیره کن
            if (!_wireCache.has(m)) _wireCache.set(m, (m as any).wireframe ?? false);
            // اگر متریال share شده بین چند مش است، بهتره clone کنیم که صحنه‌های دیگر تغییر نکنند
            if (!m.userData.__wireCloned && (m as any).isMaterial) {
                const c = (m as any).clone();
                c.userData.__wireCloned = true;
                o.material = c;
                m = c;
            }
            (m as any).wireframe = on;
            m.needsUpdate = true;
        };

        if (Array.isArray(o.material)) o.material.forEach(apply);
        else if (o.material) apply(o.material as THREE.Material);
    });
}

export function restoreIslandWireframe(root: THREE.Object3D) {
    root.traverse((o: any) => {
        if (!o.isMesh) return;
        const apply = (m: THREE.Material) => {
            const prev = _wireCache.get(m);
            if (prev != null) {
                (m as any).wireframe = prev;
                m.needsUpdate = true;
            }
        };
        if (Array.isArray(o.material)) o.material.forEach(apply);
        else if (o.material) apply(o.material as THREE.Material);
    });
}
