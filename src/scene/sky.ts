// src/scene/sky.ts
import * as THREE from 'three';

export type Sky = {
    group: THREE.Group;
    setDaylight: (day01: number) => void;
    setStarsBySun: (altDeg:number,sunDir?:THREE.Vector3) => void;// 0=شب، 1=روز
    starsOpacityFromSunAlt: (altDeg:number) => number;
    tick: (dt: number, camera: THREE.Camera) => void;
};

export function createSky(opts?: {
    radius?: number;         // شعاع کرهٔ ستاره‌ها
    starCount?: number;      // تعداد ستاره‌ها
    starSize?: number;       // اندازه پیکسلی ستاره
    cloudY?: number;         // ارتفاع ابرها
    cloudSpeed?: number;     // سرعت اسکرول UV
    cloudRepeat?: number;    // تکرار تکسچر
}) : Sky {
    const {
        radius = 5000,
        starCount = 3000,
        starSize = 1.5,
    } = opts ?? {};

    const group = new THREE.Group();

    // ---------- Stars ----------
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        // نقاط روی کرهٔ واحد
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);
        positions.set([x * radius, y * radius, z * radius], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: starSize,
        sizeAttenuation: false,   // اندازه پیکسلی ثابت (استایل ماین‌کرفت)
        transparent: true,
        blending: THREE.AdditiveBlending
    });
    starMat.depthWrite = false;
    starMat.depthTest  = true;
    const stars = new THREE.Points(starGeo, starMat);
    stars.renderOrder=-5;
    group.add(stars);


    function setDaylight(day01: number) {
        // ستاره‌ها در روز محو شوند (اما نه ناگهان)
        const starOpacity = 1.0 - THREE.MathUtils.smoothstep(day01, 0.05, 0.2);
        starMat.opacity = starOpacity;
        stars.visible = starOpacity > 0.02;

        // شب کمی ابرها را پررنگ‌تر (حس کنتراست)
        //cloudMat.opacity = THREE.MathUtils.lerp(0.65, 0.9, 1 - day01);
    }
    function starsOpacityFromSunAlt(altDeg:number){
        if (altDeg > -2) return 0;
        if (altDeg < -12) return 1;
        // دو مرحله: -2→-6 (0→0.4) و -6→-12 (0.4→1)
        if (altDeg > -6) return ( (-altDeg - 2) / 4 ) * 0.4;
        return 0.4 + ( (-altDeg - 6) / 6 ) * 0.6;
    }
    function setStarsBySun(altDeg: number, sunDir?: THREE.Vector3) {
        // 0..1: 0 = روز، 1 = شب کامل
        // بین -6 و -12 محو/ظاهر می‌شوند
        const a = altDeg;
        let night01 = 0;
        if (a < -6) night01 = THREE.MathUtils.clamp((-a - 6) / 6, 0, 1); // -6→0 , -12→1
        stars.material.opacity = night01;
        stars.visible = night01 > 0.02;

        // اگر خواستی اطراف خورشید ستاره‌ها خاموش‌تر شوند:
        // (برای PointsMaterial ساده نیست جهت‌محور؛ اگر shader برای ستاره‌ها خواستی بگم چطور)
    }
    function tick(dt: number, camera: THREE.Camera) {
        // حرکت آرام ابرها
        // (cloudMat.map as THREE.Texture).offset.x += cloudSpeed * dt;
        // (cloudMat.map as THREE.Texture).offset.y += cloudSpeed * 0.33 * dt;

        // آسمان را به دوربین قفل کن تا «بی‌نهایت» حس شود
        const cp = (camera as THREE.PerspectiveCamera).position;
        group.position.set(cp.x, 0, cp.z);
    }

    return { group, setDaylight,setStarsBySun, tick, starsOpacityFromSunAlt };
}
