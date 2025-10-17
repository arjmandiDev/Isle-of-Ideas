// src/scene/blockClouds.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type BlockClouds = {
    group: THREE.Group;
    setDaylight: (day01: number) => void;
    tick: (dt: number) => void;
};

// نویز tileable ساده
function makeNoise(seed=1337, G=48){
    function mulberry32(a:number){return()=>{let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
    const rnd=mulberry32(seed|0);
    const grid=Array.from({length:G},()=>Array.from({length:G},()=>rnd()));
    const smooth=(x:number)=>x*x*(3-2*x);
    return (u:number,v:number)=>{
        const x=Math.floor(u)%G,y=Math.floor(v)%G,fx=u-Math.floor(u),fy=v-Math.floor(v);
        const x1=(x+1)%G,y1=(y+1)%G;
        const v00=grid[x][y],v10=grid[x1][y],v01=grid[x][y1],v11=grid[x1][y1];
        const sx=smooth(fx),sy=smooth(fy);
        const ix0=v00*(1-sx)+v10*sx, ix1=v01*(1-sx)+v11*sx;
        return ix0*(1-sy)+ix1*sy; // 0..1
    };
}

// ادغام «همسایه‌های سفید» به مستطیل‌های بزرگ‌تر (greedy)
function greedyRects(mask:boolean[][]){
    const H = mask.length, W = mask[0].length;
    const done:boolean[][] = Array.from({length:H},()=>Array(W).fill(false));
    const rects:{x:number,y:number,w:number,h:number}[] = [];
    for(let y=0;y<H;y++){
        for(let x=0;x<W;x++){
            if (done[y][x] || !mask[y][x]) continue;
            // عرض
            let w=1; while(x+w<W && mask[y][x+w] && !done[y][x+w]) w++;
            // ارتفاع
            let h=1, grow=true;
            while(y+h<H && grow){
                for(let k=0;k<w;k++) if(!mask[y+h][x+k] || done[y+h][x+k]) { grow=false; break; }
                if (grow) h++;
            }
            for(let yy=0;yy<h;yy++) for(let xx=0;xx<w;xx++) done[y+yy][x+xx]=true;
            rects.push({x,y,w,h});
        }
    }
    return rects;
}

export function createBlockClouds(opts?:{
    areaSize?: number;   // عرض/طول کل ابر (XZ)
    cell?: number;       // اندازه‌ی بلوک
    height?: number;     // ارتفاع لایه
    seed?: number;
    density?: number;    // آستانه: کمتر = ابر بیشتر
    thickness?: number;  // لایه‌های عمودی (1 = کلاسیک)
    color?: number;
    speed?: number;      // سرعت اسکرول
}): BlockClouds {
    const {
        areaSize=1024, cell=16, height=200, seed=1337,
        density=0.58, thickness=1, color=0xffffff, speed=4.0
    } = opts ?? {};

    const Nx = Math.round(areaSize / cell);
    const Nz = Math.round(areaSize / cell);
    const baseX = -(Nx*cell)/2, baseZ = -(Nz*cell)/2;

    // ماسک دودویی
    const noise = makeNoise(seed, 64);
    const scale = 6;
    const mask:boolean[][] = Array.from({length:Nz}, (_,iz)=>{
        return Array.from({length:Nx}, (_,ix)=>{
            let n = noise((ix/Nx)*scale, (iz/Nz)*scale);
            n = 0.7*n + 0.3*noise((ix/Nx)*scale*2, (iz/Nz)*scale*2);
            return n > density;
        });
    });

    // مستطیل‌های ادغام‌شده
    const rects = greedyRects(mask);

    // تولید جعبه‌ها و merge یک‌جا (کاملاً مات، بدون شفافیت)
    const geoms:THREE.BufferGeometry[] = [];
    for (const r of rects){
        const w = r.w * cell, d = r.h * cell, h = thickness * cell;
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(baseX + r.x*cell + w/2, height + h/2, baseZ + r.y*cell + d/2);
        geoms.push(g);
    }
    const merged = mergeGeometries(geoms, false)!;

    const mat = new THREE.MeshBasicMaterial({ color, fog:true, transparent:false });
    const meshA = new THREE.Mesh(merged, mat);
    const meshB = meshA.clone();
    meshB.position.x = areaSize; // کپی برای wrap بی‌درز

    const group = new THREE.Group();
    group.add(meshA, meshB);
    // ستاره‌ها همیشه پشت این باشن
    meshA.renderOrder = 2; meshB.renderOrder = 2;

    // اسکرول نرم با wrap
    let offset = 0;
    function tick(dt:number){
        offset = (offset + speed*dt) % areaSize;
        group.position.x = -offset;
    }

    function setDaylight(day01:number){
        // روز خیلی روشن، شب کمی خاکستری‌تر مثل ماینکرفت
        const k = THREE.MathUtils.lerp(1.0, 0.9, 1 - day01);
        (mat.color as THREE.Color).setRGB(k, k, k);
    }

    return { group, setDaylight, tick };
}
