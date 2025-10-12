import * as THREE from 'three';
import { loadTerrain } from './terrain';
import { frameObject } from '../utils/frameObject';
import { createPixelWater } from './water';
import { createWorldBounds } from './bounds';
import { createSky } from './sky';
import { createBlockClouds } from './blockClouds';
import { PATHS } from '../config';
import { initTreeEditor } from '../utils/treeEditor';
import { preloadTreePrototypes } from './preloadTreePrototypes';
import { spawnTreesFromLayout } from './spawnTreesFromLayout';
import type {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {RayViz} from "../utils/rayViz.ts";
import {setIslandWireframe} from "../utils/islandWireframe.ts";

type URLs = { island: string };

export async function buildScene(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    gltf: GLTFLoader,
    urls: URLs = { island: PATHS.ISLAND },
) {
    // --- TERRAIN --------------------------------------------------------------
    //const { gltf } = (window as any).__loaders ?? { gltf: null };
    if (!gltf) throw new Error('GLTF loader not found. Ensure createLoaders() attached to window.');

    const terrain = await loadTerrain(gltf, urls.island);
    terrain.updateMatrixWorld(true);
    scene.add(terrain);


    // مرکز/شعاع تقریبی برای قاب‌بندی
    const box = new THREE.Box3().setFromObject(terrain);
    const center = box.getCenter(new THREE.Vector3());
    const radiusIsland = box.getSize(new THREE.Vector3()).length() * 0.5;

    // آسمان/ابر/آب/مرز (مثل قبل)
    const sky = createSky({ bgHex: 0x78a7ff, fogDensity: 0.0024 });
    scene.add(sky.group);
    (scene as any).__skyTick__ = (dt: number, cam: THREE.Camera) => sky.tick(dt, cam);

    const clouds = createBlockClouds({ areaSize: 1024, cell: 16, thickness: 1, height: 220, density: 0.6, speed: 1.0 });
    scene.add(clouds.group);
    (scene as any).__cloudTick__ = (dt: number) => clouds.tick(dt);

    const WATER_Y = 6.5;
    const water = createPixelWater({ y: WATER_Y, size: 8000, opacity: 0.95 });
    scene.add(water);
    (scene as any).__waterTick__ = (dt: number) => (water as any).tick?.(dt);

    const bounds = createWorldBounds({
        center: center.clone(),
        softRadius: Math.max(300, radiusIsland * 0.6),
        hardRadius: Math.max(500, radiusIsland * 0.9),
        waterY: WATER_Y,
    });
    scene.add(bounds.group);

    frameObject(terrain, camera, 1.2);

    // --- TREES (بازنویسی‌شده با local→world) --------------------------------

    // 1) پیش‌بارگذاری پروتوتایپ‌ها
    const protos = await preloadTreePrototypes(gltf, PATHS.TREES);

    // 2) خواندن لیست از استوریج
    type Rec = { type: string; pos: [number, number, number]; rotY?: number; scale?: number; space?: 'terrain-local'|'world' };
    let list: Rec[] = [];
    try {
        const raw = localStorage.getItem('island_editor.trees');
        if (raw) list = JSON.parse(raw);
    } catch {}

    // 3) تبدیل لوکالِ terrain → ورلد برای اسپاون
    const toWorld = (p: [number, number, number]) => {
        const v = new THREE.Vector3().fromArray(p);
        terrain.localToWorld(v);
        return v.toArray() as [number, number, number];
    };

    // اگر رکوردها space نداشتند، از این به بعد همه را terrain-local فرض می‌کنیم (داده‌های قدیمی اهمیتی ندارد)
    const listWorld: Rec[] = list.map(r => ({
        ...r,
        pos: toWorld(r.pos),
        space: 'world',
    }));

    // 4) اسپاون instanced با ورودی world-space
    const treesGroup = spawnTreesFromLayout(scene, protos, listWorld as any, {
        chunkSize: 128,
        cullDistance: radiusIsland + 300,
    });
    scene.add(treesGroup);

    // tick کالینگ فاصله‌ای
    (scene as any).__treesTick__ = (cam: THREE.Camera) => {
        (treesGroup as any).tick?.(cam);
    };

    // 5) ادیتور: از حالا ذخیره‌ها terrain-local هستند
    const editor = initTreeEditor({
        scene, camera, renderer, terrain,
        storageKey: 'island_editor.trees', // همان کلید قبلی، ولی مدل داده جدید
        defaultType: 'tree_type1',
        hud: true,
    });
    // اگر terrain تعویض شد:
    editor.refreshTargets();

    const rayViz = new RayViz({
        scene,
        camera,
        renderer,
        targets: [terrain],                 // مهم: هدف Ray خودِ terrain است
        layerMask: terrain.layers.mask,     // اگر لایه خاصی داری
        showNormal: true,
        maxDistance: 5000,
    });
    (scene as any).__rayVizTick__ = () => rayViz.update();

    return { terrain, water, bounds, center, sky, clouds };
}
