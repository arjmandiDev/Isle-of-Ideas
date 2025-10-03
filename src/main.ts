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
import {fetchWeather, labelFromWMO} from "./services/weather.ts";
import {computeSunMoon} from "./services/astro.ts";
import {createEnvironment} from "./scene/environment.ts";

const renderer = createRenderer();
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const player = new Player(scene);

const {gltf} = createLoaders(renderer, PATHS.BASIS);

const {terrain, bounds, center, sky} =
    await buildScene(scene, player.camera as THREE.PerspectiveCamera, gltf, {island: PATHS.ISLAND});

// ---- یک بار محاسبهٔ جغرافیا/هوا/نجوم ----
const { lat, lon } = await getUserLocation();
const weather = await fetchWeather(lat, lon);
// فقط اگر بالای افق هستن
const now = new Date();
const astro = computeSunMoon(lat, lon, now);
const moonVisible = astro.moon.altitudeDeg > 0;
const sunVisible = astro.sun.altitudeDeg > 0;

// اگر ابری باشه (مثلاً بیشتر از 70٪)
const cloudy = (weather.cloudCoverPct ?? 0) > 70;

const env = createEnvironment(scene,5000)
env.sunPlane.visible = sunVisible && !cloudy;
env.moonPlane.visible = moonVisible && !cloudy;
console.log('Sun alt=', astro.sun.altitudeDeg, 'Moon alt=', astro.moon.altitudeDeg);
// نور خورشید/ماه ضعیف‌تر در شرایط ابری
if (cloudy) {
    env.sunLight.intensity *= 0.3;
    env.moonLight.intensity *= 0.5;
}

const daylight = THREE.MathUtils.smoothstep(astro.sun.altitudeDeg, -0.05, 0.25);
sky.setDaylight(daylight);
(scene as any).__setSkyDay__ = (d:number)=> sky.setDaylight(d);


//; // ← فقط همین یک‌بار
env.updateFromAstro({
    sunAltDeg:  astro.sun.altitudeDeg,
    sunAzDeg:   astro.sun.azimuthDeg,
    moonAltDeg: astro.moon.altitudeDeg,
    moonAzDeg:  astro.moon.azimuthDeg,
    camera:     player.camera
});
await spawnOnTerrain(player, terrain, { center, searchRadius: 30, tries: 25 });
// GUI (اختیاری)
if (import.meta.env.DEV) {
    mountGUI({renderer, player, env});
}

// چرخه روز/شب

startLoop(renderer, scene, player.camera, (dt) => {
    // نزدیک مرز، کند شو (اختیاری)
    const baseSpeed = player.maxSpeed;
    const slow = bounds.slowdownFactor(player.capsule.end);
    player.maxSpeed = baseSpeed * slow;

    // به‌روزرسانی پلیر
    player.applyInputs(dt, terrain);
    player.maxSpeed = baseSpeed;
    // مرز
    bounds.update(dt, player);
    (scene as any).__skyTick__?.(dt, player.camera);
    // آب
    (scene as any).__waterTick__?.(dt);


});
