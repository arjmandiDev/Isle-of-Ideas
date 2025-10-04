import * as THREE from 'three';

// فقط همین‌ها «گیاهیِ دوبُعدی/برگ‌دار» حساب می‌شوند:
const FOLIAGE_STRICT = /(leaf|leaves|grass|plant|foliage|orchid|allium|oxeye_daisy|tulip|sunflower|peony|lilac|poppy|rose|dandelion|tall|azure|fern|sapling|flower|vine|cactus|bamboo|mangrove|azalea|berry|petals|dripleaf|lichen|roots|kelp|seagrass)/i;

// این‌ها «زمین/جامد» هستند و هرگز نباید به لایه ۲ بروند:
const SOLID_BLOCKS = /(grass_block|dirt|stone|sand|gravel|clay|cobblestone|ore|basalt|obsidian|netherrack|bedrock|coal|iron|gold|copper|emerald|diamond|redstone|lapis)/i;

export function applyFoliageMask(root: THREE.Object3D) {
    root.traverse((o: any) => {
        if (!o.isMesh || !o.material) return;

        const name = (o.name + ' ' + (o.material.name || '')).toLowerCase();
        const m = o.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | any;

        // بلوک‌های زمینی/جامد هرگز به لایه ۲ نروند
        if (SOLID_BLOCKS.test(name)) {
            // اطمینان از مات بودن
            m.transparent = false;
            m.alphaTest = 0;
            o.layers.enable(0); // روی لایه ۰ بماند
            return;
        }

        // گیاهی واقعی: یا نامش در لیست است، یا آلفاکات دارد
        const looksCutout = (m.alphaTest ?? 0) > 0.01 || !!m.transparent;
        const isFoliage = FOLIAGE_STRICT.test(name) || looksCutout;

        if (isFoliage) {
            m.transparent = false;     // blending نخواهیم
            m.alphaTest = Math.max(m.alphaTest ?? 0.0, 0.4);
            m.side = THREE.DoubleSide;
            m.depthWrite = true;

            // پیکسلی
            if (m.map) {
                m.map.magFilter = THREE.NearestFilter;
                m.map.minFilter = THREE.NearestFilter;
                m.map.colorSpace = THREE.SRGBColorSpace;
                m.map.needsUpdate = true;
            }

            // ⬅️ فقط گیاهی‌ها بروند به لایه ۲ (برای حذف از برخورد)
            o.layers.set(2);
        } else {
            // هر چیز دیگر همان لایه ۰
            o.layers.enable(0);
        }
    });
}
