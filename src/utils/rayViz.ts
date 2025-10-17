// src/utils/rayViz.ts
import * as THREE from 'three';

export type RayVizOpts = {
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    targets: THREE.Object3D[];     // معمولاً مش‌های terrain (یا خود گروه terrain)
    maxDistance?: number;          // طول پرتو در نبودِ برخورد
    layerMask?: number;            // اگر terrain لایه خاصی دارد
    showNormal?: boolean;          // فلش نرمال روی نقطهٔ برخورد
};

export class RayViz {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private renderer: THREE.WebGLRenderer;
    private targets: THREE.Object3D[];
    private ray = new THREE.Raycaster();
    private maxDistance: number;
    private line: THREE.Line | null = null;
    private hitSphere: THREE.Mesh | null = null;
    private normalArrow: THREE.ArrowHelper | null = null;
    private enabled = true;
    private showNormal: boolean;

    constructor(opts: RayVizOpts) {
        this.scene = opts.scene;
        this.camera = opts.camera;
        this.renderer = opts.renderer;
        this.targets = opts.targets;
        this.maxDistance = opts.maxDistance ?? 5000;
        this.showNormal = opts.showNormal ?? true;

        if (opts.layerMask != null) this.ray.layers.mask = opts.layerMask;

        // خط پرتو
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(), new THREE.Vector3()
        ]);
        const mat = new THREE.LineBasicMaterial({ linewidth: 2 });
        this.line = new THREE.Line(geo, mat);
        (this.line as any).renderOrder = 9999;
        this.scene.add(this.line);

        // مارکر برخورد
        const sgeo = new THREE.SphereGeometry(0.35, 12, 12);
        const smat = new THREE.MeshBasicMaterial({ wireframe: true });
        this.hitSphere = new THREE.Mesh(sgeo, smat);
        (this.hitSphere as any).renderOrder = 9999;
        this.scene.add(this.hitSphere);

        // فلش نرمال
        if (this.showNormal) {
            this.normalArrow = new THREE.ArrowHelper(
                new THREE.Vector3(0,1,0),
                new THREE.Vector3(0,0,0),
                2
            );
            (this.normalArrow as any).renderOrder = 9999;
            this.scene.add(this.normalArrow);
        }

        // کلید R برای toggle
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'r') this.setEnabled(!this.enabled);
        });
    }

    setEnabled(v: boolean) {
        this.enabled = v;
        if (this.line) this.line.visible = v;
        if (this.hitSphere) this.hitSphere.visible = v;
        if (this.normalArrow) this.normalArrow.visible = v && this.showNormal;
    }

    dispose() {
        if (this.line) {
            this.scene.remove(this.line);
            (this.line.geometry as THREE.BufferGeometry).dispose?.();
            (this.line.material as THREE.Material).dispose?.();
            this.line = null;
        }
        if (this.hitSphere) {
            this.scene.remove(this.hitSphere);
            (this.hitSphere.geometry as THREE.BufferGeometry).dispose?.();
            (this.hitSphere.material as THREE.Material).dispose?.();
            this.hitSphere = null;
        }
        if (this.normalArrow) {
            this.scene.remove(this.normalArrow);
            this.normalArrow = null;
        }
    }

    /** هر فریم صدا بزن */
    update() {
        if (!this.enabled) return;

        // NDC مرکز تصویر: دقیقاً (0,0)
        const ndc = new THREE.Vector2(0, 0);

        this.camera.updateMatrixWorld(true);
        this.ray.setFromCamera(ndc, this.camera as any);

        // محاسبه مبدأ و انتهای پرتو (برای نمایش خط)
        const origin = (this.ray.ray.origin as THREE.Vector3).clone();
        const dir = (this.ray.ray.direction as THREE.Vector3).clone();
        const endNoHit = origin.clone().addScaledVector(dir, this.maxDistance);

        // برخورد با اهداف
        const hits = this.ray.intersectObjects(this.targets, true);

        const p0 = origin;
        const p1 = (hits[0]?.point ?? endNoHit);

        if (this.line) {
            const pos = (this.line.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
            pos.setXYZ(0, p0.x, p0.y, p0.z);
            pos.setXYZ(1, p1.x, p1.y, p1.z);
            pos.needsUpdate = true;
        }

        if (this.hitSphere) {
            this.hitSphere.position.copy(p1);
            this.hitSphere.visible = !!hits[0];
        }

        if (this.normalArrow) {
            if (hits[0]?.face) {
                // نرمال در فضای local → تبدیل به world
                const normal = hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld).normalize();
                this.normalArrow.position.copy(p1);
                this.normalArrow.setDirection(normal);
                this.normalArrow.setLength(2);
                this.normalArrow.visible = true;
            } else {
                this.normalArrow.visible = false;
            }
        }
    }
}
