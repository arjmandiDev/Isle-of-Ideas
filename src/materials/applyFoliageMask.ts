import * as THREE from 'three';

const FOLIAGE_RX = /(leaf|leaves|grass|plant|foliage|orchid|allium|oxeye_daisy|tulip|sunflower|peony|lilac|poppy|rose|dandelion|tall|fern|sapling|flower|vine|cactus|bamboo|mangrove|azalea|berry|petals|dripleaf|lichen|roots|kelp|seagrass)/i;

export function applyFoliageMask(root: THREE.Object3D) {
    root.traverse((o: any) => {
        if (!o.isMesh || !o.material) return;
        const name = (o.name + ' ' + (o.material.name || '')).toLowerCase();
        const m = o.material;
        const hasRGBA = !!m.alphaMap || (m.map && (m.map.format===THREE.RGBAFormat || m.map.source?.data?.channels===4));
        if (FOLIAGE_RX.test(name) || hasRGBA) {
            m.alphaTest = 0.5;
            m.transparent = false;
            m.side = THREE.DoubleSide;
            m.depthWrite = true;
            m.needsUpdate = true;
        }
    });
}
