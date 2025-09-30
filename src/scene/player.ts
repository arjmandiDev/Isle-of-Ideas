// src/scene/player.ts
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';

const UP = new THREE.Vector3(0, 1, 0);
const EPS = 1e-3;
const BOUNCE_MAX = 0.18; // سقف جهش دوربین

export class Player {
    // ===== Tuning =====
    maxSpeed = 14.5;               // m/s
    gravity  = -30;             // m/s^2
    jumpV    = 8;             // پرش

    stepUpMax    = 0.40;        // بیشترین ارتفاع پله در هر زیرگام
    stepDownMax  = 0.90;        // اسنپ نرم پایین
    maxSlopeDeg  = 45;
    wallNormalYMax = 0.3;
    downRayFar   = 2000;

    moveTau   = 0.12;           // اینرسی سرعت افقی
    substepLen= 0.25;           // طول زیرگام افقی

    camBlend  = 0.08;           // نرم‌سازی جایگاه دوربین

    // Head bob
    bobBaseFreq   = 8.5;
    bobSpeedScale = 0.9;
    bobAmpY = 0.06;
    bobAmpX = 0.02;
    tiltMax = THREE.MathUtils.degToRad(2.0);
    tiltTau = 0.12;

    // ===== State =====
    readonly cosWalkable = Math.cos(THREE.MathUtils.degToRad(this.maxSlopeDeg));

    camera: THREE.PerspectiveCamera;
    controls: PointerLockControls;

    capsule = new Capsule(
        new THREE.Vector3(0, 0.9, 0),
        new THREE.Vector3(0, 2.1, 0),
        0.35
    );

    input = new THREE.Vector2(); // x(A/D), y(W/S)
    onGround = false;
    velocityY = 0;

