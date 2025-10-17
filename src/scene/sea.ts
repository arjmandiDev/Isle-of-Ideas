import * as THREE from 'three';

const size = 4000;
const segs = 256;


const geom = new THREE.PlaneGeometry(size, size, segs, segs);

// موج: y = f(x,z,t)
const pos = geom.attributes.position as THREE.BufferAttribute;
const base = pos.array.slice() as Float32Array;
const clock = new THREE.Clock();

function animateSea() {
    const t = clock.getElapsedTime();
    for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        const x = base[ix + 0];
        const z = base[ix + 2];
        const y =
            Math.sin((x + t * 40) * 0.02) * 0.5 +
            Math.cos((z + t * 25) * 0.018) * 0.4;
        pos.setY(i, y);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
}
export function seaBuilder(scene) {
    const mat = new THREE.MeshStandardMaterial({
        color: 0x3ca4ff,
        roughness: 0.85,
        metalness: 0.0,
        flatShading: true,
    });

    geom.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(geom, mat);
    sea.position.y = 0;
    sea.receiveShadow = true;
    animateSea();
    // renderer.render(scene);
    scene.add(sea);
}
