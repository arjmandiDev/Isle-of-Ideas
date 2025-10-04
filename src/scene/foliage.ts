import * as THREE from 'three';

export function fixFoliage(root: THREE.Object3D) {
    root.traverse((o: any) => {
        if (!o.isMesh || !o.material) return;

        const name = (o.name + ' ' + (o.material.name || '')).toLowerCase();
        const isFoliage =
            /(leaf|leaves|grass|plant|foliage|orchid|allium|oxeye_daisy|tulip|sunflower|peony|lilac|poppy|rose|dandelion|tall|fern|sapling|flower|vine|cactus|bamboo|azure|mangrove|azalea|berry|petals|dripleaf|lichen|roots|kelp|seagrass)/i
                .test(name);

        if (!isFoliage) return;

        const m = o.material as THREE.Material & {
            map?: THREE.Texture;
            alphaTest?: number;
            transparent?: boolean;
            side?: number;
            depthWrite?: boolean;
            depthTest?: boolean;
            polygonOffset?: boolean;
            polygonOffsetFactor?: number;
            polygonOffsetUnits?: number;
        };

        // 1) برش آلفا بجای شفافیت
        m.transparent = false;     // blending خاموش؛ sorting لازم نداریم
        m.alphaTest  = 0.5;        // اگر حاشیه باقی ماند 0.35–0.45 امتحان کن

        // 2) دوطرفه بودن برای دیدن از هر دو جهت
        m.side = THREE.DoubleSide;

        // 3) عمق بنویس تا پشتِ هندسه پنهان شود و سوسو نزند
        m.depthTest  = true;
        m.depthWrite = true;

        // 4) فیلتر پیکسلی (ماین‌کرفت)
        if (m.map) {
            m.map.colorSpace  = THREE.SRGBColorSpace;
            m.map.magFilter   = THREE.NearestFilter;
            m.map.minFilter   = THREE.NearestFilter; // یا NearestMipmapNearest اگر mip داری
            m.map.anisotropy  = 1;
            m.map.needsUpdate = true;
        }

        // 5) برای کاهش سوسو در تلاقی دو صفحه‌ی ضربدری
        m.polygonOffset = true;
        m.polygonOffsetFactor = 1;
        m.polygonOffsetUnits  = 1;
    });
}
