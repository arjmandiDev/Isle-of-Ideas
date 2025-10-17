import * as THREE from "three";
import {bindTreeEditorHotkeys} from "../scene/input/hotkeys.ts";
import {buildChunkedInstancedTrees} from "../scene/buildInstancedTrees.ts";
import type {TreeProto} from "../scene/preloadTreePrototypes.ts";

export type TreeRecord = {
    type: string;
    pos: [number, number, number];
    rotY?: number;
    scale?: number;
    space?: number;
}

const LS_KEY = 'island_editor.trees';

export class TreeEditor {
    camera: THREE.Camera;
    scene: THREE.Scene;
    terrainRoot: THREE.Object3D;
    protos: Map<string, TreeProto>;

    editing = true;
    currentType: string;
    types: string[];

    records: TreeRecord[] = [];
    byType = new Map<string, TreeRecord[]>();
    groups = new Map<string, THREE.Group>()

    guiFolder?: any;

    private unbind?: (() => void) | null = null;
    private raycaster = new THREE.Raycaster()
    private tmpV = new THREE.Vector3();

    constructor(scene: THREE.Scene, camera: THREE.Camera, terrainRoot: THREE.Object3D, protos: Map<string, TreeProto>, guiFolder?: any) {
        this.scene = scene;
        this.camera = camera;
        this.terrainRoot = terrainRoot;
        this.protos = protos;
        this.types = Array.from(protos.keys());
        this.currentType = this.types[0] ?? 'tree_type1';
        this.guiFolder = guiFolder;

        this.load();
        this.mountHotKeys();
        this.buildAll();
        this.setupGUI();
    }

    dispose() {
        if (this.unbind) {                         // ⬅️ از result استفاده نکن، فقط صدا بزن
            this.unbind();
            this.unbind = null;
        }
    }

    private mountHotKeys() {
        if (this.unbind) return;  // جلوگیری از دوبار بایند
        this.unbind = bindTreeEditorHotkeys({
            onToggleEdit: () => {
                this.editing = !this.editing;
                console.log('[TreeEditor] Edit:', this.editing);
            },
            onAddPoint: () => this.addPointViaRay(),
            onClearAll: () => this.clearAll(),
            onNextType: () => this.cycleType(+1),
            onPrevType: () => this.cycleType(-1),
        });
    }

    private setupGUI() {
        if (!this.guiFolder) return;
        this.guiFolder.add(this, 'editing').name('Edit on/off');
        this.guiFolder.add(this, 'currentType',['tree_type1','tree_type2','tree_type3','palm_twin','palm_type1','palm_type2','palm_type3']).name('Tree type');
    }

    private cycleType(dir: 1 | -1) {
        if (!this.types.length) return;
        const i = this.types.indexOf(this.currentType);
        const j = (i + dir + this.types.length) % this.types.length;
        this.currentType = this.types[j];
        console.log('[TreeEditor] Type:', this.currentType);
    }

    private load() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            const arr: TreeRecord[] = JSON.parse(raw);
            this.records = Array.isArray(arr) ? arr : [];
            this.reindex();
        } catch (e) {
            console.warn('[TreeEditor] load failed', e);
        }
    }

    private save() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(this.records));
        } catch (e) {
            console.warn('[TreeEditor] Save failed', e);
        }
    }

    private reindex() {
        this.byType.clear()
        for (const r of this.records) {
            (this.byType.get(r.type) ?? this.byType.set(r.type, []).get(r.type)!).push(r);
        }
    }

    private buildAll() {
        for (const t of this.types) this.rebuildType(t);
    }

    private rebuildType(type: string) {
        const old = this.groups.get(type);
        if (old) {
            this.scene.remove(old);
            old.traverse((o: any) => o.dispose?.());
            this.groups.delete(type);
        }

        const proto = this.protos.get(type);
        if (!proto) return;

        const recs = this.byType.get(type) ?? [];
        if (recs.length === 0) return;

        const positions: [number, number, number][] = recs.map(r => {
            const p = this.tmpV.set(r.pos[0], r.pos[1], r.pos[2]);
            this.terrainRoot.localToWorld(p);
            return [p.x, p.y, p.z];
        });

        const rotationsY = recs.map(r => r.rotY ?? 0)
        const scales = recs.map(r => r.scale ?? 0)

        const group = buildChunkedInstancedTrees(proto.parts, positions, {
            rotationsY, scales, chunkSize: 128, cullDistance: 0, anchorCorrection: proto.anchorCorrection,
            orientCorrection: (proto as any).orientCorrection,
            yLift: (proto as any).yLift ?? 0,
        });
        group.name = `Trees_${type}`;
        this.scene.add(group);
        this.groups.set(type, group);
    }

    addPointViaRay() {
        if (!this.editing) return;
        const cam = this.camera;
        // const canvas = (this.scene as any).renderer?.domElement ?? document.body;
        if (!cam) {
            console.warn('[TreeEditor] camera missing');
            return;
        }

        const mx = (window as any).__mouseNDC?.x ?? 0; // اگر داری
        const my = (window as any).__mouseNDC?.y ?? 0;

        this.raycaster.setFromCamera({x: mx, y: my}, cam);

        // فقط روی زیرشاخه‌های terrainRoot ray بزن
        const targets: THREE.Object3D[] = [];
        this.terrainRoot.traverse((o: any) => {
            if (o.isMesh) targets.push(o);
        });
        const hits = this.raycaster.intersectObjects(targets, true);
        if (!hits.length) return;

        const hit = hits[0];
        const local = hit.point.clone();
        this.terrainRoot.worldToLocal(local);

        const rec: TreeRecord = {
            type: this.currentType,
            pos: [local.x, local.y, local.z],
            rotY: 10,
            scale: 1,
            space: 'terrain-root-local@v2',
        };

        // 1) به استیت اضافه کن
        this.records.push(rec);
        (this.byType.get(rec.type) ?? this.byType.set(rec.type, []).get(rec.type)!).push(rec);

        // 2) فقط گروه همان type را بازسازی کن (لایو)
        this.rebuildType(rec.type);

        // 3) ذخیره کن
        this.save();

        console.log('[TreeEditor] +1', rec.type, rec.pos);
    }

    clearAll() {
        this.records = [];
        this.byType.clear();
        this.save();
        // همه گروه‌ها را حذف کن
        for (const [t, g] of this.groups) {
            this.scene.remove(g);
        }
        this.groups.clear();
        console.log('[TreeEditor] cleared all');
    }
}