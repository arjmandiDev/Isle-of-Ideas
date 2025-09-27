import * as THREE from 'three';
import {createRenderer} from './core/renderer';
import {createLoaders} from './core/loaders';
import {startLoop} from './core/loop';
import {buildScene} from './scene/buildScene';
import {PATHS} from './config';
import {Player} from "./scene/player.ts";
import {mountGUI} from "./ui/gui.ts";
import {spawnOnTerrain} from "./utils/spawn.ts";

const renderer = createRenderer();
document.getElementById('app')!.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const player = new Player(scene);

//const controls = createControls(player.camera, renderer.domElement);

const {gltf} = createLoaders(renderer, PATHS.BASIS);
const { sun, terrainRoot } = await buildScene(scene, player.camera as THREE.PerspectiveCamera, gltf, { island: PATHS.ISLAND });
spawnOnTerrain(scene, terrainRoot, player.capsule, player.camera);
//const sun = addOutdoorLights(scene);
if (import.meta.env.DEV) {
    // نور خورشید را از lighting برگردان اگر لازم داری به GUI وصل شود
    mountGUI({ renderer, player, sun });
}
startLoop(renderer, scene, player.camera, (dt) => {
    player.applyInputs(dt, terrainRoot);  // dt=0 وقتی تب hidden/blur
}, { maxDelta: 1/30, pauseWhenHidden: true });
//startLoop({renderer, scene, player});
