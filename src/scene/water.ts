// src/scene/water.ts
import * as THREE from 'three';
// import { Water } from 'three/examples/jsm/objects/Water2.js';

export type WaterOptions = {
    size?: number;          // ابعاد دریا (متر)
    y?: number;             // تراز آب
    texture?: THREE.Texture;// تکسچر آب (اختیاری)
    color?: number;         // رنگ بیس
    opacity?: number;       // شفافیت
    speed?: number;         // سرعت حرکت امواج (offset)
};

export function createPixelWater(opts: WaterOptions = {}) {
    const size = opts.size ?? 4000;
    const y    = opts.y ?? 0;
    const color= opts.color ?? 0x3aa7ff;
    const opacity = opts.opacity ?? 0.7;
    const speed   = opts.speed ?? 0.02;

    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();

    // تکسچر آب اختیاری: اگر دادی، فیلترش رو پیکسلی کن
    let map = opts.texture ?? null;
    if (map) {
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.magFilter = THREE.NearestFilter;
        map.minFilter = THREE.NearestFilter;
        map.generateMipmaps = false;
        map.repeat.set(size / 16 / 8, size / 16 / 8); // تایلینگ حدودی (تیون کن)
        map.needsUpdate = true;
    }

    const mat = new THREE.MeshStandardMaterial({
        color,
        map,
        transparent: true,
        opacity,
        metalness: 0,
        roughness: 0.4,
        depthWrite: true,     // برای تداخل ساحل بهتره روشن باشه
        side: THREE.DoubleSide
    });

    const water = new THREE.Mesh(geo, mat);
    water.position.y = y;
    // برای جلوگیری از z-fighting نزدیک ساحل
    water.renderOrder = 1;

    // انیمیشن ساده: اسکرول UV
    (water as any).tick = (dt: number) => {
        if (map) {
            map.offset.x += speed * dt;
            map.offset.y += speed * 0.6 * dt;
        }
    };

    // نورپردازی: یه انعکاس ساده با EnvMap صحنه اگر داشتی
    return water;
}

// export function createWater2(renderer: THREE.WebGLRenderer, y = 62, size = 4000) {
//     const geo = new THREE.PlaneGeometry(size, size);
//     const water = new Water(geo, {
//         color: 0x55aaff,
//         scale: 1,               // شدت موج
//         flowDirection: new THREE.Vector2(1, 0.4),
//         textureWidth: 256,
//         textureHeight: 256,
//     });
//     water.rotation.x = -Math.PI / 2;
//     water.position.y = y;
//
//     // تداخل مرز ساحل کمتر:
//     water.material.depthWrite = true;
//     water.renderOrder = 1;
//
//     (water as any).tick = (dt:number)=> { /* خود Water2 انیمیت می‌شود */ };
//
//     // نکته: Water2 شیدر خودش را دارد؛ تکسچرهای پیکسلی زمین را تحت تاثیر قرار نمی‌دهد.
//     return water;
// }