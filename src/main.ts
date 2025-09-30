import * as THREE from 'three';
import {createRenderer} from './core/renderer';
import {createLoaders} from './core/loaders';
import {startLoop} from './core/loop';
import {buildScene} from './scene/buildScene';
import {PATHS} from './config';
import {Player} from './scene/player';
import {mountGUI} from './ui/gui';
import {spawnOnTerrain} from "./utils/spawn.ts";

const renderer = createRenderer();
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const player = new Player(scene);

const {gltf} = createLoaders(renderer, PATHS.BASIS);

const {terrain, bounds, env, center} =
    await buildScene(scene, player.camera as THREE.PerspectiveCamera, gltf, {island: PATHS.ISLAND});

await spawnOnTerrain(player, terrain, { center, searchRadius: 30, tries: 25 });
// GUI (اختیاری)
if (import.meta.env.DEV) {
    mountGUI({renderer, player, env});
}

// چرخه روز/شب
let time01 = 0.25;        // 0 = نیمه‌شب، 0.5 = ظهر
const timeScale = 180;     // ×زمان واقعی

startLoop(renderer, scene, player.camera, (dt) => {
    // نزدیک مرز، کند شو (اختیاری)
    const baseSpeed = player.maxSpeed;
    const slow = bounds.slowdownFactor(player.capsule.end);
    player.maxSpeed = baseSpeed * slow;

    // به‌روزرسانی پلیر
    player.applyInputs(dt, terrain);
    player.maxSpeed = baseSpeed;
// محیط: خورشید/ماه
    time01 = (time01 + dt * (timeScale / 86400)) % 1;
    env.update(time01, player.camera);
    // مرز
    bounds.update(dt, player);

    // آب
    (scene as any).__waterTick__?.(dt);


});
