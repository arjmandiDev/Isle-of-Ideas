// src/scene/environment.ts
import * as THREE from 'three';

export type Environment = {
    sunLight: THREE.DirectionalLight;
    moonLight: THREE.DirectionalLight;
    sunPlane: THREE.Mesh;
    moonPlane: THREE.Mesh;
    update: (time01: number, camera: THREE.Camera) => void;
};

function lerpHex(a: number, b: number, t: number) {
    return new THREE.Color(a).lerp(new THREE.Color(b), THREE.MathUtils.clamp(t, 0, 1)).getHex();
}

function skyColorFromElevation(elev: number, evening: boolean) {
    // پالت
    const NIGHT = 0x0b1a2b;
    const DAY   = 0x87c8ff;
    const DAWN  = 0xffc6a3;         // هلوییِ صبح
    const DUSK  = 0xffa07a;         // نارنجیِ غروب
    const WARM  = evening ? DUSK : DAWN;

    // سهم روز/شب: -0.05 → 0 ، 0.25 → 1
    const dayFac  = THREE.MathUtils.smoothstep(elev, -0.05, 0.25);

    // گرمیِ افق: وقتی |elev| نزدیک صفر است ماکزیمم شود (±0.12)
    const warmFac = 1 - THREE.MathUtils.smoothstep(Math.abs(elev), 0.0, 0.12);

    // پایه: بین شب و روز
    const base = lerpHex(NIGHT, DAY, dayFac);
    // گرادیان گرم نزدیک افق
    return lerpHex(base, WARM, warmFac * 0.9);
}

function skyColor(time01: number) {
    const t = ((time01 % 1) + 1) % 1;
    const COL = {
        dawnTop: 0xffc6a3,
        dayTop: 0x87c8ff,
        duskTop: 0xffa07a,
        nightTop: 0x0b1a2b,
    };
    if (t < 0.20) return lerpHex(COL.nightTop, COL.dawnTop, t / 0.20);            // شب→سحر
    if (t < 0.45) return lerpHex(COL.dawnTop, COL.dayTop, (t - 0.20) / 0.25);     // سحر→روز
    if (t < 0.75) return lerpHex(COL.dayTop, COL.duskTop, (t - 0.45) / 0.30);     // روز→غروب
    return lerpHex(COL.duskTop, COL.nightTop, (t - 0.75) / 0.25);                 // غروب→شب
}

export function createEnvironment(scene: THREE.Scene, radius = 3000): Environment {
    // --- نورها ---
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    const moonLight = new THREE.DirectionalLight(0x8ea6ff, 0.4);
    sunLight.castShadow = moonLight.castShadow = false;
    scene.add(sunLight, moonLight);

    const hemi = new THREE.HemisphereLight(0xbbe1ff, 0x223344, 0.45);
    scene.add(hemi);

    // --- اسپرایت مربعی خورشید/ماه (بدون تکسچر) ---
    const sunPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })
    );
    const moonPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0xbfd4ff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })
    );
    scene.add(sunPlane, moonPlane);

    // --- به‌روزرسانی هر فریم ---
    function update(time01: number, camera: THREE.Camera) {
        // 1) رنگ پس‌زمینه آسمان
        scene.background = new THREE.Color(skyColor(time01));

        // 2) جهت/موقعیت خورشید و ماه
        const angle = time01 * Math.PI * 2; // 0=نیمه‌شب، 0.5=ظهر
        const sunDir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();
        const moonDir = sunDir.clone().negate();

        const camFar = (camera as THREE.PerspectiveCamera).far ?? 2000;
        const dist = Math.min(radius, camFar * 0.8); // همیشه داخل فرِاستوم

        const sunPos = sunDir.clone().multiplyScalar(dist);
        const moonPos = moonDir.clone().multiplyScalar(dist);

        sunLight.position.copy(sunPos);
        sunLight.target.position.set(0, 0, 0);
        sunLight.target.updateMatrixWorld();

        moonLight.position.copy(moonPos);
        moonLight.target.position.set(0, 0, 0);
        moonLight.target.updateMatrixWorld();

        // 3) اندازه اسپرایت‌ها بر اساس FOV (≈ 12% ارتفاع تصویر)
        const fovDeg = (camera as THREE.PerspectiveCamera).fov ?? 70;
        const fovRad = THREE.MathUtils.degToRad(fovDeg);
        const viewHalfH = Math.tan(fovRad / 2) * dist;
        const spriteH = viewHalfH * 2 * 0.12;
        const spriteW = spriteH;

        sunPlane.position.copy(sunPos);
        moonPlane.position.copy(moonPos);
        sunPlane.scale.set(spriteW, spriteH, 1);
        moonPlane.scale.set(spriteW, spriteH, 1);
        sunPlane.lookAt((camera as THREE.Camera).position);
        moonPlane.lookAt((camera as THREE.Camera).position);

        const sunUp = sunDir.y > -0.03;
        const moonUp = moonDir.y > -0.03;
        sunPlane.visible = sunUp;
        moonPlane.visible = moonUp;

        // 4) شدت نورها و نور محیطی بر اساس ارتفاع خورشید
        const daylight = THREE.MathUtils.smoothstep(sunDir.y, -0.05, 0.25); // 0..1
        sunLight.intensity = THREE.MathUtils.lerp(0.25, 1.15, daylight);   // شب کم، روز زیاد
        moonLight.intensity = THREE.MathUtils.lerp(0.6, 0.0, daylight);    // شب زیاد، روز صفر
        hemi.intensity = THREE.MathUtils.lerp(0.55, 0.35, daylight);       // شب روشن‌تر

        // رنگ آسمان و مه با ارتفاع خورشید
        const isEvening = sunDir.x < 0; // صبح/غروب برای انتخاب تون هلویی
        const bgHex = skyColorFromElevation(sunDir.y, isEvening);
        scene.background = new THREE.Color(bgHex);
        if (scene.fog && (scene.fog as THREE.FogExp2).isFogExp2) {
            (scene.fog as THREE.FogExp2).color.setHex(bgHex);
        }
    }

    return { sunLight, moonLight, sunPlane, moonPlane, update };
}
