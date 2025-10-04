export type GeoPoint = { lat: number; lon: number };

export async function getUserLocation(): Promise<GeoPoint> {
    const geo = await new Promise<GeoPoint | null>(resolve => {
        if (!('geolocation' in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
        );
    });
    if (geo) return geo;
    // fallback دلخواه (اگر مجوز نداد)
    return { lat: 35.7122, lon: 51.3467 }; // Athens به‌عنوان نمونه
}
