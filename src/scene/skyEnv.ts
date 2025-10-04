// src/scene/skyEnv.ts
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export type SkyEnv = {
    sky: Sky;
    sunLight: THREE.DirectionalLight;
    ambient: THREE.HemisphereLight;
    setFromAltAz: (altDeg: number, azDeg: number) => void; // ← از astro.ts
    setDayNightExtras: (sunAltDeg: number) => void;        // ← ستاره/مه/اکسپوژر
};

export function createSkyEnv(scene: THREE.Scene, renderer: THREE.WebGLRenderer): SkyEnv {
    // 1) Sky dome
    const sky = new Sky();
    sky.scale.setScalar(450000);                 // خیلی بزرگ تا همهٔ آسمان را بپوشاند
    scene.add(sky);

    // متریال آسمان روی بک‌گراند باشد ولی به عمق دست نزند
    const mat = sky.material as THREE.ShaderMaterial;
    mat.depthWrite = false;
    mat.depthTest  = false;
    sky.renderOrder = 0;

    // پارامترهای پایه (طبیعی و به‌دور از آبی نئونی)
    mat.uniforms['turbidity'].value = 2;         // 1..20 (غبار/کدری جو)
    mat.uniforms['rayleigh'].value = 1.2;        // 0..4  (پراکنش Rayleigh؛ آبیِ آسمان)
    mat.uniforms['mieCoefficient'].value = 0.003;// 0..0.1 (ذرات درشت‌تر)
    mat.uniforms['mieDirectionalG'].value = 0.8; // 0..1   (جهت‌داری Mie)

    // 2) خورشید و نورها
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.castShadow = false;
    scene.add(sunLight);

    const ambient = new THREE.HemisphereLight(0xbfd9ff, 0x102030, 0.25);
    scene.add(ambient);

    // 3) تبدیل ارتفاع/آزیموت → sunPosition (Three.Sky در مختصات جهانی)
    const sunPos = new THREE.Vector3();
    function setFromAltAz(altDeg: number, azDeg: number) {
        // آسمان Three: sunPosition یک بردار جهتی به بیرون از مرکز دنیاست
        const alt = THREE.MathUtils.degToRad(altDeg);
        const az  = THREE.MathUtils.degToRad(azDeg);
        const ca = Math.cos(alt), sa = Math.sin(alt);
        const cz = Math.cos(az),  sz = Math.sin(az);
        // قرارداد صحنه: X=شرق(+), Z=شمال(+)
        sunPos.set(sz * ca, sa, cz * ca).normalize();

        mat.uniforms['sunPosition'].value.copy(sunPos);
        sunLight.position.copy(sunPos).multiplyScalar(10000); // یک جای دور
    }

    // 4) تنظیمات روز/شب (ستاره/ابر/مه/اکسپوژر)
    function setDayNightExtras(sunAltDeg: number) {
        // اکسپوژر معقول برای Sky (روز روشن، شب کم‌نور)
        const day01 = THREE.MathUtils.smoothstep(sunAltDeg, -8, 10); // -8→شب، +10→روز
        renderer.toneMappingExposure = THREE.MathUtils.lerp(0.6, 1.0, day01);

        // نورها
        sunLight.intensity = THREE.MathUtils.lerp(0.0, 2.0, day01);
        ambient.intensity  = THREE.MathUtils.lerp(0.12, 0.35, day01);

        // Fog نرم و هم‌رنگ آسمان نزدیک افق
        const fogColor = new THREE.Color().setHSL(0.61, 0.5, THREE.MathUtils.lerp(0.06, 0.85, day01));
        scene.fog = new THREE.FogExp2(fogColor.getHex(), THREE.MathUtils.lerp(0.0006, 0.00015, day01));

        // اگر سیستم ستاره‌ها داری، همین‌جا فیدش کن:
        const starsOpacity =
            sunAltDeg > -2 ? 0 :
                sunAltDeg < -12 ? 1 :
                    (sunAltDeg > -6)
                        ? (((-sunAltDeg - 2) / 4) * 0.4) // -2→-6 : 0→0.4
                        : (0.4 + ((-sunAltDeg - 6) / 6) * 0.6); // -6→-12 : 0.4→1
        (scene as any).__setStarsOpacity__?.(starsOpacity); // اگر هُک گذاشتی
    }

    return { sky, sunLight, ambient, setFromAltAz, setDayNightExtras };
}
