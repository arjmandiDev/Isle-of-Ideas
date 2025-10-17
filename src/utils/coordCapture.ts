import * as THREE from 'three';

export function initCoordCapture(opts: {
    camera: THREE.Camera;
    terrain: THREE.Object3D;       // Mesh/Group زمین
    dom: HTMLElement;              // renderer.domElement
    storageKey?: string;           // پیش‌فرض: 'island_editor.coords'
    hud?: boolean;                 // پیش‌فرض: true
}) {
    const { camera, terrain, dom } = opts;
    const storageKey = opts.storageKey ?? 'island_editor.coords';
    const ray = new THREE.Raycaster();
    const CENTER = { x: 0, y: 0 }; // مرکز صفحه
    const down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);

    // لود قبلی
    let list: [number, number, number][] = [];
    try { const raw = localStorage.getItem(storageKey); if (raw) list = JSON.parse(raw); } catch {}

    // HUD ساده
    let hud: HTMLDivElement | null = null;
    if (opts.hud !== false) {
        hud = document.createElement('div');
        hud.style.cssText = 'position:fixed;right:12px;bottom:12px;background:rgba(0,0,0,.55);color:#fff;padding:6px 8px;border-radius:8px;font:12px system-ui;z-index:9999;pointer-events:none';
        hud.textContent = `Coords saved: ${list.length}`;
        document.body.appendChild(hud);
    }
    const updateHUD = () => { if (hud) hud.textContent = `Coords saved: ${list.length}`; };

    function captureOnce() {
        // مطمئن شو ماتریس زمین به‌روز است
        terrain.updateMatrixWorld(true);

        // ری‌کست از مرکز تصویر
        ray.setFromCamera(CENTER as any, camera);

        // تقاطع با زمین
        let hit = ray.intersectObject(terrain, true)[0];

        // اگر آسمان/ابر جلوی دید است و چیزی نخورد، از بالا/پایین تست کمکی بزن (همان XZ)
        if (!hit) {
            const origin = new THREE.Vector3();
            origin.setFromMatrixPosition((camera as any).matrixWorld);
            const dir = new THREE.Vector3().copy(ray.ray.direction);
            const xz = origin.add(dir.multiplyScalar(1000)); // نقطه‌ای در آن راستا
            // از بالا به پایین
            ray.set(new THREE.Vector3(xz.x, 99999, xz.z), down);
            hit = ray.intersectObject(terrain, true)[0] ??
                (ray.set(new THREE.Vector3(xz.x, -99999, xz.z), up), ray.intersectObject(terrain, true)[0]);
        }

        if (!hit) return; // چیزی زیر مرکز نبود

        const p = hit.point;
        const item: [number, number, number] = [p.x, p.y, p.z];
        list.push(item);
        try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch {}

        updateHUD();
        // برای دیباگ: یک نقطه‌ی کوچک نشان بدهیم
        // (اختیاری؛ اگر نمی‌خواهی، کامنت کن)
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ wireframe: true }));
        dot.position.set(p.x, p.y, p.z);
        (terrain.parent ?? terrain).add(dot);
    }

    // کلیک روی بوم
    const onClick = (e: MouseEvent) => { e.preventDefault(); captureOnce(); };
    dom.addEventListener('click', onClick);

    // کلید جایگزین: K
    const onKey = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'k') { e.preventDefault(); captureOnce(); }
        // پاک‌کردن سریع با Backspace + Ctrl
        if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
            list = []; localStorage.removeItem(storageKey); updateHUD();
        }
    };
    window.addEventListener('keydown', onKey);

    // API کوچک برای استفاده‌های بعدی
    return {
        get list() { return list.slice(); },
        destroy() {
            dom.removeEventListener('click', onClick);
            window.removeEventListener('keydown', onKey);
            if (hud && hud.parentElement) hud.parentElement.removeChild(hud);
        }
    };
}