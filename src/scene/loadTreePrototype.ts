// src/scene/loadTreePrototype.ts
import * as THREE from 'three';

export type TreePart =
    | { mode: 'base'; name: string; geo: THREE.BufferGeometry; mat: THREE.Material; baseLocal: THREE.Matrix4 };

const USE_MIPMAPS = false;

// فیکس جهت: Z-up → Y-up (در صورت نیاز می‌تونی محور را عوض کنی)
const ORIENT_FIX = new THREE.Matrix4().makeRotationX(+Math.PI / 2);
// اگر بعداً دیدی لازم است:  const ORIENT_FIX = new THREE.Matrix4().makeRotationZ(+Math.PI / 2);

// --- helpers (روی geometry اصلی compute* نمی‌زنیم) ---
function hasFinitePositions(geo: THREE.BufferGeometry): boolean {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos || !pos.array || pos.count === 0) return false;
    const arr = pos.array as ArrayLike<number>;
    for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i] as number)) return false;
    return true;
}

function boxAfterMatrix(geoSrc: THREE.BufferGeometry, M: THREE.Matrix4): THREE.Box3 | null {
    try {
        let g = geoSrc.clone();
        if (g.index) g = g.toNonIndexed();
        const pos = g.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!pos || !pos.array || pos.count === 0) return null;
        if (!(pos.array instanceof Float32Array)) {
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos.array as any), pos.itemSize, false));
        }
        g.applyMatrix4(M);
        g.computeBoundingBox();
        return g.boundingBox ? g.boundingBox.clone() : null;
    } catch {
        return null;
    }
}

function unionBoxes(boxes: THREE.Box3[]): THREE.Box3 | null {
    if (!boxes.length) return null;
    const out = boxes[0].clone();
    for (let i = 1; i < boxes.length; i++) out.union(boxes[i]);
    return out;
}

type ProtoOut = {
    parts: TreePart[];
    chosenMode: 'base';
    anchorCorrection: THREE.Matrix4;  // C
    orientCorrection: THREE.Matrix4;  // O
    yLift: number;                    // بالابر نرم
};

export async function loadTreePrototype(
    gltfLoader: { loadAsync: (url: string) => Promise<any> },
    url: string,
): Promise<ProtoOut> {
    const glb = await gltfLoader.loadAsync(url);
    const scene = glb.scene as THREE.Object3D;
    if (!scene) throw new Error('Tree GLB has no scene');

    const parts: TreePart[] = [];

    scene.traverse((o: any) => {
        if (!o?.isMesh || !o.geometry) return;

        const geoSrc = o.geometry as THREE.BufferGeometry;
        const matSrc = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.Material;

        // متریال ساده/واکسلی
        if ('map' in matSrc && (matSrc as any).map) {
            const tex = (matSrc as any).map as THREE.Texture;
            if (!USE_MIPMAPS) { tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; }
            tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
        }
        if ('vertexColors' in matSrc) (matSrc as any).vertexColors = false;
        if ('alphaTest' in matSrc && (matSrc as any).alphaTest == null) (matSrc as any).alphaTest = 0.5;
        (matSrc as any).side = THREE.FrontSide;
        (matSrc as any).depthWrite = true;
        (matSrc as any).needsUpdate = true;

        if (!hasFinitePositions(geoSrc)) {
            console.warn('[trees:base] skip part with invalid position:', url, o.name);
            return;
        }

        const baseLocal = new THREE.Matrix4().compose(
            o.position ?? new THREE.Vector3(),
            o.quaternion ?? new THREE.Quaternion(),
            o.scale ?? new THREE.Vector3(1, 1, 1),
        );

        parts.push({
            mode: 'base',
            name: o.name || 'tree_part',
            geo: geoSrc,           // بدون compute* روی اصلی
            mat: matSrc,
            baseLocal
        });
    });

    if (parts.length === 0) {
        console.warn('[trees:base] no valid parts after load:', url);
        return {
            parts: [],
            chosenMode: 'base',
            anchorCorrection: new THREE.Matrix4(),
            orientCorrection: new THREE.Matrix4(),
            yLift: 0,
        };
    }

    // anchor در فضای O ∘ baseLocal تا نقطهٔ کف دقیقاً کفِ ایستاده باشد
    const boxes: THREE.Box3[] = [];
    for (const p of parts) {
        const M = new THREE.Matrix4().multiplyMatrices(ORIENT_FIX, p.baseLocal);
        const bb = boxAfterMatrix(p.geo, M);
        if (bb) boxes.push(bb);
    }
    const uni = unionBoxes(boxes);

    let anchorCorrection = new THREE.Matrix4();
    let yLift = 0;

    if (uni) {
        const anchor = new THREE.Vector3(
            0.5 * (uni.min.x + uni.max.x),
            uni.min.y,
            0.5 * (uni.min.z + uni.max.z)
        );
        anchorCorrection = new THREE.Matrix4().makeTranslation(-anchor.x, -anchor.y, -anchor.z);

        //const height = Math.max(0, uni.max.y - uni.min.y);
        yLift = 0//height * 0.03; // ۳٪ قد → برای جلوگیری از نفوذ جزئی به سطح
    } else {
        console.warn('[trees:base] union bbox failed; C=I, yLift=0');
    }

    return {
        parts,
        chosenMode: 'base',
        anchorCorrection,
        orientCorrection: ORIENT_FIX,
        yLift,
    };
}
