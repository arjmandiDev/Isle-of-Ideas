// loop.ts
import * as THREE from 'three';

type LoopOptions = {
    maxDelta?: number;          // حداکثر dt به ثانیه (پیش‌فرض 1/30≈0.033s)
    pauseWhenHidden?: boolean;  // هنگام hidden/blur، dt=0 (پیش‌فرض true)
};

export function startLoop(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    update?: (dt: number) => void,
    opts: LoopOptions = {}
) {
    const maxDelta = opts.maxDelta ?? (1/30);
    const pauseWhenHidden = opts.pauseWhenHidden ?? true;

    function onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        (camera as THREE.PerspectiveCamera).aspect = w / h;
        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);
    onResize();

    let paused = false;
    let last = performance.now();

    function updatePauseFlag() {
        paused = pauseWhenHidden && (document.hidden || !document.hasFocus());
    }
    document.addEventListener('visibilitychange', updatePauseFlag);
    window.addEventListener('focus', updatePauseFlag);
    window.addEventListener('blur',  updatePauseFlag);

    function tick() {
        const now = performance.now();
        let dt = (now - last) / 1000;
        last = now;

        updatePauseFlag();

        if (paused) {
            dt = 0;                 // وقتی تب مخفی/غیرفعاله هیچ فیزیکی جلو نره
        } else if (dt > maxDelta) {
            dt = maxDelta;          // جلوی جهش زمانی بعد از برگشت از تب
        }

        update?.(dt);
        renderer.render(scene, camera);

        requestAnimationFrame(tick);  // ❗️فقط همین یک‌بار در عمر صفحه
    }

    requestAnimationFrame(tick);
}
