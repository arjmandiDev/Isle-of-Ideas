const RAD = Math.PI / 180;
const DAY_MS = 86400000;

function toJulian(date: Date) { return date.getTime() / DAY_MS  + 2440587.5; }
function toJulianCenturies(jd: number) { return (jd - 2451545.0) / 36525; }

function solarCoords(T: number) {
    const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T*T) % 360;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T*T;
    const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T*T;

    const Mrad = M * RAD;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T*T) * Math.sin(Mrad)
        + (0.019993 - 0.000101 * T) * Math.sin(2*Mrad)
        + 0.000289 * Math.sin(3*Mrad);
    const trueLong = L0 + C;
    const omega = 125.04 - 1934.136 * T;
    const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);

    const epsilon0 = 23.439291 - 0.0130042 * T;
    const epsilon = epsilon0 + 0.00256 * Math.cos(omega * RAD);

    const lambdaRad = lambda * RAD;
    const epsRad = epsilon * RAD;

    const ra = Math.atan2(Math.cos(epsRad) * Math.sin(lambdaRad), Math.cos(lambdaRad));
    const dec = Math.asin(Math.sin(epsRad) * Math.sin(lambdaRad));
    return { ra, dec };
}

function siderealTime(jd: number, lon: number) {
    const T = (jd - 2451545.0) / 36525;
    let theta = 280.46061837 + 360.98564736629 * (jd - 2451545)
        + 0.000387933 * T*T - T*T*T / 38710000;
    theta = (theta % 360 + 360) % 360;
    return (theta + lon) * RAD;
}

function horizCoords(ra: number, dec: number, lat: number, lst: number) {
    const H = lst - ra;
    const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
    const alt = Math.asin(sinAlt);
    const az = Math.atan2(
        -Math.sin(H) * Math.cos(dec),
        Math.sin(dec) - Math.sin(alt) * Math.sin(lat)
    );
    return { alt, az };
}

function moonCoords(T: number) {
    const days = T * 36525;
    const L0 = (218.316 + 13.176396 * days) % 360;
    const M  = 134.963 + 13.064993 * days;
    const F  = 93.272  + 13.229350 * days;

    const L = L0 + 6.289 * Math.sin(M * RAD);
    const B = 5.128 * Math.sin(F * RAD);
    const lambda = L * RAD, beta = B * RAD;

    const epsilon = (23.439 - 0.0000004 * days) * RAD;

    const ra = Math.atan2(
        Math.sin(lambda) * Math.cos(epsilon) - Math.tan(beta) * Math.sin(epsilon),
        Math.cos(lambda)
    );
    const dec = Math.asin(Math.sin(beta) * Math.cos(epsilon) + Math.cos(beta) * Math.sin(epsilon) * Math.sin(lambda));
    return { ra, dec, lambda };
}

export type SunMoonInfo = {
    sun: { altitudeDeg: number; azimuthDeg: number };
    moon:{ altitudeDeg: number; azimuthDeg: number; phase01: number };
};

export function computeSunMoon(lat: number, lon: number, date = new Date()): SunMoonInfo {
    const latRad = lat * RAD;
    const jd = toJulian(date);
    const T = toJulianCenturies(jd);
    const lst = siderealTime(jd, lon);

    const s = solarCoords(T);
    const sh = horizCoords(s.ra, s.dec, latRad, lst);

    const m = moonCoords(T);
    const mh = horizCoords(m.ra, m.dec, latRad, lst);

    // فاز تقریبی (0=ماه نو, 0.5=بدر)
    const phase = (1 - Math.cos((s.ra - m.ra))) * 0.5;

    return {
        sun:  { altitudeDeg: sh.alt / RAD, azimuthDeg: (sh.az / RAD + 360) % 360 },
        moon: { altitudeDeg: mh.alt / RAD, azimuthDeg: (mh.az / RAD + 360) % 360, phase01: phase }
    };
}
