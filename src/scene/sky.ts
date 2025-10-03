// src/scene/sky.ts
import * as THREE from 'three';

export type Sky = {
    group: THREE.Group;
    setDaylight: (day01: number) => void;           // 0=شب، 1=روز
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
        cloudY = 900,
        cloudSpeed = 0.004,
        cloudRepeat = 32,
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
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const stars = new THREE.Points(starGeo, starMat);
    group.add(stars);

    // ---------- Clouds ----------
    const cloudTex = makePixelCloudTexture(256);
    cloudTex.magFilter = THREE.NearestFilter;
    cloudTex.minFilter = THREE.NearestFilter;
    cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
    cloudTex.repeat.set(cloudRepeat, cloudRepeat);

    const cloudMat = new THREE.MeshBasicMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.85,         // شب کمی تیره‌ترش می‌کنیم
        depthWrite: false,
        fog: false
    });

    const planeSize = radius * 2; // خیلی بزرگ، بیرون دید
    const clouds = new THREE.Mesh(new THREE.PlaneGeometry(planeSize, planeSize), cloudMat);
    clouds.rotation.x = -Math.PI / 2;  // رو به پایین
    clouds.position.y = cloudY;
    group.add(clouds);

    function setDaylight(day01: number) {
        // ستاره‌ها در روز محو شوند (اما نه ناگهان)
        const starOpacity = 1.0 - THREE.MathUtils.smoothstep(day01, 0.05, 0.2);
        starMat.opacity = starOpacity;
        stars.visible = starOpacity > 0.02;

        // شب کمی ابرها را پررنگ‌تر (حس کنتراست)
        cloudMat.opacity = THREE.MathUtils.lerp(0.65, 0.9, 1 - day01);
    }

    function tick(dt: number, camera: THREE.Camera) {
        // حرکت آرام ابرها
        (cloudMat.map as THREE.Texture).offset.x += cloudSpeed * dt;
        (cloudMat.map as THREE.Texture).offset.y += cloudSpeed * 0.33 * dt;

        // آسمان را به دوربین قفل کن تا «بی‌نهایت» حس شود
        const cp = (camera as THREE.PerspectiveCamera).position;
        group.position.set(cp.x, 0, cp.z);
    }

    return { group, setDaylight, tick };
}

// تکسچر ابر پیکسلی با Canvas (بدون فایل خارجی)
function makePixelCloudTexture(n: number) {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, n, n);

    const cell = 8; // شبکهٔ درشت برای حس پیکسلی
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let y = 0; y < n; y += cell) {
        for (let x = 0; x < n; x += cell) {
            if (Math.random() < 0.35) ctx.fillRect(x, y, cell, cell);
        }
    }
    // اگر بخوای می‌تونی لبه‌ها رو کمی نرم کنی (اما پیکسلی می‌مونه)
    return new THREE.CanvasTexture(c);
}
