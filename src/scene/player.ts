// src/scene/Player.ts
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Player {
    // --- تنظیمات حرکتی/برخورد ---
    maxSpeed = 8;                 // m/s
    gravity  = -30;               // m/s^2
    jump     = 8;                // m/s

    stepUpMax = 0.40;             // بیشترین پلهٔ قابل صعود در هر زیرگام
    stepDownMax = 0.90;           // اسنپ نرم به پایین
    maxSlopeDeg = 45;             // بیشترین شیب قابل راه‌رفتن (درجه)
    substepLen = 0.25;            // طول هر زیرگام افقی (برای جلوگیری از تونل‌زدن)
    wallNormalYMax = 0.3;         // نرمالِ عمودیِ کمتر از این یعنی "دیوار واقعی"
    downRayFar = 2000;            // برد ری‌کست پایین

    private readonly cosWalkable = Math.cos(THREE.MathUtils.degToRad(this.maxSlopeDeg));

    // --- وضعیت پلیر ---
    camera: THREE.PerspectiveCamera;
    controls: PointerLockControls;

    capsule = new Capsule(
        new THREE.Vector3(0, 0.9, 0),  // پایین کپسول (radius=0.35 → قد ~1.8)
        new THREE.Vector3(0, 1.8, 0),  // بالای کپسول
        0.35
    );

    input = new THREE.Vector2(0, 0); // x(A/D), y(W/S) در بازه -1..1
    onGround = false;
    velocityY = 0;

    // Raycasters (فقط لایهٔ 0)
    private downRay = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, this.downRayFar);
    private wallRay = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 1.0);
    constructor( scene: THREE.Scene) {
        // دوربین و کنترل نگاه
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 2, 5);
        scene.add(this.camera);

        this.controls = new PointerLockControls(this.camera, document.body);
        document.addEventListener('click', () => this.controls.lock());

        // رویدادهای کیبورد
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup',   (e) => this.onKeyUp(e));

        // ری‌کسترها فقط لایهٔ 0 (گیاهان را نمی‌بینند)
        this.downRay.layers.set(0);
        this.wallRay.layers.set(0);


    }

    // دسترسی سریع به موقعیت
    get position() { return this.camera.position; }

    // --- ورودی ---
    private onKeyDown(e: KeyboardEvent) {
        switch (e.code) {
            case 'KeyW': this.input.y =  1; break;
            case 'KeyS': this.input.y = -1; break;
            case 'KeyA': this.input.x = 1; break;
            case 'KeyD': this.input.x =  -1; break;
            case 'Space':
                if (this.onGround) this.velocityY = this.jump;
                break;
        }
    }
    private onKeyUp(e: KeyboardEvent) {
        switch (e.code) {
            case 'KeyW':
            case 'KeyS': this.input.y = 0; break;
            case 'KeyA':
            case 'KeyD': this.input.x = 0; break;
        }
    }

    // --- حلقهٔ آپدیت ---
    /**
     * terrainRoot: کل ریشهٔ مدل جزیره (Group/Object3D)
     * توجه: BVH باید روی Meshهای بزرگِ زیرِ این ریشه ساخته شده باشد.
     */
    applyInputs(dt: number, terrainRoot: THREE.Object3D) {

        // 1) بردارهای جهت نسبت به نگاه
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0).normalize();
        const right   = new THREE.Vector3().crossVectors(UP, forward).normalize(); // right = up × forward

        // 2) حرکت افقی موردنظر (wish)
        const wish = new THREE.Vector3()
            .addScaledVector(forward, this.input.y)
            .addScaledVector(right,   this.input.x);

        if (wish.lengthSq() > 1e-6) wish.normalize().multiplyScalar(this.maxSpeed * dt);

        // 3) حرکت افقی با زیرگام + دیوار + Step-Up
        const len = wish.length();
        const steps = Math.max(1, Math.ceil(len / this.substepLen));
        const d = wish.clone().divideScalar(steps);

        const tryMove = (off: THREE.Vector3) => {
            if (off.lengthSq() > 1e-8) {
                // تست دیوار در جهت افقی (نرمال عمودی = دیوار)
                const dirXZ = off.clone().setY(0).normalize();
                this.wallRay.ray.origin.copy(this.centerOfCapsule());
                this.wallRay.ray.direction.copy(dirXZ);
                this.wallRay.far = this.capsule.radius + 0.08;

                const wh = this.wallRay.intersectObject(terrainRoot, true)[0];
                if (wh && wh.face) {
                    const n = this.worldNormal(wh);
                    const isWall = n.y < this.wallNormalYMax;
                    if (isWall) return false; // مسدود
                }
            }
            // اعمال حرکت افقی
            this.capsule.start.add(off);
            this.capsule.end.add(off);
            return true;
        };

        for (let i = 0; i < steps; i++) {
            const savedStart = this.capsule.start.clone();
            const savedEnd   = this.capsule.end.clone();

            // 3-الف) تلاش حرکت افقی معمولی
            if (tryMove(d)) continue;

            // 3-ب) Step-Up: یک بار تا حد stepUpMax بالا ببر، دوباره همان حرکت را امتحان کن
            this.capsule.start.y += this.stepUpMax;
            this.capsule.end.y   += this.stepUpMax;

            if (tryMove(d)) {
                // 3-ج) Snap-down کوچک بعد از Step-Up تا روی سطح بشیند
                this.downRay.far = 2.0;
                this.downRay.ray.origin.copy(this.capsule.end);
                const sh = this.downRay.intersectObject(terrainRoot, true)[0];
                if (sh) {
                    const groundY = sh.point.y;
                    const footY   = this.capsule.start.y - this.capsule.radius;
                    const down = footY - groundY; // مثبت یعنی باید پایین بیاییم
                    if (down > 0 && down <= this.stepDownMax) {
                        const dy = down - 0.001;
                        this.capsule.start.y -= dy;
                        this.capsule.end.y   -= dy;
                    }
                }
                continue;
            }

            // 3-د) اگر با Step-Up هم نشد → به حالت قبل برگرد و از حلقه خارج شو
            this.capsule.start.copy(savedStart);
            this.capsule.end.copy(savedEnd);
            break;
        }
        // console.log(documentIsHidden);
        // if (!documentIsHidden){
            // 4) گرانش و حرکت عمودی
            this.velocityY += this.gravity * dt;
            this.capsule.start.y += this.velocityY * dt;
            this.capsule.end.y   += this.velocityY * dt;
        // }


        // 5) لندینگ: push-out نفوذ / اسنپ به بالا / اسنپ به پایین
        this.downRay.far = this.downRayFar;
        this.downRay.ray.origin.copy(this.capsule.end);
        const hit = this.downRay.intersectObject(terrainRoot, true)[0];
        this.onGround = false;

        if (hit) {
            const groundY = hit.point.y;
            const footY   = this.capsule.start.y - this.capsule.radius;
            const dist    = footY - groundY; // مثبت یعنی کف بالاتر از زمین است

            // نرمال جهانی برای تشخیص راه‌رفتنی
            let walkable = true;
            if (hit.face) {
                const n = this.worldNormal(hit);
                walkable = (n.y >= this.cosWalkable);
            }

            if (dist < -0.002) {
                // (A) نفوذ: حتماً push-up (بدون توجه به شیب)
                const dy = -dist + 0.002;
                this.capsule.start.y += dy;
                this.capsule.end.y   += dy;
                this.velocityY = 0;
                this.onGround = true;
            } else if (dist <= this.stepUpMax && this.velocityY <= 0 && walkable) {
                // (B) نزدیک زمینِ بالاتر (پله کوتاه) → اسنپ بالا
                const dy = -dist + 0.001;
                this.capsule.start.y += dy;
                this.capsule.end.y   += dy;
                this.velocityY = 0;
                this.onGround = true;
            } else if (dist >= 0 && dist <= this.stepDownMax && this.velocityY <= 0) {
                // (C) زمین پایین‌تر ولی نزدیک → اسنپ پایین
                const dy = -(dist) - 0.001;
                this.capsule.start.y += dy;
                this.capsule.end.y   += dy;
                this.velocityY = 0;
                this.onGround = true;
            }
        }

        // 6) تور ایمنی سقوط بی‌نهایت
        if (this.capsule.end.y < -2000) {
            const box = new THREE.Box3().setFromObject(terrainRoot);
            const c = box.getCenter(new THREE.Vector3());
            const topY = box.max.y;
            const h = this.capsule.end.y - this.capsule.start.y;
            this.capsule.end.set(c.x, topY + 3, c.z);
            this.capsule.start.set(c.x, topY + 3 - h, c.z);
            this.velocityY = 0;
        }

        // 7) هم‌مکان‌کردن دوربین با رأس کپسول
        this.camera.position.copy(this.capsule.end);
    }

    // --- هِلپرها ---
    private centerOfCapsule() {
        return this.capsule.start.clone().add(this.capsule.end).multiplyScalar(0.5);
    }

    private worldNormal(hit: THREE.Intersection) {
        const n = (hit.face?.normal ?? new THREE.Vector3(0,1,0)).clone();
        const nm = new THREE.Matrix3().getNormalMatrix((hit.object as THREE.Mesh).matrixWorld);
        return n.applyMatrix3(nm).normalize();
    }

    toString() {
        return `X:${this.position.x.toFixed(3)}, Y:${this.position.y.toFixed(3)}, Z:${this.position.z.toFixed(3)}`;
    }
}
