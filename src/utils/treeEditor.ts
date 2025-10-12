import * as THREE from 'three';

type TreeRecord = {
    type: string;
    pos: [number, number, number]; // ⬅️ ذخیره به‌صورت terrain-local
    rotY?: number;                  // اختیاری برای آینده
    scale?: number;                 // اختیاری برای آینده
    space?: 'terrain-local';        // نشانگر نسخهٔ جدید
};

type InitOpts = {
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    terrain: THREE.Object3D;
    storageKey?: string;            // پیش‌فرض: 'island_editor.trees'
    defaultType?: string;           // پیش‌فرض: 'tree_type1'
    hud?: boolean;                  // پیش‌فرض: true
};

export function initTreeEditor(opts: InitOpts) {
    const {
        scene,
        camera,
        renderer,
        terrain,
        storageKey = 'island_editor.trees',
        defaultType = 'tree_type1',
        hud = true,
    } = opts;

    // --- singleton guard ---
    const existing = (window as any).__treeEditor as { destroy: () => void } | undefined;
    if (existing) existing.destroy();

    // --- state ---
    let list: TreeRecord[] = readList(storageKey);
    let currentType = defaultType;
    let editMode = true;

    // --- pick targets (فقط مش‌های terrain) ---
    let pickTargets: THREE.Mesh[] = [];
    rebuildPickTargets(terrain);

    // --- Raycaster ---
    const ray = new THREE.Raycaster();
    ray.layers.mask = terrain.layers.mask;

    // --- HUD (اختیاری) ---
    const hudRoot = hud ? ensureDiv('__treeHud', [
        'position:fixed','left:12px','top:12px','z-index:9999','color:#fff',
        'font:12px/1.4 ui-sans-serif,system-ui','pointer-events:none',
        'text-shadow:0 1px 2px rgba(0,0,0,.6)','white-space:pre'
    ].join(';')) : null;
    const hudPos  = hud ? ensureDiv('__treeHudPos', 'margin-top:4px;opacity:.9;') : null;
    if (hudRoot && hudPos) hudRoot.appendChild(hudPos);

    updateHUD();

    // --- interactions ---
    const canvas = renderer.domElement;
    const onClick = (ev: MouseEvent) => {
        if (!editMode) return;
        if (isEditable(ev.target as Element)) return;

        const p = pickCenterWorld(camera, renderer, ray, pickTargets);
        if (!p) return;

        // ⬅️ world → local (terrain)
        const local = p.clone();
        terrain.worldToLocal(local);

        const rec: TreeRecord = {
            type: currentType,
            pos: [local.x, local.y, local.z],
            space: 'terrain-local',
        };
        //list.push(rec);
        writeList(storageKey, list);
        updateHUD();
    };
    canvas.addEventListener('click', onClick);

    const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { editMode = !editMode; updateHUD(); }
        if (e.key.toLowerCase() === 'c') { // تغییر نوع سریع: C
            currentType = cycleType(currentType);
            updateHUD();
        }
        if (e.key.toLowerCase() === 'k') { // کپچر تک‌شات
            const p = pickCenterWorld(camera, renderer, ray, pickTargets);
            if (!p) return;
            const local = p.clone(); terrain.worldToLocal(local);
            list.push({ type: currentType, pos: [local.x, local.y, local.z], space: 'terrain-local' });
            writeList(storageKey, list); updateHUD();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
            list = []; writeList(storageKey, list); updateHUD();
        }
    };
    window.addEventListener('keydown', onKey);

    // --- public api ---
    const api = {
        get list(): TreeRecord[] { return list.slice(); },
        set list(v: TreeRecord[]) { list = normalizeList(v, defaultType); writeList(storageKey, list); updateHUD(); },
        clear() { list = []; writeList(storageKey, list); updateHUD(); },
        setEditMode(v: boolean) { editMode = !!v; updateHUD(); },
        getEditMode() { return editMode; },
        setType(t: string) { currentType = t || defaultType; updateHUD(); },
        refreshTargets(newTerrain?: THREE.Object3D) {
            if (newTerrain) (opts as any).terrain = newTerrain;
            rebuildPickTargets(newTerrain ?? terrain);
        },
        destroy() {
            canvas.removeEventListener('click', onClick);
            window.removeEventListener('keydown', onKey);
            if (hudRoot?.parentElement) hudRoot.parentElement.removeChild(hudRoot);
        }
    };

    (window as any).__treeEditor = api; // دسترسی سریع در کنسول
    return api;

    // ---------- impl helpers ----------
    function pickCenterWorld(
        cam: THREE.Camera,
        rend: THREE.WebGLRenderer,
        r: THREE.Raycaster,
        targets: THREE.Object3D[]
    ): THREE.Vector3 | null {
        if (!targets.length) return null;
        const ndc = getCanvasCenterNDC(rend);
        cam.updateMatrixWorld(true);
        r.setFromCamera(ndc, cam);
        const hits = r.intersectObjects(targets, true);
        return hits[0]?.point ? hits[0].point.clone() : null;
    }

    function rebuildPickTargets(terrainObj: THREE.Object3D) {
        pickTargets = [];
        terrainObj.traverse((o: any) => { if (o?.isMesh) pickTargets.push(o as THREE.Mesh); });
        // از پشت هم قابل Raycast باشد:
        terrainObj.traverse((o:any)=>{
            if (o?.isMesh && o.material && 'side' in o.material && o.material.side !== THREE.DoubleSide) {
                o.material.side = THREE.DoubleSide; o.material.needsUpdate = true;
            }
        });
    }

    function updateHUD() {
        if (!hudRoot || !hudPos) return;
        const count = list.length;
        hudRoot.textContent =
            `[TreeEditor]  Edit: ${editMode ? 'ON' : 'OFF'}  |  Type: ${currentType}\n` +
            `Records: ${count}\n` +
            `Click/K: افزودن نقطه  |  Esc: Toggle Edit  |  Ctrl+Backspace: پاک‌کردن`;
        const p = pickCenterWorld(camera, renderer, ray, pickTargets);
        if (p) hudPos.textContent = `Center world: ${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}`;
    }

    function ensureDiv(id: string, style: string) {
        const e = document.getElementById(id) || document.createElement('div');
        e.id = id; (e as HTMLElement).style.cssText = style;
        if (!e.parentElement) document.body.appendChild(e);
        return e as HTMLDivElement;
    }

    function getCanvasCenterNDC(r: THREE.WebGLRenderer) {
        // const rect = r.domElement.getBoundingClientRect();
        // return new THREE.Vector2(
        //     ((rect.left + rect.width * 0.5) / rect.width) * 2 - 1,
        //     ((rect.top  + rect.height * 0.5) / rect.height) * -2 + 1
        // );
        return new THREE.Vector2(0,0);
    }

    function readList(key: string): TreeRecord[] {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return normalizeList(arr, defaultType);
        } catch { return []; }
    }

    function writeList(key: string, v: TreeRecord[]) {
        localStorage.setItem(key, JSON.stringify(v));
    }

    function normalizeList(v: any, def: string): TreeRecord[] {
        return (Array.isArray(v) ? v : []).map((r:any) => ({
            type: String(r?.type ?? def),
            pos: [Number(r?.pos?.[0])||0, Number(r?.pos?.[1])||0, Number(r?.pos?.[2])||0] as [number,number,number],
            rotY: r?.rotY != null ? Number(r.rotY) : undefined,
            scale: r?.scale != null ? Number(r.scale) : undefined,
            space: 'terrain-local', // ⬅️ همه را به مدل جدید یکپارچه می‌کنیم
        }));
    }

    function cycleType(t: string) {
        // اگر لیستی از انواع داری می‌تونی جایگزین کنی:
        const TYPES = ['tree_type1','tree_type2','tree_type3','palm_type1','palm_type2','palm_type3','palm_twin'];
        const i = Math.max(0, TYPES.indexOf(t));
        return TYPES[(i+1) % TYPES.length] ?? defaultType;
    }

    function fmt(n:number){ return Math.round((Number(n)||0)*100)/100; }

    function isEditable(el?: Element|null) {
        if (!el) return false;
        const tag = el.tagName?.toLowerCase();
        return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
    }
}
