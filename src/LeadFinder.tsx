import { useState } from 'react';
import { MapPin, Search, Plus, Globe, Phone, Check, Loader } from 'lucide-react';
import { useProspects, toast } from './hooks';

type Lead = { name: string; phone: string; website: string; address: string };

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

const CATS: { key: string; label: string; filters: string[] }[] = [
  { key: 'estetica', label: 'Estética / Belleza', filters: ['shop=beauty', 'shop=hairdresser', 'shop=cosmetics', 'leisure=spa'] },
  { key: 'gimnasio', label: 'Gimnasios / Fitness', filters: ['leisure=fitness_centre', 'leisure=sports_centre'] },
  { key: 'salud', label: 'Salud / Consultorios', filters: ['amenity=clinic', 'amenity=dentist', 'amenity=doctors'] },
  { key: 'gastronomia', label: 'Gastronomía', filters: ['amenity=restaurant', 'amenity=cafe', 'amenity=bar', 'amenity=fast_food'] },
  { key: 'inmobiliaria', label: 'Inmobiliarias', filters: ['office=estate_agent'] },
  { key: 'indumentaria', label: 'Indumentaria / Tiendas', filters: ['shop=clothes', 'shop=shoes', 'shop=boutique'] },
  { key: 'hoteleria', label: 'Hotelería / Turismo', filters: ['tourism=hotel', 'tourism=guest_house', 'tourism=apartment'] },
  { key: 'automotor', label: 'Automotor', filters: ['shop=car', 'shop=car_repair'] },
  { key: 'profesionales', label: 'Estudios / Profesionales', filters: ['office=lawyer', 'office=accountant', 'office=consulting', 'office=company'] },
  { key: 'nombre', label: 'Buscar por nombre/rubro', filters: [] },
];

export default function LeadFinder() {
  const { create } = useProspects();
  const [cat, setCat] = useState('estetica');
  const [term, setTerm] = useState('');
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState(8);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Lead[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const key = (l: Lead) => l.name + '|' + l.address;

  const buscar = async () => {
    if (!city.trim()) { setError('Poné una ciudad o zona (ej: "Córdoba, Argentina").'); return; }
    if (cat === 'nombre' && !term.trim()) { setError('Escribí un nombre o rubro para buscar.'); return; }
    setError(''); setLoading(true); setResults([]); setAdded(new Set());
    try {
      const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`, { headers: { 'Accept-Language': 'es' } }).then(r => r.json());
      if (!geo[0]) { setError('No encontré esa zona. Probá con "Ciudad, Provincia".'); return; }
      const { lat, lon } = geo[0];
      const around = `(around:${radius * 1000},${lat},${lon})`;
      const c = CATS.find(x => x.key === cat)!;
      const q = cat === 'nombre'
        ? `nwr["name"~"${term.replace(/["\\]/g, '')}",i]${around};`
        : c.filters.map(f => `nwr[${f}]${around};`).join('');
      const body = `[out:json][timeout:25];(${q});out center 100;`;
      const res = await overpassQuery(body);

      const seen = new Set<string>();
      let leads: Lead[] = (res.elements || []).map((el: any) => {
        const t = el.tags || {};
        const address = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') + (t['addr:city'] ? `, ${t['addr:city']}` : '');
        return {
          name: t.name as string,
          phone: (t.phone || t['contact:phone'] || t['contact:mobile'] || '').toString().trim(),
          website: (t.website || t['contact:website'] || t['contact:instagram'] || '').toString().trim(),
          address: address.trim(),
        };
      }).filter((l: Lead) => l.name);

      if (cat !== 'nombre' && term.trim()) {
        const q2 = term.toLowerCase();
        leads = leads.filter(l => l.name.toLowerCase().includes(q2));
      }
      leads = leads.filter(l => { const k = key(l); if (seen.has(k)) return false; seen.add(k); return true; });
      leads.sort((a, b) => (b.phone ? 1 : 0) - (a.phone ? 1 : 0) || (b.website ? 1 : 0) - (a.website ? 1 : 0));
      setResults(leads.slice(0, 80));
      if (leads.length === 0) setError('No aparecieron negocios con esos filtros. Probá otro rubro, "Buscar por nombre" o ampliá el radio.');
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
    });
    if (id) { setAdded(s => new Set(s).add(key(l))); toast(`${l.name} agregado a Pre-venta`); }
  };

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
        <input className="input" placeholder="Ciudad / zona (ej: Córdoba, Argentina)" value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} />
        <select className="select" value={radius} onChange={e => setRadius(Number(e.target.value))} style={{ maxWidth: 110 }}>
          {[3, 5, 8, 15, 25].map(r => <option key={r} value={r}>{r} km</option>)}
        </select>
        <button className="btn btn-primary" onClick={buscar} disabled={loading}>
          {loading ? <Loader size={16} className="lead-spin" /> : <Search size={16} />} Buscar
        </button>
      </div>

      {error && <div className="lead-error">{error}</div>}

      {results.length > 0 && (
        <>
          <div className="lead-count">{results.length} negocios encontrados · ordenados por los que tienen contacto</div>
          <div className="lead-list">
            {results.map((l, i) => {
              const isAdded = added.has(key(l));
              return (
                <div key={i} className="lead-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="lead-name">{l.name}</div>
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
    </div>
  );
}
