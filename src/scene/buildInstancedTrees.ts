import * as THREE from 'three';

export type TreePartBase = { mode: 'base'; name: string; geo: THREE.BufferGeometry; mat: THREE.Material; baseLocal: THREE.Matrix4 };
export type TreePart = TreePartBase;

type CommonOpts = {
    rotationsY?: number[];
    scales?: number[];
    uniformScale?: number;
    scale?: number;
    chunkSize?: number;
    frustumCulled?: boolean;
    cullDistance?: number;
    debugColor?: number;
    yOffset?: number;
    anchorCorrection?: THREE.Matrix4;    // C
    uprightCorrection?: THREE.Matrix4;   // U
    orientCorrection?: THREE.Matrix4;    // O
    yLift?: number;
};

function maxDistanceFromOrigin(positions: Array<[number, number, number]>) {
    let m = 0;
    for (const [x, y, z] of positions) { const d2 = x*x + y*y + z*z; if (d2 > m) m = d2; }
    return Math.sqrt(m);
}

export function buildInstancedTrees(
    parts: TreePart[],
    positions: Array<[number, number, number]>,
    opts?: CommonOpts
) {
    positions = positions.map(([x,y,z]) => [Number(x), Number(y), Number(z)]) as Array<[number,number,number]>;

    const chunkSize = opts?.chunkSize ?? 128;
    const wantFrustum = opts?.frustumCulled ?? true;
    const cullDistance = opts?.cullDistance ?? 0;
    const debugColor = opts?.debugColor;
    const yOffset = opts?.yOffset ?? 0;

    const C = (opts?.anchorCorrection && (opts.anchorCorrection.elements ?? []).every(Number.isFinite))
        ? opts.anchorCorrection : new THREE.Matrix4();

    const O = (opts?.orientCorrection && (opts.orientCorrection.elements ?? []).every(Number.isFinite))
        ? opts.orientCorrection : new THREE.Matrix4();

    const yLift = Number.isFinite(opts?.yLift as number) ? (opts?.yLift as number) : 0;


    // چانک
    const chunks = new Map<string, number[]>();
    const keyOf = (x:number,z:number) => `${Math.floor(x/chunkSize)}_${Math.floor(z/chunkSize)}`;
    for (let i=0;i<positions.length;i++) {
        const [x,,z] = positions[i];
        const key = keyOf(x,z);
        (chunks.get(key) ?? chunks.set(key, []).get(key)!).push(i);
    }

    const group = new THREE.Group();
    group.name = 'TreesInstancedChunkedGroup';

    const R = new THREE.Matrix4(), S = new THREE.Matrix4(), M = new THREE.Matrix4(), Trel = new THREE.Matrix4();

    for (const [key, idxList] of chunks) {
        const c = new THREE.Vector3();
        for (const i of idxList) { const [x,y,z] = positions[i]; c.x += x; c.y += y; c.z += z; }
        c.multiplyScalar(1/idxList.length);

        for (const p of parts) {
            const count = idxList.length;

            const geo = p.geo; // بدون compute* روی geometry
            let mat = p.mat;
            if ((mat as any).isMaterial) mat = (mat as any).clone();
            if (debugColor != null && 'color' in (mat as any) && (mat as any).color?.setHex) {
                (mat as any).color.setHex(debugColor);
                (mat as any).needsUpdate = true;
            }

            const inst = new THREE.InstancedMesh(geo, mat, count);
            inst.name = `Inst_${p.name}_${key}`;
            inst.matrixAutoUpdate = false;
            inst.frustumCulled = wantFrustum;

            inst.position.copy(c);
            inst.updateMatrix();

            const baseLocal = p.baseLocal;

            for (let k=0;k<count;k++) {
                const i = idxList[k];
                const [x, y, z] = positions[i];
                const ry = opts?.rotationsY?.[i] ?? 0;
                const s  = opts?.scales?.[i] ?? (opts?.uniformScale ?? opts?.scale ?? 1);

                Trel.setPosition(x - c.x, (y - c.y) + yOffset + yLift, z - c.z);
                R.makeRotationY(ry);
                S.makeScale(s, s, s);

// ترتیب نهایی: TRS · O · C · baseLocal
                M.copy(Trel).multiply(R).multiply(S).multiply(O).multiply(C).multiply(baseLocal);
                inst.setMatrixAt(k, M);
            }
            inst.instanceMatrix.needsUpdate = true;

            // BoundingSphere ساده (بدون compute*)
            if (!inst.geometry.boundingSphere) {
                const radius = Math.max(1, maxDistanceFromOrigin(positions)) + 5;
                inst.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,0,0), radius);
            }

            group.add(inst);
        }
    }

    (group as any).tick = (camera: THREE.Camera) => {
        if (!cullDistance) return;
        const camPos = (camera as any).position as THREE.Vector3;
        for (const child of group.children) {
            const inst = child as THREE.InstancedMesh;
            const d2 = inst.position.distanceToSquared(camPos);
            const r  = inst.geometry.boundingSphere?.radius ?? 0;
            inst.visible = d2 <= (cullDistance + r) * (cullDistance + r);
        }
    };

    return group;
}

export const buildChunkedInstancedTrees = buildInstancedTrees;
