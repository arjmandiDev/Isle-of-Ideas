// src/ui/gui.ts
import GUI from 'lil-gui';
import * as THREE from 'three';
import type {Player} from "../scene/player.ts";

export function mountGUI({ renderer, sun, player }: { renderer: THREE.WebGLRenderer; sun: THREE.DirectionalLight; player: Player }) {
    const gui = new GUI();

    // پارامترهای UI
    const params = {
        pixelRatio: 1,
        exposure: 1,
        sunIntensity: sun.intensity,
    };

    const fRender = gui.addFolder('Renderer');
    fRender.add(params, 'pixelRatio', 0.5, 2, 0.1).onChange((v: number) => {
        renderer.setPixelRatio(v);
    });
    fRender.add(renderer, 'toneMapping', {
        None: THREE.NoToneMapping,
        ACES: THREE.ACESFilmicToneMapping,
        Cineon: THREE.CineonToneMapping,
        Reinhard: THREE.ReinhardToneMapping,
    }).onChange(() => renderer.toneMappingNeedsUpdate = true);
    fRender.add(params, 'exposure', 0.1, 2, 0.01).onChange((v: number) => {
        renderer.toneMappingExposure = v;
    });

    const fCam = gui.addFolder('Camera');
    fCam.add(player.camera, 'fov', 30, 90, 1).onChange(() => player.camera.updateProjectionMatrix());

    const fLight = gui.addFolder('Sun');
    fLight.add(params, 'sunIntensity', 0, 2, 0.01).onChange((v: number) => sun.intensity = v);
    fLight.add(sun.position, 'x', -2000, 2000, 1);
    fLight.add(sun.position, 'y', 0, 3000, 1);
    fLight.add(sun.position, 'z', -2000, 2000, 1);

    const fPlayer = gui.addFolder('Player');
    fPlayer.add(player, 'maxSpeed',1,20).name('Max Speed');
    return gui;
}
