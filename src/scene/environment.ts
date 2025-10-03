// src/scene/environment.ts
import * as THREE from 'three';

export type Environment = {
    sunLight: THREE.DirectionalLight;
    moonLight: THREE.DirectionalLight;
    sunPlane: THREE.Mesh;
    moonPlane: THREE.Mesh;

    updateFromAstro: (params: {
        sunAltDeg: number;
        sunAzDeg: number;
        moonAltDeg: number;
        moonAzDeg: number;
        camera: THREE.Camera;
    }) => void;
};

function lerpHex(a: number, b: number, t: number) {
    return new THREE.Color(a).lerp(new THREE.Color(b), THREE.MathUtils.clamp(t, 0, 1)).getHex();
}

function skyColorFromElevation(elev: number, evening: boolean) {
    const NIGHT = 0x0b1a2b, DAY = 0x87c8ff, DAWN = 0xffc6a3, DUSK = 0xffa07a;
    const WARM = evening ? DUSK : DAWN;
    const dayFac = THREE.MathUtils.smoothstep(elev, -0.05, 0.25);
    const warmFac = 1 - THREE.MathUtils.smoothstep(Math.abs(elev), 0.0, 0.12);
    const base = lerpHex(NIGHT, DAY, dayFac);
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
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    const moonLight = new THREE.DirectionalLight(0x8ea6ff, 0.4);
    const SUN_HORIZON = -0.833; // برای طلوع/غروب
    const MOON_HORIZON = -0.3;
    sunLight.castShadow = moonLight.castShadow = false;
    scene.add(sunLight, moonLight);

    const hemi = new THREE.HemisphereLight(0xbbe1ff, 0x223344, 0.45);
    scene.add(hemi);

    const sunPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
            color: 0xffee88,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false
        })
    );
    const moonPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
            color: 0xbfd4ff,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false
        })
    );
    scene.add(sunPlane, moonPlane);

    function placeBody(dir: THREE.Vector3, plane: THREE.Mesh, light: THREE.DirectionalLight, camera: THREE.Camera, radius: number) {
        const camFar = (camera as THREE.PerspectiveCamera).far ?? 2000;
        const dist = Math.min(radius, camFar * 0.8);
        const pos = dir.clone().multiplyScalar(dist);

        light.position.copy(pos);
        light.target.position.set(0, 0, 0);
        light.target.updateMatrixWorld();

        plane.position.copy(pos);
        plane.lookAt((camera as THREE.Camera).position);

        // اندازهٔ اسپرایت ≈ 12% ارتفاع فریم در آن فاصله
        const fovDeg = (camera as THREE.PerspectiveCamera).fov ?? 70;
        const fovRad = THREE.MathUtils.degToRad(fovDeg);
        const viewHalfH = Math.tan(fovRad / 2) * dist;
        const spriteH = viewHalfH * 2 * 0.12;
        plane.scale.set(spriteH, spriteH, 1);
    }

    function tintSkyBySunElevation(elevY: number, camera: THREE.Camera) {
        const bgHex = skyColorFromElevation(elevY, /*evening hint*/ elevY >= 0 ? false : false);
        scene.background = new THREE.Color(bgHex);
        if (scene.fog && (scene.fog as THREE.FogExp2).isFogExp2) {
            (scene.fog as THREE.FogExp2).color.setHex(bgHex);
        }
        const daylight = THREE.MathUtils.smoothstep(elevY, -0.05, 0.25);
        sunLight.intensity  = THREE.MathUtils.lerp(0.25, 1.15, daylight);
        moonLight.intensity = THREE.MathUtils.lerp(0.6,  0.0,  daylight);
    }

    function updateFromAstro({ sunAltDeg, sunAzDeg, moonAltDeg, moonAzDeg, camera }: {
        sunAltDeg: number; sunAzDeg: number; moonAltDeg: number; moonAzDeg: number; camera: THREE.Camera;
    }) {
        const sunDir  = dirFromAltAz(sunAltDeg,  sunAzDeg);
        const moonDir = dirFromAltAz(moonAltDeg, moonAzDeg);

        // 1) آسمان/نور بر اساس ارتفاع واقعی خورشید
        tintSkyBySunElevation(sunDir.y, camera);

        // 2) جایگذاری اسپرایت‌ها و نورها
        placeBody(sunDir,  sunPlane,  sunLight,  camera, radius);
        placeBody(moonDir, moonPlane, moonLight, camera, radius);

        // 3) «قابلیت دیده‌شدن» مستقل
        const sunUp  = sunAltDeg  > SUN_HORIZON;
        const moonUp = moonAltDeg > MOON_HORIZON;
        sunPlane.visible  = sunUp;
        moonPlane.visible = moonUp;

        // 4) اگر هر دو بالای افق‌اند → ماه را کم‌رنگ/کم‌نور کن (daylight moon)
        //    dimFactor با ارتفاع خورشید زیاد می‌شود: کنار افق ≈ کم، ظهر ≈ زیاد
        if (sunUp && moonUp) {
            const daylight = THREE.MathUtils.smoothstep(sunAltDeg, 0, 35);
            const mat = moonPlane.material as THREE.MeshBasicMaterial;
            mat.color.setHex(0xbfd4ff).lerp(new THREE.Color(0xd0d8e8), 0.6 * daylight);
            mat.opacity = THREE.MathUtils.lerp(1.0, 0.25, daylight);
            moonLight.intensity = THREE.MathUtils.lerp(0.4, 0.1, daylight);
        } else if (moonUp) {
            const mat = moonPlane.material as THREE.MeshBasicMaterial;
            mat.color.setHex(0xbfd4ff);
            mat.opacity = 1.0;
        }
    }
