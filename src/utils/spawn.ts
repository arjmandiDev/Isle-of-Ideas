import * as THREE from 'three';
import type {Player} from "../scene/player.ts";

export type SpawnOpts = {
    center?: THREE.Vector3;   // اگر ندی از باکسِ terrain محاسبه می‌کنیم
    searchRadius?: number;    // شعاع جست‌وجوی تصادفی پیرامون مرکز
    rayStartYOffset?: number; // از چه ارتفاعی Ray بیفته پایین
    groundEps?: number;       // فاصلهٔ ایمن از زمین
    tries?: number;           // حداکثر تلاش‌ها
    faceCenter?: boolean;     // بعد از اسپاون به سمت مرکز نگاه کن
};

export async function spawnOnTerrain(
    player: Player,
    terrain: THREE.Object3D,
    opts: SpawnOpts = {}
) {
    const searchRadius   = opts.searchRadius   ?? 40;
    const rayStartYOffset= opts.rayStartYOffset?? 300;
    const groundEps      = opts.groundEps      ?? 0.02;
    const tries          = opts.tries          ?? 20;

    // مرکز پیش‌فرض: مرکز هندسیِ جزیره
    const box = new THREE.Box3().setFromObject(terrain);
    const center = (opts.center ?? box.getCenter(new THREE.Vector3())).clone();

    // طول سگمنت کپسول (فاصله بین start و end)
    const segLen = player.capsule.end.clone().sub(player.capsule.start).length();
    const radius = player.capsule.radius;

    const ray = new THREE.Raycaster();
    ray.ray.direction.set(0, -1, 0);
    ray.far = rayStartYOffset + 1000;

    // چند تلاش: نقطه‌ای تصادفی دورِ مرکز انتخاب کن و Ray بزن پایین
    for (let i = 0; i < tries; i++) {
        const ang = (Math.random() * Math.PI * 2);
        const r   = Math.random() * searchRadius;
        const x = center.x + Math.cos(ang) * r;
        const z = center.z + Math.sin(ang) * r;
        const y = box.max.y + rayStartYOffset;

        ray.ray.origin.set(x, y, z);
        const hit = ray.intersectObject(terrain, true)[0];
        if (!hit) continue;

        const groundY = hit.point.y;
        const startY  = groundY + radius + groundEps;

        // جایگذاری کپسول
        player.capsule.start.set(x, startY, z);
        player.capsule.end.set(x, startY + segLen, z);

        // وضعیت فیزیک پلیر
        player['velocityY'] = 0;
        player['onGround'] = true;

        // دوربین روی رأس کپسول
        player.camera.position.copy(player.capsule.end);

        // (اختیاری) به سمت مرکز نگاه کند
        if (opts.faceCenter ?? true) {
            const look = new THREE.Vector3(center.x, startY + 1.5, center.z);
            player.camera.lookAt(look);
        }

        return true; // موفق
    }

    console.warn('spawnOnTerrain: نتوانستیم نقطهٔ امن پیدا کنیم؛ روی مرکز با بالابردن Y می‌گذاریم.');
    // fallback: وسطِ جزیره کمی بالاتر
    const x = center.x, z = center.z, startY = box.max.y + 2;
    player.capsule.start.set(x, startY, z);
    player.capsule.end.set(x, startY + segLen, z);
    player.camera.position.copy(player.capsule.end);
    player['velocityY'] = 0;
    player['onGround'] = true;
    return false;
}
