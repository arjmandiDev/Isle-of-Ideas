// src/scene/loadTreePrototype.ts
import * as THREE from 'three';

export type TreePart =
    | { mode: 'bake'; name: string; geo: THREE.BufferGeometry; mat: THREE.Material }
    | { mode: 'base'; name: string; geo: THREE.BufferGeometry; mat: THREE.Material; baseLocal: THREE.Matrix4 };

// اگر هندسه float32 نیست تبدیل کن (برای ایمنی)
function ensureFloat32Position(geo: THREE.BufferGeometry) {
    const attr: any = geo.attributes?.position;
    if (!attr) return;
    if (attr.array && !(attr.array instanceof Float32Array)) {
        const f32 = new Float32Array(attr.array);
        geo.setAttribute('position', new THREE.BufferAttribute(f32, attr.itemSize, false));
    }
}

const USE_MIPMAPS = false;

export async function loadTreePrototype(
    gltfLoader: { loadAsync: (url: string) => Promise<any> },
    url: string,
    options?: { targetHeight?: number }
) {
    const glb = await gltfLoader.loadAsync(url);
    const scene = glb.scene as THREE.Object3D;
    if (!scene) throw new Error('Tree GLB has no scene');

    // جمع‌آوری Meshها
    const raw: { name: string; g: THREE.BufferGeometry; m: THREE.Material; baseLocal?: THREE.Matrix4 }[] = [];

    scene.traverse((o: any) => {
        if (!o?.isMesh) return;
        if (!o.geometry) return;

        const g = o.geometry as THREE.BufferGeometry;
        const m = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.Material;

        // مواد و فیلترها را واکسلی کن
        if ('map' in m && (m as any).map) {
            const tex = (m as any).map as THREE.Texture;
            if (!USE_MIPMAPS) {
                tex.minFilter = THREE.NearestFilter;
                tex.generateMipmaps = false;
            }
            tex.magFilter = THREE.NearestFilter;
            tex.needsUpdate = true;
        }
        if ('vertexColors' in m) (m as any).vertexColors = false;
        if ('alphaTest' in m && (m as any).alphaTest == null) (m as any).alphaTest = 0.5;
        (m as any).side = THREE.FrontSide;
        (m as any).depthWrite = true;
        (m as any).needsUpdate = true;

        // اگر glTF ترنسفورم محلی روی Mesh داشته باشد، آن را در geometry bake می‌کنیم
        const baseLocal = new THREE.Matrix4();
        baseLocal.compose(o.position ?? new THREE.Vector3(),
            o.quaternion ?? new THREE.Quaternion(),
            o.scale ?? new THREE.Vector3(1,1,1));

        raw.push({ name: o.name || 'tree_part', g, m, baseLocal });
    });

    // یکپارچه‌سازی مقیاس ارتفاع اختیاری
    let heightScale = 1;
    if (options?.targetHeight && raw.length) {
        const box = new THREE.Box3();
        for (const r of raw) box.expandByObject(new THREE.Mesh(r.g));
        const h = Math.max(0.0001, box.max.y - box.min.y);
        heightScale = options.targetHeight / h;
    }

    // ⬅️⬅️ نکتهٔ مهم: همهٔ ترنسفورم‌های محلی/پیوت را «داخل هندسه» می‌پزیم (bake)
    // تا در مرحلهٔ instancing فقط TRS نمونه‌ای اعمال شود و آفست ثابت حذف شود.
    const bakedParts: TreePart[] = raw.map(({ name, g, m, baseLocal }) => {
        const geo = g.clone();

        // bake transform (pivot/offset/rotation/scale) از خود Mesh
        if (baseLocal) {
            geo.applyMatrix4(baseLocal);
        }

        // اسکیل ارتفاع اختیاری
        if (heightScale !== 1) {
            const S = new THREE.Matrix4().makeScale(heightScale, heightScale, heightScale);
            geo.applyMatrix4(S);
        }

        // تضمین Float32 برای position
        ensureFloat32Position(geo);
        geo.computeBoundingBox();
        geo.computeBoundingSphere();

        return { mode: 'bake', name, geo, mat: m };
    });

    // خروجی فقط bake
    return {
        parts: bakedParts,
        chosenMode: 'bake' as const,
    };
}
