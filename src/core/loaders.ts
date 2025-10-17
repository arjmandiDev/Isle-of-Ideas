import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as THREE from 'three';

export function createLoaders(renderer: THREE.WebGLRenderer, basisPath: string) {
    const gltf = new GLTFLoader();
    gltf.setMeshoptDecoder(MeshoptDecoder);
    if (basisPath){
        const ktx2 = new KTX2Loader().setTranscoderPath(basisPath).detectSupport(renderer);
        gltf.setKTX2Loader(ktx2);
    }
    return { gltf };
}