    private downRay = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, this.downRayFar);
    private wallRay = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 1.0);

    private velXZ = new THREE.Vector3();
    private bobPhase = 0;
    private roll = 0;

    // --- Camera spring (critically damped) ---
    private camY = 0;           // خروجی فنر (افست عمودی دوربین)
    private camYVel = 0;        // سرعت فنر
    private camTarget = 0;      // هدف فنر (ایمپالس یک‌باره)
    private omegaCam = 18;      // شدت فنر (12..22 خوبه)

    constructor(scene: THREE.Scene) {
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.camera.position.set(0, 2, 5);
        this.camera.rotation.order = 'YXZ';
        scene.add(this.camera);

        this.controls = new PointerLockControls(this.camera, document.body);
        document.addEventListener('click', () => this.controls.lock());

        document.addEventListener('keydown', e => this.onKeyDown(e));
        document.addEventListener('keyup',   e => this.onKeyUp(e));

        this.downRay.layers.set(0);
        this.wallRay.layers.set(0);
    }

    get position() { return this.camera.position; }

    // ===== Input =====
    private onKeyDown(e: KeyboardEvent) {
        switch (e.code) {
            case 'KeyW': this.input.y =  1; break;
            case 'KeyS': this.input.y = -1; break;
            case 'KeyA': this.input.x = -1; break;
            case 'KeyD': this.input.x =  1; break;
            case 'Space':
                if (this.onGround) this.velocityY = this.jumpV;
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

    // ===== Helpers =====
    private centerOfCapsule() {
        return this.capsule.start.clone().add(this.capsule.end).multiplyScalar(0.5);
    }
    private worldNormal(hit: THREE.Intersection) {
        const n = (hit.face?.normal ?? new THREE.Vector3(0,1,0)).clone();
        const nm = new THREE.Matrix3().getNormalMatrix((hit.object as THREE.Mesh).matrixWorld);
        return n.applyMatrix3(nm).normalize();
    }
    private addCameraBounce(impulse: number) {
        const b = THREE.MathUtils.clamp(impulse, -BOUNCE_MAX, BOUNCE_MAX);
        this.camTarget = b; // یک ضربه؛ اگر بخواهی تجمیع شود این را += کن و بعد clamp کن
    }

    // ===== Update per frame =====
    applyInputs(dt: number, terrainRoot: THREE.Object3D) {
        // 1) جهت‌ها
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0).normalize();
        const right   = new THREE.Vector3().crossVectors(forward, UP).normalize(); // ← توجه: forward×UP (نه برعکس)

        // 2) اینرسی سرعت افقی
        const wishDir = new THREE.Vector3()
            .addScaledVector(forward, this.input.y)
            .addScaledVector(right,   this.input.x)
            .setY(0);

        const wishSpeed = wishDir.lengthSq() ? this.maxSpeed : 0;
        const targetVel = wishDir.normalize().multiplyScalar(wishSpeed);
        const moveAlpha = 1 - Math.exp(-dt / this.moveTau);
        this.velXZ.lerp(targetVel, moveAlpha);

        // 3) حرکت افقی با زیرگام + دیوار + Step-Up فقط رو به جلو
        const moveLen = this.velXZ.length() * dt;
        const steps = Math.max(1, Math.ceil(moveLen / this.substepLen));
        const d = this.velXZ.clone().multiplyScalar(dt / steps);

        const tryMove = (off: THREE.Vector3) => {
            if (off.lengthSq() > 1e-8) {
                const dirXZ = off.clone().setY(0).normalize();
                this.wallRay.ray.origin.copy(this.centerOfCapsule());
                this.wallRay.ray.direction.copy(dirXZ);
                this.wallRay.far = this.capsule.radius + 0.08;
                const hit = this.wallRay.intersectObject(terrainRoot, true)[0];
                if (hit && hit.face) {
                    const n = this.worldNormal(hit);
                    if (n.y < this.wallNormalYMax) return false; // دیوار
                }
            }
            this.capsule.start.add(off);
            this.capsule.end.add(off);
            return true;
        };

        for (let i = 0; i < steps; i++) {
            const savedStart = this.capsule.start.clone();
            const savedEnd   = this.capsule.end.clone();

            if (tryMove(d)) continue;

            // Step-Up فقط اگر رو به جلو حرکت می‌کنیم و روی زمین هستیم
            const moveDir = d.clone().setY(0).normalize();
            const dotFwd = moveDir.dot(forward);
            const allowStep = (dotFwd > 0.4) && this.onGround;

            if (allowStep) {
                // چک سقف
                const headProbe = new THREE.Raycaster(
                    this.capsule.end.clone().add(d).add(new THREE.Vector3(0, this.stepUpMax, 0)),
                    new THREE.Vector3(0, 1, 0),
                    0,
                    this.capsule.radius * 2
                );
                if (!headProbe.intersectObject(terrainRoot, true).length) {
                    // بالا بردن موقتی برای تست
                    this.capsule.start.y += this.stepUpMax;
                    this.capsule.end.y   += this.stepUpMax;
                    const ok = tryMove(d);
                    // بازگشت
                    this.capsule.start.y -= this.stepUpMax;
                    this.capsule.end.y   -= this.stepUpMax;

                    if (ok) {
                        // اعمال واقعی + یک bounce
                        const lift = this.stepUpMax;
                        this.capsule.start.y += lift;
                        this.capsule.end.y   += lift;
                        this.addCameraBounce(lift);

                        // snap-down کوچک اگر لازم بود
                        this.downRay.far = 2.0;
                        this.downRay.ray.origin.copy(this.capsule.end);
                        const sh = this.downRay.intersectObject(terrainRoot, true)[0];
                        if (sh) {
                            const groundY = sh.point.y;
                            const footY   = this.capsule.start.y - this.capsule.radius;
                            const down = footY - groundY;
                            if (down > 0 && down <= this.stepDownMax) {
                                const dy = (down - EPS);
                                this.capsule.start.y -= dy;
                                this.capsule.end.y   -= dy;
                                this.addCameraBounce(-dy);
                            }
                        }
                        continue;
                    }
                }
            }

            // مسدود؛ برگرد
            this.capsule.start.copy(savedStart);
            this.capsule.end.copy(savedEnd);
            break;
        }

        // 4) گرانش و حرکت عمودی
        this.velocityY += this.gravity * dt;
        this.capsule.start.y += this.velocityY * dt;
        this.capsule.end.y   += this.velocityY * dt;

        // 5) لندینگ/اسنپ‌ها
        this.downRay.far = this.downRayFar;
        this.downRay.ray.origin.copy(this.capsule.end);
        const hit = this.downRay.intersectObject(terrainRoot, true)[0];
        this.onGround = false;

        if (hit) {
            const groundY = hit.point.y;
            const footY   = this.capsule.start.y - this.capsule.radius;
            const dist    = footY - groundY;

            let walkable = true;
            if (hit.face) {
                const n = this.worldNormal(hit);
                walkable = (n.y >= this.cosWalkable);
            }

            if (dist < -EPS) {
                // نفوذ → push-out
                const dy = -dist + EPS;
                this.capsule.start.y += dy;
                this.capsule.end.y   += dy;
                this.velocityY = Math.max(0, this.velocityY);
                this.onGround = true;
                this.addCameraBounce(dy);
            } else if (dist <= this.stepUpMax && this.velocityY <= 0 && walkable) {
                // اسنپ بالا
                const dy = -dist + EPS;
                this.capsule.start.y += dy;
                this.capsule.end.y   += dy;
                this.velocityY = 0;
                this.onGround = true;
                this.addCameraBounce(dy);
            } else if (dist >= 0 && dist <= this.stepDownMax && this.velocityY <= 0) {
                // اسنپ پایین
                const dy = dist + EPS;
                this.capsule.start.y -= dy;
                this.capsule.end.y   -= dy;
                this.velocityY = 0;
                this.onGround = true;
                this.addCameraBounce(-dy);
            }
        }

        // 6) Head bob + roll (دامنه تابع سرعت؛ در گام‌های خیلی کوتاه تقریباً صفر)
        const speed = this.velXZ.length();
        const speed01 = THREE.MathUtils.clamp(speed / this.maxSpeed, 0, 1);
        const ampScale = THREE.MathUtils.smoothstep(speed01, 0.1, 0.9);
        this.bobPhase += (this.bobBaseFreq + speed * this.bobSpeedScale) * dt;

        const bobY = Math.sin(this.bobPhase) * this.bobAmpY * ampScale;
        const bobX = Math.cos(this.bobPhase * 0.5) * this.bobAmpX * ampScale;

        const sideSpeed = this.velXZ.dot(right);
        const rollTarget = THREE.MathUtils.clamp(-sideSpeed / this.maxSpeed, -1, 1) * this.tiltMax;
        const rollAlpha = 1 - Math.exp(-dt / this.tiltTau);
        this.roll = THREE.MathUtils.lerp(this.roll, rollTarget, rollAlpha);

        // 7) فنر بحرانی برای camY (هدف را به صفر برگردان تا «یک جهش» باشد)
        this.camTarget *= Math.exp(-6.0 * dt);

        const h = Math.min(dt, 1/30);
        const f = 1 + 2*h*this.omegaCam;
        const oo = this.omegaCam * this.omegaCam;
        const hoo = h * oo, hhoo = h * hoo, detInv = 1 / (f + hhoo);

        const y  = this.camY, yv = this.camYVel, tg = this.camTarget;
        this.camY    = (f*y + h*yv + hhoo*tg) * detInv;
        this.camYVel = (yv + hoo*(tg - y))    * detInv;

        // 8) جای‌گذاری دوربین
        const base = this.capsule.end.clone();
        const targetCamPos = base
            .addScaledVector(UP, this.camY)  // فنر
            .addScaledVector(UP, bobY)       // bob عمودی
            .addScaledVector(right, bobX);   // bob افقی

        const camAlpha = 1 - Math.exp(-(dt / this.camBlend));
        this.camera.position.lerp(targetCamPos, camAlpha);
        this.camera.rotation.z = this.roll;

        // 9) تور ایمنی
        if (this.capsule.end.y < -10) {
            const box = new THREE.Box3().setFromObject(terrainRoot);
            const c = box.getCenter(new THREE.Vector3());
            const topY = box.max.y;
            const hgt = this.capsule.end.y - this.capsule.start.y;
            this.capsule.end.set(c.x, topY + 3, c.z);
            this.capsule.start.set(c.x, topY + 3 - hgt, c.z);
            this.velocityY = 0;
            this.camY = this.camYVel = this.camTarget = 0;
        }
    }
}
