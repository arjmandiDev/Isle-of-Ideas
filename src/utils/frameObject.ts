import * as THREE from 'three';
export function frameObject(obj: THREE.Object3D, camera: THREE.PerspectiveCamera, fit=1.15) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const max = Math.max(size.x, size.y, size.z);
    const dist = (max/2)/Math.tan(THREE.MathUtils.degToRad(camera.fov*0.5))*fit;
    // camera.near = Math.max(0.1, dist/500);
    // camera.far  = dist*500;
    // camera.updateProjectionMatrix();
    // camera.position.copy(center.clone().add(new THREE.Vector3(0,0,dist)));
    // camera.lookAt(center);
}
