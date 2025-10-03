export type WeatherNow = {
    temperatureC: number;
    windKph: number;
    windDirDeg: number;
    weatherCode: number; // WMO
    isDay: boolean;
    cloudCoverPct?: number;
    precipitationMm?: number;
};

export async function fetchWeather(lat: number, lon: number): Promise<WeatherNow> {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current_weather', 'true');
    url.searchParams.set('hourly', 'cloudcover,precipitation');
    url.searchParams.set('timezone', 'auto');

    const r = await fetch(url.toString());
    const j = await r.json();

    const cur = j.current_weather;
    const nowISO = String(cur.time);
    const idx = Array.isArray(j.hourly?.time) ? j.hourly.time.indexOf(nowISO) : -1;

    return {
        temperatureC: Number(cur.temperature),
        windKph: Number(cur.windspeed),
        windDirDeg: Number(cur.winddirection),
        weatherCode: Number(cur.weathercode),
        isDay: !!cur.is_day,
        cloudCoverPct: idx >= 0 ? Number(j.hourly.cloudcover[idx]) : undefined,
        precipitationMm: idx >= 0 ? Number(j.hourly.precipitation[idx]) : undefined,
    };
}

export function labelFromWMO(code: number): string {
    if (code === 0) return 'صاف';
    if ([1,2,3].includes(code)) return 'کمی ابری';
    if ([45,48].includes(code)) return 'مه';
    if ([51,53,55].includes(code)) return 'باران ریز';
    if ([61,63,65].includes(code)) return 'باران';
    if ([71,73,75].includes(code)) return 'برف';
    if ([80,81,82].includes(code)) return 'رگبار';
    if ([95,96,99].includes(code)) return 'طوفان';
    return 'نامشخص';
}
