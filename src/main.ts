import * as THREE from 'three';
import {createRenderer} from './core/renderer';
import {createLoaders} from './core/loaders';
import {startLoop} from './core/loop';
import {buildScene} from './scene/buildScene';
import {PATHS} from './config';
import {Player} from './scene/player';
import {mountGUI} from './ui/gui';
import {spawnOnTerrain} from "./utils/spawn.ts";
import {getUserLocation} from "./services/geo.ts";
import {computeSunMoon} from "./services/astro.ts";
import {setupSkyBackground} from "./scene/skydomeSafe.ts";
import {setIslandWireframe} from "./utils/islandWireframe.ts";
//import {createSky} from "./scene/sky.ts";

const renderer = createRenderer();
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
(scene as any).__renderer__ = renderer;
const player = new Player(scene);

const {gltf} = createLoaders(renderer, PATHS.BASIS);

const {terrain, bounds, center,sky, clouds} =
    await buildScene(scene, player.camera as THREE.PerspectiveCamera,renderer, gltf, {island: PATHS.ISLAND}, );
//terrain.traverse((o:any)=> o.isMesh && (o.material = new THREE.MeshBasicMaterial({color:0xcccccc, wireframe:true})));
let wireOn = true;
//setIslandWireframe(terrain, wireOn);
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 't') {
        setIslandWireframe(terrain, wireOn);
    }
});
// ---- یک بار محاسبهٔ جغرافیا/هوا/نجوم ----
const { lat, lon } = await getUserLocation();
//const weather = await fetchWeather(lat, lon);
// فقط اگر بالای افق هستن
const now = new Date();
 now.setHours(6, 15, 0, 0);
// // اگر ابری باشه (مثلاً بیشتر از 70٪)
// const cloudy = (weather.cloudCoverPct ?? 0) > 70;
const skyBG = setupSkyBackground(scene, renderer);
const astro = computeSunMoon(lat, lon, now);
skyBG.setSunByAltAz(astro.sun.altitudeDeg, astro.sun.azimuthDeg);
skyBG.setDayNightExtras(astro.sun.altitudeDeg);

const daylight = THREE.MathUtils.smoothstep(astro.sun.altitudeDeg, -0.05, 0.25);
clouds.setDaylight(daylight);
sky.setStarsBySun(astro.sun.altitudeDeg);
(scene as any).__setSkyDay__ = (d:number)=> clouds.setDaylight(d);

await spawnOnTerrain(player, terrain, { center, searchRadius: 30, tries: 25 });
// GUI (اختیاری)
if (import.meta.env.DEV) {
    mountGUI({renderer, player });
}

//const canvas = (renderer as any)?.domElement ?? document.querySelector('canvas')!;
//  initCoordCapture({
//     camera:player.camera,
//     terrain,   // همان آبجکت زمین که اسپاون با آن کار می‌کند
//     dom: canvas,
//     storageKey: 'island_editor.coords',
//     hud: true,
// });

startLoop(renderer, scene, player.camera, (dt) => {
    // نزدیک مرز، کند شو (اختیاری)
    const baseSpeed = player.maxSpeed;
    const slow = bounds.slowdownFactor(player.capsule.end);
    player.maxSpeed = baseSpeed * slow;

    // به‌روزرسانی پلیر
    player.applyInputs(dt, terrain,);
    player.maxSpeed = baseSpeed;
    // مرز
    bounds.update(dt, player);
    (scene as any).__skyTick__?.(dt, player.camera);
    // آب
    (scene as any).__waterTick__?.(dt);

    (scene as any).__cloudTick__?.(dt);
    (scene as any).__treesTick__?.(player.camera);

    (scene as any).__rayVizTick__?.();

});
