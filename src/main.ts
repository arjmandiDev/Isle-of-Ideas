import * as THREE from 'three';
import { createRenderer } from './core/renderer';
import { createCamera } from './core/camera';
import { createControls } from './core/controls';
import { createLoaders } from './core/loaders';
import { startLoop } from './core/loop';
import { buildScene } from './scene/buildScene';
import { PATHS } from './config';

const renderer = createRenderer();
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = createCamera();
const controls = createControls(camera, renderer.domElement);

const { gltf } = createLoaders(renderer, PATHS.BASIS);
buildScene(scene, camera as THREE.PerspectiveCamera, gltf, { island: PATHS.ISLAND });

startLoop({ renderer, scene, camera, controls });
