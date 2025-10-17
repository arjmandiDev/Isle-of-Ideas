import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function island(scene: THREE.Scene) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const ktx2 = new KTX2Loader()
        .setTranscoderPath('/basis/')   // مطمئن شو این مسیر درست سرو می‌شود
        .detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
    loader.load(
        '/assets/isle-packed.glb',
        (gltf) => {
            // ملاحظات نمایش: شفافیت/دوطرفه خاموش برای کارایی و جلوگیری از ناپدید شدن
            // بعد از load:
            gltf.scene.traverse((o:any)=>{
                if (!o.isMesh || !o.material) return;
                const m = o.material;
                const name = (o.name+' '+(m.name||'')+' '+(m.map?.name||'')).toLowerCase();

                const looksFoliage = /(leaf|leaves|grass|plant|foliage|orchid|allium|oxeye_daisy|tulip|sunflower|peony|lilac|poppy|rose|dandelion|tall|fern|sapling|flower|vine|cactus|bamboo|mangrove|azalea|berry|petals|dripleaf|lichen|roots|kelp|seagrass)/i.test(name);

                // اگر به‌نظر گیاهه یا تکسچر آلفا دارد، cutout کن:
                const hasAlphaTex = !!m.alphaMap || (m.map && (m.map.format === THREE.RGBAFormat || m.map.source?.data?.channels === 4));
                if (looksFoliage || hasAlphaTex) {
                    m.alphaTest = 0.5;       // مثل ماینکرفت (clip)
                    m.transparent = false;   // شفافیتِ بلِند لازم نیست
                    m.side = THREE.DoubleSide;
                    m.depthWrite = true;
                    m.needsUpdate = true;
                } else {
                    m.transparent = false;
                    m.side = THREE.FrontSide;
                    m.depthWrite = true;
                }
            });


            scene.add(gltf.scene);
            frameObject(gltf.scene, 1.2);

            // یک فریم بعد، آمار واقعی
            requestAnimationFrame(() => {
                console.log('draw calls:', renderer.info.render.calls, 'triangles:', renderer.info.render.triangles);
            });

        },
        (e) => {
            if ((e as ProgressEvent).lengthComputable) {
                const p = ((e.loaded / e.total) * 100).toFixed(1);
                console.log(`${p}%`);
            }
        },
        (err) => {
            console.error('GLB load error:', err);
        }
    );
}



// --- Renderer: شفاف تا پس‌زمینه‌ی سرمه‌ای CSS خودت دیده شود
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

// --- Scene / Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 150, 700); // شروع تقریبی برای جزیره‌ی 512×512

// --- Controls: چرخش دوربین
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.minDistance = 50;
controls.maxDistance = 3000;
controls.maxPolarAngle = Math.PI * 0.49; // نذاره از زیر زمین نگاه کنه

// --- نور فضای باز (Outdoor)
scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.85)); // نور آسمان/زمین
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(800, 1200, 600);
sun.castShadow = false; // برای کارایی، فعلاً سایه خاموش
scene.add(sun);

// --- Loaderها (KTX2 + meshopt)
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const ktx2 = new KTX2Loader()
    .setTranscoderPath('/basis/')   // مطمئن شو این مسیر درست سرو می‌شود
    .detectSupport(renderer);
loader.setKTX2Loader(ktx2);

// --- کمک‌کننده: فریم/تنظیم دوربین و کنترل‌ها روی مدل
function frameObject(obj: THREE.Object3D, fitOffset = 1.15) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // بزرگترین بُعد برای محاسبه‌ی فاصله‌ی مناسب
    const maxSize = Math.max(size.x, size.y, size.z);
    const halfFovY = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const distance = (maxSize / (2 * Math.tan(halfFovY))) * fitOffset;

    // دوربین را رو به مرکز قرار بده
    const dir = new THREE.Vector3(0, 0, 1); // از روبرو
    camera.position.copy(center.clone().addScaledVector(dir, distance));
    camera.near = Math.max(0.1, distance / 500);
    camera.far  = distance * 500;
    camera.updateProjectionMatrix();

    controls.target.copy(center);
    controls.update();
}

// --- Load GLB
loader.load(
    '/assets/isle-packed.glb',
    (gltf) => {
        // ملاحظات نمایش: شفافیت/دوطرفه خاموش برای کارایی و جلوگیری از ناپدید شدن
        // بعد از load:
        gltf.scene.traverse((o:any)=>{
            if (!o.isMesh || !o.material) return;
            const m = o.material;
            const name = (o.name+' '+(m.name||'')+' '+(m.map?.name||'')).toLowerCase();

            const looksFoliage = /(leaf|leaves|grass|plant|foliage|orchid|allium|oxeye_daisy|tulip|sunflower|peony|lilac|poppy|rose|dandelion|tall|fern|sapling|flower|vine|cactus|bamboo|mangrove|azalea|berry|petals|dripleaf|lichen|roots|kelp|seagrass)/i.test(name);

            // اگر به‌نظر گیاهه یا تکسچر آلفا دارد، cutout کن:
            const hasAlphaTex = !!m.alphaMap || (m.map && (m.map.format === THREE.RGBAFormat || m.map.source?.data?.channels === 4));
            if (looksFoliage || hasAlphaTex) {
                m.alphaTest = 0.5;       // مثل ماینکرفت (clip)
                m.transparent = false;   // شفافیتِ بلِند لازم نیست
                m.side = THREE.DoubleSide;
                m.depthWrite = true;
                m.needsUpdate = true;
            } else {
                m.transparent = false;
                m.side = THREE.FrontSide;
                m.depthWrite = true;
            }
        });


        scene.add(gltf.scene);
        frameObject(gltf.scene, 1.2);

        // یک فریم بعد، آمار واقعی
        requestAnimationFrame(() => {
            console.log('draw calls:', renderer.info.render.calls, 'triangles:', renderer.info.render.triangles);
        });

    },
    (e) => {
        if ((e as ProgressEvent).lengthComputable) {
            const p = ((e.loaded / e.total) * 100).toFixed(1);
            console.log(`${p}%`);
        }
    },
    (err) => {
        console.error('GLB load error:', err);
    }
);

// --- Loop
function tick() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
}
tick();

// --- Resize
window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
});
