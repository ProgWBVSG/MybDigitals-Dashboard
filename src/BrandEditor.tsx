import { useState } from 'react';
import { Upload, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import { supabase } from './supabase';
import { toast } from './hooks';
import { PROPOSAL_THEMES, type Brand } from './utils';

// Editor de marca/diseño de la presentación. Controlado: avisa cada cambio con onChange.
export default function BrandEditor({ brand, prospectId, sectionTitles, onChange }: {
  brand: Brand; prospectId: string; sectionTitles: string[]; onChange: (b: Brand) => void;
}) {
  const b = brand || {};
  const set = (patch: Partial<Brand>) => onChange({ ...b, ...patch });
  const [busy, setBusy] = useState('');

  const upload = async (file: File, slot: string): Promise<string> => {
    if (file.size > 6 * 1024 * 1024) { toast('La imagen supera los 6 MB', 'error'); return ''; }
    setBusy(slot);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const key = `${prospectId}/${slot}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('brand-assets').upload(key, file, { upsert: true, cacheControl: '3600' });
      if (error) { toast('No se pudo subir: ' + error.message, 'error'); return ''; }
      return supabase.storage.from('brand-assets').getPublicUrl(key).data.publicUrl;
    } finally { setBusy(''); }
  };

  const onPick = (slot: string, cb: (url: string) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (f) { const url = await upload(f, slot); if (url) cb(url); }
  };

  const metricas = b.metricas || [];
  const testimonios = b.testimonios || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p className="be-intro">Esto personaliza la presentación. <strong>Cada elemento ya tiene su lugar fijo</strong> en el deck (te aclaro dónde aparece debajo de cada uno). Todo es opcional: lo que dejes vacío, simplemente no se muestra.</p>

      {/* Colores */}
      <div>
        <label className="be-label">Colores de la marca</label>
        <p className="be-hint">Tiñen toda la presentación: barra de progreso, acentos, botones y el fondo de esporas.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {PROPOSAL_THEMES.map(t => {
            const active = b.primary === t.primary && b.secondary === t.secondary;
            return (
              <button key={t.name} title={t.name} onClick={() => set({ primary: t.primary, secondary: t.secondary })}
                style={{ width: 34, height: 34, borderRadius: 9, cursor: 'pointer', padding: 0, background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})`, border: active ? '2px solid #fff' : '2px solid transparent', boxShadow: active ? '0 0 0 2px var(--primary)' : 'none' }} />
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <label className="be-color"><span>Principal</span><input type="color" value={b.primary || '#6366f1'} onChange={e => set({ primary: e.target.value })} /></label>
          <label className="be-color"><span>Acento</span><input type="color" value={b.secondary || '#10b981'} onChange={e => set({ secondary: e.target.value })} /></label>
        </div>
      </div>

      {/* Logo + portada */}
      <div style={{ display: 'flex', gap: 12 }}>
        <AssetSlot label="Logo del cliente" hint="Portada (arriba) y pie de cada slide." url={b.logoUrl} busy={busy === 'logo'}
          onPick={onPick('logo', url => set({ logoUrl: url }))} onClear={() => set({ logoUrl: undefined })} />
        <AssetSlot label="Foto de portada" hint="Fondo de la primera pantalla." url={b.coverUrl} busy={busy === 'cover'}
          onPick={onPick('cover', url => set({ coverUrl: url }))} onClear={() => set({ coverUrl: undefined })} />
      </div>

      {/* Video + WhatsApp */}
      <div className="input-group">
        <label>Video personalizado (Loom o YouTube) — opcional</label>
        <input className="input" placeholder="https://www.loom.com/share/..." value={b.videoUrl || ''} onChange={e => set({ videoUrl: e.target.value })} />
        <p className="be-hint">Si lo cargás, se muestra como una pantalla propia justo después de la portada.</p>
      </div>
      <div className="input-group">
        <label>Tu WhatsApp para el botón "Quiero avanzar"</label>
        <input className="input" placeholder="+54 9 351 ..." value={b.waMyb || ''} onChange={e => set({ waMyb: e.target.value })} />
        <p className="be-hint">Pone un botón en la última pantalla que te escribe a vos por WhatsApp.</p>
      </div>

      {/* Métricas */}
      <div>
        <label className="be-label">Métricas (prueba social)</label>
        <p className="be-hint">Aparecen en una pantalla "Por qué confiar en nosotros" (junto con los testimonios).</p>
        {metricas.map((m, k) => (
          <div key={k} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input className="input" style={{ flex: '0 0 90px' }} placeholder="+8500" value={m.valor}
              onChange={e => set({ metricas: metricas.map((x, j) => j === k ? { ...x, valor: e.target.value } : x) })} />
            <input className="input" style={{ flex: 1 }} placeholder="clientes satisfechos" value={m.label}
              onChange={e => set({ metricas: metricas.map((x, j) => j === k ? { ...x, label: e.target.value } : x) })} />
            <button className="btn btn-ghost btn-icon" onClick={() => set({ metricas: metricas.filter((_, j) => j !== k) })}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={() => set({ metricas: [...metricas, { valor: '', label: '' }] })}><Plus size={13} /> Agregar métrica</button>
      </div>

      {/* Testimonios */}
      <div>
        <label className="be-label">Testimonios</label>
        {testimonios.map((t, k) => (
          <div key={k} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea className="input" rows={2} placeholder="“Trabajo impecable, recomendados.”" value={t.texto}
                onChange={e => set({ testimonios: testimonios.map((x, j) => j === k ? { ...x, texto: e.target.value } : x) })} />
              <input className="input" placeholder="Autor (ej: Juan, Estudio Alba)" value={t.autor}
                onChange={e => set({ testimonios: testimonios.map((x, j) => j === k ? { ...x, autor: e.target.value } : x) })} />
            </div>
            <button className="btn btn-ghost btn-icon" onClick={() => set({ testimonios: testimonios.filter((_, j) => j !== k) })}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={() => set({ testimonios: [...testimonios, { texto: '', autor: '' }] })}><Plus size={13} /> Agregar testimonio</button>
      </div>

      {/* Fotos por sección (cuando ya existe la propuesta) */}
      {sectionTitles.length > 0 && (
        <div>
          <label className="be-label">Foto por sección</label>
          <p className="be-hint">Cada foto aparece al lado del texto de ese pilar de la propuesta.</p>
          {sectionTitles.map((title, k) => {
            const url = b.sectionImages?.[k];
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div className="be-thumb-sm" style={url ? { backgroundImage: `url(${url})` } : undefined}>{!url && <ImageIcon size={14} />}</div>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  {busy === `sec${k}` ? '…' : <Upload size={13} />}
                  <input type="file" accept="image/*" hidden onChange={onPick(`sec${k}`, url => set({ sectionImages: { ...(b.sectionImages || {}), [k]: url } }))} />
                </label>
                {url && <button className="btn btn-ghost btn-icon" onClick={() => { const si = { ...(b.sectionImages || {}) }; delete si[k]; set({ sectionImages: si }); }}><Trash2 size={13} /></button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssetSlot({ label, hint, url, busy, onPick, onClear }: { label: string; hint?: string; url?: string; busy: boolean; onPick: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void; }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="be-label">{label}</label>
      {hint && <p className="be-hint">{hint}</p>}
      <div className="be-thumb" style={url ? { backgroundImage: `url(${url})` } : undefined}>
        {!url && <ImageIcon size={20} />}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
          {busy ? 'Subiendo…' : <><Upload size={13} /> {url ? 'Cambiar' : 'Subir'}</>}
          <input type="file" accept="image/*" hidden onChange={onPick} />
        </label>
        {url && <button className="btn btn-ghost btn-icon" onClick={onClear}><Trash2 size={14} /></button>}
      </div>
    </div>
  );
}
