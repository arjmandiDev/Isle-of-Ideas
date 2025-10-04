// skyEnv-safe.ts
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export function setupSkyBackground(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    // 1) Sky بساز ولی تو صحنه نذار
    const sky = new Sky();
    (sky.material as THREE.ShaderMaterial).uniforms['turbidity'].value = 2.5;
    (sky.material as THREE.ShaderMaterial).uniforms['rayleigh'].value = 1.1;
    (sky.material as THREE.ShaderMaterial).uniforms['mieCoefficient'].value = 0.003;
    (sky.material as THREE.ShaderMaterial).uniforms['mieDirectionalG'].value = 0.78;
    (sky.material as THREE.ShaderMaterial).uniforms['sunPosition'].value.set(0,1,0);

    // 2) PMREM از صحنه‌ی Sky بساز و آن را هم برای بک‌گراند و هم environment استفاده کن
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    function applyEnvFromSky() {
        // از خود Sky (به‌صورت یک صحنهٔ موقت) env/background بساز
        const rt = pmrem.fromScene(sky);  // ← کلید طلایی
        // ابتدا قبلی‌ها را آزاد کن (اگر قبلاً ست شده)
        const oldBG = scene.background as THREE.Texture;
        const oldEnv = scene.environment as THREE.Texture;
        scene.background = rt.texture;
        scene.environment = rt.texture;
        // پاک‌سازی‌های قبلی
        oldBG?.dispose?.(); oldEnv?.dispose?.();

        // rt را بعداً که دوباره ساختی، rt.dispose() کن
        return rt;
    }

    let currentRT = applyEnvFromSky();

    // 3) آپدیت خورشید
    function setSunByAltAz(altDeg: number, azDeg: number) {
        const alt = THREE.MathUtils.degToRad(altDeg);
        const az  = THREE.MathUtils.degToRad(azDeg);
        const ca = Math.cos(alt), sa = Math.sin(alt);
        const cz = Math.cos(az),  sz = Math.sin(az);
        const sun = new THREE.Vector3(sz*ca, sa, cz*ca);
        (sky.material as THREE.ShaderMaterial).uniforms['sunPosition'].value.copy(sun);

        // هر بار که خورشید عوض شد، env/background را دوباره بساز
        currentRT.dispose();
        currentRT = applyEnvFromSky();
    }

    // 4) اکسپوژر و نور ملایم (دلخواه)
    function setDayNightExtras(sunAltDeg: number) {
        const day01 = THREE.MathUtils.smoothstep(sunAltDeg, -8, 10);
        renderer.toneMappingExposure = THREE.MathUtils.lerp(0.7, 1.0, day01);
        // اگر زمینت PBR نیست و MeshBasicه، این‌ها خیلی اثر ندارن—اوکیه
    }

    return { setSunByAltAz, setDayNightExtras, dispose: () => { currentRT.dispose(); } };
}
