// Tiny value-noise (deterministic) + radial falloff to form an island.
export function seededRandom(seed: number) {
    return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff
}


export function makeValueNoise2D(seed = 1) {
    const rnd = seededRandom(seed)
    const table = new Float32Array(256)
    for (let i = 0; i < 256; i++) table[i] = rnd()
    const hash = (x: number, y: number) => table[(x * 73 ^ y * 151) & 255]
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const smooth = (t: number) => t * t * (3 - 2 * t)
    return (x: number, y: number, freq = 0.1) => {
        x *= freq; y *= freq
        const xi = Math.floor(x), yi = Math.floor(y)
        const tx = smooth(x - xi), ty = smooth(y - yi)
        const a = hash(xi, yi), b = hash(xi + 1, yi)
        const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
        return lerp(lerp(a, b, tx), lerp(c, d, tx), ty)
    }
}

export function islandHeight(
    x: number, y: number, size: number,
    noise2D: (x:number,y:number,f?:number)=>number
) {
    const cx = size / 2, cy = size / 2
    const dx = (x - cx) / (size / 2)
    const dy = (y - cy) / (size / 2)
    const r = Math.sqrt(dx*dx + dy*dy)     // 0 مرکز → 1 لبه
    const mask = Math.max(0, 1 - r*r)      // falloff برای شکل جزیره

    const base = noise2D(x, y, 0.08) * 0.8 + noise2D(x+100, y-50, 0.2) * 0.2

    // برآمدگی مرکزی (قله ملایم). با پارامترها بازی کن:
    const centerBump = Math.max(0, 1 - (r * 1.8) ** 2) * 0.45

    // ارتفاع نهایی (0.. ~8)
    const h = Math.max(0, (base - 0.3) * 8 * mask + centerBump * 8)
    return h
}