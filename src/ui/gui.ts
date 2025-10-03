// src/ui/gui.ts
import GUI from 'lil-gui';
import * as THREE from 'three';
import type { Player } from '../scene/player';
import type { Environment } from '../scene/environment';

export function mountGUI({
                             renderer,
                             player,
                             env
                         }: {
    renderer: THREE.WebGLRenderer;
    player: Player;
    env: Environment;
}) {
    const gui = new GUI();

    const params = {
        pixelRatio: 1,
        exposure: 1,
        time: 0.25
    };

    const fRender = gui.addFolder('Renderer');
    fRender.add(params, 'pixelRatio', 0.5, 2, 0.1).onChange((v: number) => renderer.setPixelRatio(v));
    fRender.add(params, 'exposure', 0.1, 2, 0.01).onChange((v: number) => {
        renderer.toneMappingExposure = v;
    });

    const fCam = gui.addFolder('Camera');
    fCam.add(player.camera, 'fov', 30, 90, 1).onChange(() => player.camera.updateProjectionMatrix());

    const fPlayer = gui.addFolder('Player');
    fPlayer.add(player, 'maxSpeed', 1, 20, 0.1).name('Max Speed');

    // const fEnv = gui.addFolder('Environment');
    // fEnv.add(params, 'time', 0, 1, 0.001).name('Time of Day').onChange((v: number) => {
    //     env.update(v, player.camera);
    // });

    return gui;
}
