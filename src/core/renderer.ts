import * as THREE from 'three';

export function createRenderer() {
    const r = new THREE.WebGLRenderer({ antialias:false, alpha:true, powerPreference:'high-performance' });
    r.setPixelRatio(1);
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    return r;
}