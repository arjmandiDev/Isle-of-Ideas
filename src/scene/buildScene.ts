import * as THREE from 'three';
import { loadTerrain } from './terrain';
import { frameObject } from '../utils/frameObject';
import { createPixelWater } from './water';
import { createWorldBounds } from './bounds';
import { createEnvironment } from './environment';

type URLs = { island: string };

export async function buildScene(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    gltf: any,
    urls: URLs
) {
    // زمین
    const terrain = await loadTerrain(gltf, urls.island);
    scene.add(terrain);

    // مه سبک
    scene.fog = new THREE.FogExp2(0xa7d4ff, 0.0005);

    // آب
    const WATER_Y = 6.5; // تیون با دادهٔ خودت
    const water = createPixelWater({ y: WATER_Y, size: 8000, opacity: 0.8 });
    scene.add(water);
    (scene as any).__waterTick__ = (dt: number) => (water as any).tick?.(dt);

    // مرز دنیا
    const box = new THREE.Box3().setFromObject(terrain);
    const center = box.getCenter(new THREE.Vector3());
    const radiusIsland = Math.hypot(box.max.x - center.x, box.max.z - center.z);
    const softRadius = radiusIsland + 80;
    const hardRadius = softRadius + 60;
    const bounds = createWorldBounds({ center, softRadius, hardRadius });
    scene.add(bounds.group);

    // محیط: خورشید/ماه مربعی + نور
    const env = createEnvironment(scene, 5000);

    // قاب‌بندی اولیه
    frameObject(terrain, camera, 1.2);

    return { terrain, water, bounds, env, center };
}
