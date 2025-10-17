import * as THREE from "three";


export type Skydome = {
    mesh: THREE.Mesh;
    setSun: (sunDir: THREE.Vector3, sunAltDeg: number) => void;
    setParams?: (p: Partial<Params>) => void;
};
type Params = {
    dayZenith: number;      // رنگ‌ها به صورت hex
    dayHorizon: number;
    nightZenith: number;
    nightHorizon: number;
    sunsetWarm: number;     // شدت تُن گرم غروب
    glowSizeDeg: number;    // پهنای هاله‌ی خورشید (درجه)
};

const defaultParams: Params = {
    dayZenith:   0x87c8ff,
    dayHorizon:  0xb9dcff,
    nightZenith: 0x0b1a2b,
    nightHorizon:0x122235,
    sunsetWarm:  0xffa469,
    glowSizeDeg: 12
};

export function createSkydome(radius = 9000, params?: Partial<Params>): Skydome {
    const P = { ...defaultParams, ...(params||{}) };

    const geo = new THREE.SphereGeometry(radius, 32, 16);
    // از داخل دیده شود
    (geo as any).groups.forEach((g: any)=>g.materialIndex = 0);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        transparent: false,
        uniforms: {
            sunDir:        { value: new THREE.Vector3(0,1,0) },
            sunAltRad:     { value: 0.0 },
            dayZenith:     { value: new THREE.Color(P.dayZenith) },
            dayHorizon:    { value: new THREE.Color(P.dayHorizon) },
            nightZenith:   { value: new THREE.Color(P.nightZenith) },
            nightHorizon:  { value: new THREE.Color(P.nightHorizon) },
            sunsetWarm:    { value: new THREE.Color(P.sunsetWarm) },
            glowSizeRad:   { value: THREE.MathUtils.degToRad(P.glowSizeDeg) }
        },
        vertexShader: `
      varying vec3 vDir;
      void main(){
        // کره روی مبدأ: جهتِ دید = نرمالِ کره
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
        fragmentShader: `
      uniform vec3 sunDir;
      uniform float sunAltRad;
      uniform vec3 dayZenith, dayHorizon, nightZenith, nightHorizon, sunsetWarm;
      uniform float glowSizeRad;
      varying vec3 vDir;

      // helper
      float smooth01(float x, float a, float b){ return clamp((x-a)/(b-a), 0.0, 1.0); }

      void main(){
        // ارتفاع دید نسبت به افق
        float up = clamp(vDir.y, -1.0, 1.0);
        float horizonMix = pow(clamp((up+1.0)*0.5, 0.0, 1.0), 0.7); // 0 نزدیک افق، 1 سمت بالای آسمان

        // روز/شب بر اساس ارتفاع خورشید (گاما ملایم)
        float day01 = smooth01(sunAltRad, radians(-4.0), radians(12.0));
        vec3 dayCol   = mix(dayHorizon,  dayZenith,  horizonMix);
        vec3 nightCol = mix(nightHorizon,nightZenith,horizonMix);
        vec3 baseCol  = mix(nightCol, dayCol, day01);

        // هاله‌ی خورشید فقط نزدیک خورشید
        float mu = clamp(dot(normalize(vDir), normalize(sunDir)), -1.0, 1.0); // cos(angle)
        float ang = acos(mu); // رادیان
        float glow = exp(-pow(ang / max(glowSizeRad, 1e-3), 2.0)); // Gaussian

        // باند غروب/طلوع: وقتی خورشید نزدیک افق است و نگاه هم نزدیک افق
        float nearHorizon = 1.0 - clamp((abs(up)), 0.0, 1.0);        // 1 نزدیک افق
        float sunNearHorizon = 1.0 - smooth01(abs(sunAltRad), radians(0.0), radians(10.0));
        float warmBand = nearHorizon * sunNearHorizon;               // شدت باند
        vec3 warmCol = mix(baseCol, sunsetWarm, clamp(0.6*warmBand + 0.4*glow*sunNearHorizon, 0.0, 1.0));

        // اگر روز روشن است، سهم باند گرم محدود؛ اگر شب است، گرم نداریم
        float warmMix = day01;
        vec3 col = mix(baseCol, warmCol, warmMix);

        gl_FragColor = vec4(col, 1.0);
      }
    `
    });

    const mesh = new THREE.Mesh(geo, mat);

    function setSun(sunDir: THREE.Vector3, sunAltDeg: number) {
        (mat.uniforms.sunDir.value as THREE.Vector3).copy(sunDir).normalize();
        mat.uniforms.sunAltRad.value = THREE.MathUtils.degToRad(sunAltDeg);
    }
    function setParams(p: Partial<Params>){
        if (p.dayZenith)   mat.uniforms.dayZenith.value.setHex(p.dayZenith);
        if (p.dayHorizon)  mat.uniforms.dayHorizon.value.setHex(p.dayHorizon);
        if (p.nightZenith) mat.uniforms.nightZenith.value.setHex(p.nightZenith);
        if (p.nightHorizon)mat.uniforms.nightHorizon.value.setHex(p.nightHorizon);
        if (p.sunsetWarm)  mat.uniforms.sunsetWarm.value.setHex(p.sunsetWarm);
        if (p.glowSizeDeg!==undefined) mat.uniforms.glowSizeRad.value = THREE.MathUtils.degToRad(p.glowSizeDeg);
    }

    return { mesh, setSun, setParams };
}
// export function createSkyDome(radius=550, top= 0x87c8ff, horizon = 0xbbe1ff){
//     const geo = new THREE.SphereGeometry(radius, 32,24);
//     geo.scale(-1,1,1);
//
//     const colTop = new THREE.Color(top);
//     const colHor = new THREE.Color(horizon);
//     const attr = geo.getAttribute('position');
//     const colors = new Float32Array(attr.count * 3);
//     for (let i = 0; i < attr.count; i++) {
//         const y = attr.getY(i)/radius;
//         const t = THREE.MathUtils.smoothstep((y+0.2),-0.2,0.8);
//         const c = colHor.clone().lerp(colTop, t);
//         colors[i*3] = c.r;
//         colors[i*3+1] = c.g;
//         colors[i*3+2] = c.b;
//     }
//     geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
//
//     const mat = new THREE.MeshBasicMaterial({ vertexColors:true, depthWrite: false });
//     const dome = new THREE.Mesh(geo, mat)
//     dome.renderOrder = -1;
//     return dome;
// }