// نسخهٔ قبلی برای سازگاری باقی بماند:
//     function update(time01: number, camera: THREE.Camera) {
//         const angle = time01 * Math.PI * 2; // 0=نیمه‌شب، 0.5=ظهر
//         const sunDir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();
//         const moonDir = sunDir.clone().negate();
//         tintSkyBySunElevation(sunDir.y, camera);
//         placeBody(sunDir,  sunPlane,  sunLight,  camera);
//         placeBody(moonDir, moonPlane, moonLight, camera);
//         sunPlane.visible  = sunDir.y  > -0.03;
//         moonPlane.visible = moonDir.y > -0.03;
//     }

    // function update(time01: number, camera: THREE.Camera) {
    //     // محاسبهٔ جهت خورشید از time01
    //     const angle = time01 * Math.PI * 2;               // 0=نیمه‌شب، 0.5=ظهر
    //     const sunDir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();
    //     const moonDir = sunDir.clone().negate();
    //
    //     // رنگ آسمان بر اساس ارتفاع واقعی خورشید
    //     const bgHex = skyColorFromElevation(sunDir.y, sunDir.x < 0);
    //     scene.background = new THREE.Color(bgHex);
    //     if (scene.fog && (scene.fog as THREE.FogExp2).isFogExp2) {
    //         (scene.fog as THREE.FogExp2).color.setHex(bgHex);
    //     }
    //
    //     const camFar = (camera as THREE.PerspectiveCamera).far ?? 2000;
    //     const dist = Math.min(radius, camFar * 0.8);
    //
    //     const sunPos = sunDir.clone().multiplyScalar(dist);
    //     const moonPos = moonDir.clone().multiplyScalar(dist);
    //
    //     sunLight.position.copy(sunPos);
    //     sunLight.target.position.set(0, 0, 0);
    //     sunLight.target.updateMatrixWorld();
    //
    //     moonLight.position.copy(moonPos);
    //     moonLight.target.position.set(0, 0, 0);
    //     moonLight.target.updateMatrixWorld();
    //
    //     // اندازهٔ اسپرایت‌ها متناسب با FOV (≈12% ارتفاع تصویر)
    //     const fovDeg = (camera as THREE.PerspectiveCamera).fov ?? 70;
    //     const fovRad = THREE.MathUtils.degToRad(fovDeg);
    //     const viewHalfH = Math.tan(fovRad / 2) * dist;
    //     const spriteH = viewHalfH * 2 * 0.12;
    //     const spriteW = spriteH;
    //
    //     sunPlane.position.copy(sunPos);
    //     moonPlane.position.copy(moonPos);
    //     sunPlane.scale.set(spriteW, spriteH, 1);
    //     moonPlane.scale.set(spriteW, spriteH, 1);
    //     sunPlane.lookAt((camera as THREE.Camera).position);
    //     moonPlane.lookAt((camera as THREE.Camera).position);
    //
    //     const sunUp = sunDir.y > -0.03;
    //     const moonUp = moonDir.y > -0.03;
    //     sunPlane.visible = sunUp;
    //     moonPlane.visible = moonUp;
    //
    //     const daylight = THREE.MathUtils.smoothstep(sunDir.y, -0.05, 0.25);
    //     sunLight.intensity = THREE.MathUtils.lerp(0.25, 1.15, daylight);
    //     moonLight.intensity = THREE.MathUtils.lerp(0.6, 0.0, daylight);
    //     hemi.intensity = THREE.MathUtils.lerp(0.55, 0.35, daylight);
    // }

    function dirFromAltAz(altDeg: number, azDeg: number) {
        const alt = THREE.MathUtils.degToRad(altDeg);
        const az = THREE.MathUtils.degToRad(azDeg);
        const ca = Math.cos(alt), sa = Math.sin(alt);
        const cz = Math.cos(az), sz = Math.sin(az);
        return new THREE.Vector3(sz * ca, sa, cz * ca);
    }

    return { sunLight, moonLight, sunPlane, moonPlane, updateFromAstro };
}
