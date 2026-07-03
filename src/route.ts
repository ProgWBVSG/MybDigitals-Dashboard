// Optimización de recorrido entre varios puntos (compartido por LeadFinder y Pre-venta).
export type RoutePoint = { name: string; lat: number; lon: number; address?: string };

// Ubicación del usuario. Intenta el navegador (preciso) y si falla (permiso/OS apagado),
// cae a geolocalización por IP (funciona siempre, sin permisos). Nivel ciudad, suficiente.
export async function getMyLocation(): Promise<{ lat: number; lon: number; approx: boolean }> {
  if ('geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 7000, maximumAge: 120000, enableHighAccuracy: false }));
      return { lat: pos.coords.latitude, lon: pos.coords.longitude, approx: false };
    } catch { /* cae a IP */ }
  }
  try {
    const r = await fetch('https://ipwho.is/').then(x => x.json());
    if (r && r.success !== false && r.latitude) return { lat: r.latitude, lon: r.longitude, approx: true };
  } catch { /* siguiente */ }
  try {
    const r = await fetch('https://ipapi.co/json/').then(x => x.json());
    if (r && r.latitude) return { lat: r.latitude, lon: r.longitude, approx: true };
  } catch { /* siguiente */ }
  try {
    const r = await fetch('https://get.geojs.io/v1/ip/geo.json').then(x => x.json());
    if (r && r.latitude) return { lat: parseFloat(r.latitude), lon: parseFloat(r.longitude), approx: true };
  } catch { /* nada */ }
  throw new Error('no-location');
}

function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371, toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function nearestNeighbor(points: RoutePoint[]): RoutePoint[] {
  const rest = [...points]; const order = [rest.shift()!];
  while (rest.length) {
    const last = order[order.length - 1];
    let bi = 0, bd = Infinity;
    rest.forEach((p, i) => { const d = haversine(last, p); if (d < bd) { bd = d; bi = i; } });
    order.push(rest.splice(bi, 1)[0]);
  }
  return order;
}

// Devuelve el mejor orden de visita. Usa OSRM (calles reales); si falla, vecino más cercano.
export async function optimizeRoute(points: RoutePoint[]): Promise<{ order: RoutePoint[]; km: number; min: number }> {
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
  try {
    const r = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=false&overview=false`).then(x => x.json());
    if (r.code === 'Ok' && Array.isArray(r.waypoints)) {
      const withIdx = points.map((p, i) => ({ p, idx: r.waypoints[i].waypoint_index as number }));
      withIdx.sort((a, b) => a.idx - b.idx);
      const trip = r.trips?.[0];
      return { order: withIdx.map(x => x.p), km: trip ? trip.distance / 1000 : 0, min: trip ? trip.duration / 60 : 0 };
    }
  } catch { /* usa fallback */ }
  const order = nearestNeighbor(points);
  let km = 0; for (let i = 1; i < order.length; i++) km += haversine(order[i - 1], order[i]);
  return { order, km, min: km / 0.5 }; // ~30 km/h urbano
}

// Link de Google Maps con las paradas en orden. fromMyLocation → arranca desde tu ubicación real.
export function gmapsUrl(order: RoutePoint[], fromMyLocation = false): string {
  const dest = order[order.length - 1];
  const mid = order.slice(0, -1);
  const wpArr = fromMyLocation ? mid : mid.slice(1);
  const origin = fromMyLocation ? '' : (order[0] ? `&origin=${order[0].lat},${order[0].lon}` : '');
  const waypoints = wpArr.length ? `&waypoints=${encodeURIComponent(wpArr.map(p => `${p.lat},${p.lon}`).join('|'))}` : '';
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving${origin}&destination=${dest.lat},${dest.lon}${waypoints}`;
}
