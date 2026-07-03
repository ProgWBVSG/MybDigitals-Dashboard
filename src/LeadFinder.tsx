import { useState } from 'react';
import { MapPin, Search, Plus, Globe, Phone, Check, Loader, Navigation } from 'lucide-react';
import { useProspects, toast } from './hooks';
import { optimizeRoute, gmapsUrl, type RoutePoint } from './route';

type Lead = { name: string; phone: string; website: string; address: string; lat?: number; lon?: number };

// Overpass: POST form-encoded (forma canónica). Reintenta en un mirror si el primero falla.
async function overpassQuery(query: string): Promise<any> {
  const eps = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let lastErr: unknown = null;
  for (const ep of eps) {
    try {
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
      if (r.ok) return await r.json();
      lastErr = new Error('HTTP ' + r.status);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('overpass');
}

// filters = etiquetas OSM; nameRegex = también cazar por nombre (para los mal etiquetados)
const CATS: { key: string; label: string; filters: string[]; nameRegex?: string }[] = [
  { key: 'estetica', label: 'Estética / Belleza', filters: ['shop=beauty', 'shop=hairdresser', 'shop=cosmetics', 'leisure=spa'], nameRegex: 'estetica|estética|belleza|spa|peluqueria|peluquería|nails|uñas' },
  { key: 'gimnasio', label: 'Gimnasios / Fitness', filters: ['leisure=fitness_centre', 'leisure=sports_centre', 'sport=fitness'], nameRegex: 'gym|gimnasio|fitness|crossfit|training|entrenamiento' },
  { key: 'salud', label: 'Salud / Consultorios', filters: ['amenity=clinic', 'amenity=dentist', 'amenity=doctors'], nameRegex: 'consultorio|clinica|clínica|dental|odontolog|kinesiolog|nutricion|nutrición' },
  { key: 'gastronomia', label: 'Gastronomía', filters: ['amenity=restaurant', 'amenity=cafe', 'amenity=bar', 'amenity=fast_food'] },
  { key: 'inmobiliaria', label: 'Inmobiliarias', filters: ['office=estate_agent'], nameRegex: 'inmobiliaria|propiedades' },
  { key: 'indumentaria', label: 'Indumentaria / Tiendas', filters: ['shop=clothes', 'shop=shoes', 'shop=boutique'] },
  { key: 'hoteleria', label: 'Hotelería / Turismo', filters: ['tourism=hotel', 'tourism=guest_house', 'tourism=apartment'] },
  { key: 'automotor', label: 'Automotor', filters: ['shop=car', 'shop=car_repair'] },
  { key: 'profesionales', label: 'Estudios / Profesionales', filters: ['office=lawyer', 'office=accountant', 'office=consulting', 'office=company'] },
  { key: 'nombre', label: 'Buscar por nombre/rubro', filters: [] },
];

// Zonas con coordenadas fijas (evita geocodificar = más rápido). "otra" pide texto.
const ZONES: { key: string; label: string; lat?: number; lon?: number; radius?: number }[] = [
  { key: 'mi', label: '📍 Mi ubicación (cerca mío)' },
  { key: 'cba', label: 'Córdoba Capital', lat: -31.4201, lon: -64.1888, radius: 11 },
  { key: 'cba-gran', label: 'Gran Córdoba', lat: -31.42, lon: -64.18, radius: 22 },
  { key: 'carlospaz', label: 'Villa Carlos Paz', lat: -31.424, lon: -64.497, radius: 9 },
  { key: 'rio4', label: 'Río Cuarto', lat: -33.1234, lon: -64.3499, radius: 9 },
  { key: 'caba', label: 'CABA (Buenos Aires)', lat: -34.6037, lon: -58.3816, radius: 12 },
  { key: 'gba', label: 'Gran Buenos Aires', lat: -34.62, lon: -58.44, radius: 30 },
  { key: 'rosario', label: 'Rosario', lat: -32.9587, lon: -60.6931, radius: 12 },
  { key: 'mendoza', label: 'Mendoza', lat: -32.8895, lon: -68.8458, radius: 12 },
  { key: 'laplata', label: 'La Plata', lat: -34.9215, lon: -57.9545, radius: 10 },
  { key: 'mardel', label: 'Mar del Plata', lat: -38.0055, lon: -57.5426, radius: 10 },
  { key: 'tucuman', label: 'Tucumán', lat: -26.8083, lon: -65.2176, radius: 10 },
  { key: 'otra', label: 'Otra zona (escribir)…' },
];

export default function LeadFinder() {
  const { create } = useProspects();
  const [cat, setCat] = useState('estetica');
  const [term, setTerm] = useState('');
  const [zone, setZone] = useState('cba');
  const [customCity, setCustomCity] = useState('');
  const [radiusKm, setRadiusKm] = useState(10);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Lead[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [webFilter, setWebFilter] = useState<'all' | 'sinweb' | 'conweb'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [route, setRoute] = useState<{ order: RoutePoint[]; km: number; min: number } | null>(null);
  const [routing, setRouting] = useState(false);

  const key = (l: Lead) => l.name + '|' + l.address;
  const toggleSel = (l: Lead) => setSelected(s => { const n = new Set(s); const k = key(l); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const armarRecorrido = async () => {
    const pts: RoutePoint[] = results.filter(l => selected.has(key(l)) && l.lat != null && l.lon != null)
      .map(l => ({ name: l.name, lat: l.lat!, lon: l.lon!, address: l.address }));
    if (pts.length < 2) { setError('Elegí al menos 2 negocios (con el check ✓) para armar el recorrido.'); return; }
    if (pts.length > 12) { setError('Máximo 12 paradas por recorrido. Sacá algunas.'); return; }
    setError(''); setRouting(true);
    const r = await optimizeRoute(pts);
    setRoute(r); setRouting(false);
  };

  const buscar = async () => {
    if (cat === 'nombre' && !term.trim()) { setError('Escribí un nombre o rubro para buscar.'); return; }
    const z = ZONES.find(x => x.key === zone)!;
    setError(''); setLoading(true); setResults([]); setAdded(new Set()); setSelected(new Set()); setRoute(null);
    try {
      let lat = z.lat, lon = z.lon;
      const radius = radiusKm;
      if (zone === 'mi') {
        // Geolocalización del navegador (pide permiso)
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 9000, enableHighAccuracy: true }));
          lat = pos.coords.latitude; lon = pos.coords.longitude;
        } catch { setError('No pude obtener tu ubicación. Activá el permiso de ubicación del navegador o elegí una zona de la lista.'); return; }
      } else if (zone === 'otra') {
        if (!customCity.trim()) { setError('Escribí la zona (ej: "Rosario" o "Miami").'); return; }
        // Primero busca en Argentina (evita que "Córdoba" agarre la de España); si no, global.
        let geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=${encodeURIComponent(customCity)}`, { headers: { 'Accept-Language': 'es' } }).then(r => r.json());
        if (!geo[0]) geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(customCity)}`, { headers: { 'Accept-Language': 'es' } }).then(r => r.json());
        if (!geo[0]) { setError('No encontré esa zona. Probá "Ciudad, País".'); return; }
        lat = parseFloat(geo[0].lat); lon = parseFloat(geo[0].lon);
      }
      const around = `(around:${radius * 1000},${lat},${lon})`;
      const c = CATS.find(x => x.key === cat)!;
      let q: string;
      if (cat === 'nombre') {
        q = `nwr["name"~"${term.replace(/["\\]/g, '')}",i]${around};`;
      } else {
        const parts = c.filters.map(f => `nwr[${f}]${around};`);
        if (c.nameRegex) parts.push(`nwr["name"~"${c.nameRegex}",i]${around};`); // también por nombre
        q = parts.join('');
      }
      const body = `[out:json][timeout:20];(${q});out center 70;`;
      const res = await overpassQuery(body);

      const seen = new Set<string>();
      let leads: Lead[] = (res.elements || []).map((el: any) => {
        const t = el.tags || {};
        const address = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') + (t['addr:city'] ? `, ${t['addr:city']}` : '');
        const ll = el.lat != null ? { lat: el.lat, lon: el.lon } : (el.center || {});
        return {
          name: t.name as string,
          phone: (t.phone || t['contact:phone'] || t['contact:mobile'] || '').toString().trim(),
          website: (t.website || t['contact:website'] || t.url || '').toString().trim(),
          address: address.trim(),
          lat: ll.lat, lon: ll.lon,
        };
      }).filter((l: Lead) => l.name);

      if (cat !== 'nombre' && term.trim()) {
        const q2 = term.toLowerCase();
        leads = leads.filter(l => l.name.toLowerCase().includes(q2));
      }
      leads = leads.filter(l => { const k = key(l); if (seen.has(k)) return false; seen.add(k); return true; });
      leads.sort((a, b) => (b.phone ? 1 : 0) - (a.phone ? 1 : 0) || (b.website ? 1 : 0) - (a.website ? 1 : 0));
      setResults(leads.slice(0, 80));
      if (leads.length === 0) setError('No aparecieron negocios con esos filtros. Probá otro rubro, "Buscar por nombre" o una zona más grande (ej: "Gran Córdoba").');
    } catch {
      setError('Hubo un error al buscar (el servicio gratuito puede estar ocupado). Probá de nuevo en unos segundos.');
    } finally { setLoading(false); }
  };

  const agregar = async (l: Lead) => {
    const notes = [l.address && `📍 ${l.address}`, l.website && `🌐 ${l.website}`, l.phone && `📞 ${l.phone}`].filter(Boolean).join('\n');
    const id = await create({
      name: l.name, business: l.name, source: 'Búsqueda (OpenStreetMap)', stage: 'prospeccion',
      contact: { whatsapp: l.phone || '', email: '', instagram: '' },
      meetingAt: null, mint: {}, prep: {}, discovery: {}, notes, proposal: null,
      lat: l.lat ?? null, lon: l.lon ?? null,
    });
    if (id) { setAdded(s => new Set(s).add(key(l))); toast(`${l.name} agregado a Pre-venta`); }
  };

  const shown = results.filter(l => webFilter === 'all' || (webFilter === 'sinweb' ? !l.website : !!l.website));
  const sinWeb = results.filter(l => !l.website).length;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <MapPin size={22} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Buscar clientes</h2>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px' }}>
        Buscá negocios reales por rubro y zona (datos abiertos de OpenStreetMap, gratis). Agregalos a Pre-venta con un clic.
      </p>

      <div className="lead-search">
        <select className="select" value={cat} onChange={e => setCat(e.target.value)}>
          {CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <input className="input" placeholder={cat === 'nombre' ? 'Nombre o rubro (ej: estética)' : 'Filtrar por nombre (opcional)'} value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} />
        <select className="select" value={zone} onChange={e => setZone(e.target.value)}>
          {ZONES.map(z => <option key={z.key} value={z.key}>{z.label}</option>)}
        </select>
        <select className="select" value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))} style={{ maxWidth: 100 }} title="Radio de búsqueda">
          {[2, 5, 10, 15, 25, 40].map(r => <option key={r} value={r}>{r} km</option>)}
        </select>
        {zone === 'otra' && (
          <input className="input" placeholder="Zona (ej: Rosario, Miami…)" value={customCity} onChange={e => setCustomCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} />
        )}
        <button className="btn btn-primary" onClick={buscar} disabled={loading}>
          {loading ? <Loader size={16} className="lead-spin" /> : <Search size={16} />} Buscar
        </button>
      </div>

      {error && <div className="lead-error">{error}</div>}

      {results.length > 0 && (
        <>
          <div className="lead-segments">
            <button className={webFilter === 'all' ? 'active' : ''} onClick={() => setWebFilter('all')}>Todos <b>{results.length}</b></button>
            <button className={webFilter === 'sinweb' ? 'active' : ''} onClick={() => setWebFilter('sinweb')}>Sin web · venderles página <b>{sinWeb}</b></button>
            <button className={webFilter === 'conweb' ? 'active' : ''} onClick={() => setWebFilter('conweb')}>Con web · automatización <b>{results.length - sinWeb}</b></button>
          </div>
          <div className="lead-count">{shown.length} {shown.length === 1 ? 'negocio' : 'negocios'} · los que tienen teléfono/web aparecen primero</div>
          {selected.size > 0 && (
            <div className="lead-routebar">
              <span>🚗 {selected.size} para visitar</span>
              <button className="btn btn-primary btn-sm" onClick={armarRecorrido} disabled={routing || selected.size < 2}>
                {routing ? <Loader size={14} className="lead-spin" /> : <Navigation size={14} />} Armar recorrido
              </button>
            </div>
          )}
          <div className="lead-list">
            {shown.map((l, i) => {
              const isAdded = added.has(key(l));
              return (
                <div key={i} className="lead-item">
                  {l.lat != null && (
                    <button className={`lead-check ${selected.has(key(l)) ? 'on' : ''}`} onClick={() => toggleSel(l)} title="Sumar al recorrido">
                      {selected.has(key(l)) && <Check size={13} />}
                    </button>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="lead-name">
                      {l.name}
                      {l.website
                        ? <span className="lead-tag con">Con web</span>
                        : <span className="lead-tag sin">Sin web</span>}
                    </div>
                    <div className="lead-meta">
                      {l.address && <span><MapPin size={12} /> {l.address}</span>}
                      {l.phone && <span><Phone size={12} /> {l.phone}</span>}
                      {l.website && <span><Globe size={12} /> {l.website.replace(/^https?:\/\//, '').slice(0, 30)}</span>}
                      {!l.address && !l.phone && !l.website && <span style={{ opacity: 0.6 }}>Sin datos de contacto cargados</span>}
                    </div>
                  </div>
                  {isAdded
                    ? <span className="lead-added"><Check size={15} /> Agregado</span>
                    : <button className="btn btn-secondary btn-sm" onClick={() => agregar(l)}><Plus size={14} /> A Pre-venta</button>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="notif-empty"><MapPin size={32} /><p>Elegí un rubro y una zona, y tocá Buscar para encontrar clientes potenciales.</p></div>
      )}

      {route && (
        <div className="modal-overlay" onClick={() => setRoute(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 470 }}>
            <h2><Navigation size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Recorrido óptimo</h2>
            <p className="lead-route-sum">{route.order.length} paradas · ~{route.km.toFixed(1)} km · ~{Math.round(route.min)} min en auto</p>
            <ol className="lead-route-list">
              {route.order.map((l, i) => (
                <li key={i}><span className="lead-route-n">{i + 1}</span><div><strong>{l.name}</strong>{l.address && <span> — {l.address}</span>}</div></li>
              ))}
            </ol>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setRoute(null)}>Cerrar</button>
              <a className="btn btn-primary" href={gmapsUrl(route.order, true)} target="_blank" rel="noreferrer"><Navigation size={15} /> Abrir en Google Maps</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
