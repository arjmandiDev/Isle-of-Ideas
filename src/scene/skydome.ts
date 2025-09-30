import * as THREE from "three";

export function createSkyDome(radius=550, top= 0x87c8ff, horizon = 0xbbe1ff){
    const geo = new THREE.SphereGeometry(radius, 32,24);
    geo.scale(-1,1,1);

    const colTop = new THREE.Color(top);
    const colHor = new THREE.Color(horizon);
    const attr = geo.getAttribute('position');
    const colors = new Float32Array(attr.count * 3);
    for (let i = 0; i < attr.count; i++) {
        const y = attr.getY(i)/radius;
        const t = THREE.MathUtils.smoothstep((y+0.2),-0.2,0.8);
        const c = colHor.clone().lerp(colTop, t);
        colors[i*3] = c.r;
        colors[i*3+1] = c.g;
        colors[i*3+2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors,3));

    const mat = new THREE.MeshBasicMaterial({ vertexColors:true, depthWrite: false });
    const dome = new THREE.Mesh(geo, mat)
    dome.renderOrder = -1;
    return dome;
}