// Piezas comunes de las secciones nuevas.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { fromYmd, ymd } from './negocio';

export function Modal({ title, onClose, children, wide, actions }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', k);
    if (!box.current?.contains(document.activeElement)) (box.current?.querySelector('input:not([type=hidden]),textarea,select') as HTMLElement | null)?.focus();
    return () => { window.removeEventListener('keydown', k); prev?.focus?.(); };
  }, []);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal x-modal${wide ? ' wide' : ''}`} ref={box} role="dialog" aria-modal="true" aria-label={title}>
        <div className="x-modal-h"><h2>{title}</h2><button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
        <div className="x-modal-b">{children}</div>
        {actions && <div className="x-modal-f">{actions}</div>}
      </div>
    </div>
  );
}
export function Field({ label, children, help, wide }: { label: string; children: ReactNode; help?: ReactNode; wide?: boolean }) {
  return <label className={`f${wide ? ' wide' : ''}`}><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}
/** Grupo que no es un solo campo (botones, listas). */
export function Group({ label, children, help }: { label: string; children: ReactNode; help?: ReactNode }) {
  return <div className="f" role="group" aria-label={label}><span>{label}</span>{children}{help && <small>{help}</small>}</div>;
}
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label?: string }) {
  return <div className="seg" role="group" aria-label={label}>{options.map(([k, l]) => <button type="button" key={k} className={k === value ? 'on' : ''} aria-pressed={k === value} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
/** "45.000" = 45000, "29,5" = 29.5 */
export function toNumber(t = '') {
  const x = t.replace(/[^\d.,]/g, '');
  const n = Number(/\.\d{3}(\D|$)/.test(x) || x.includes(',') ? x.replace(/\./g, '').replace(',', '.') : x);
  return Number.isFinite(n) ? n : 0;
}
const show = (n: number) => n ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n) : '';
export function Num({ value, onChange, label, ph, prefix, className }: { value: number; onChange: (n: number) => void; label: string; ph?: string; prefix?: string; className?: string }) {
  const [t, setT] = useState(show(value));
  const own = useRef(value);
  useEffect(() => { if (value !== own.current) { own.current = value; setT(show(value)); } }, [value]);
  const input = <input className="input" inputMode="decimal" value={t} placeholder={ph ?? '0'} aria-label={label}
    onChange={e => { setT(e.target.value); own.current = toNumber(e.target.value); onChange(own.current); }} onBlur={() => setT(show(own.current))} />;
  return prefix ? <div className={`num-p ${className || ''}`}><i>{prefix}</i>{input}</div> : input;
}
export function DateIn({ value, onChange, label, min }: { value: number | null; onChange: (t: number | null) => void; label: string; min?: string }) {
  return <input className="input" type="date" aria-label={label} min={min} value={value ? ymd(value) : ''} onChange={e => onChange(e.target.value ? fromYmd(e.target.value) : null)} />;
}
export function Lines({ value, onChange, label, rows = 5 }: { value: string[]; onChange: (v: string[]) => void; label: string; rows?: number }) {
  const [t, setT] = useState(value.join('\n'));
  const own = useRef(value.join('\n'));
  useEffect(() => { const j = value.join('\n'); if (j !== own.current) { own.current = j; setT(j); } }, [value]);
  return <textarea className="textarea" aria-label={label} rows={Math.max(rows, Math.min(16, t.split('\n').length + 1))} value={t}
    onChange={e => { setT(e.target.value); const l = e.target.value.split('\n').map(x => x.replace(/^[-•*\s]+/, '').trimEnd()).filter(x => x.trim()); own.current = l.join('\n'); onChange(l); }} />;
}
export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return <div className="x-empty"><h2>{title}</h2>{text && <p>{text}</p>}{children && <div className="row">{children}</div>}</div>;
}
export function Bar({ pct, label, hot }: { pct: number; label?: string; hot?: boolean }) {
  return <div className={`bar${hot ? ' hot' : ''}`} role="img" aria-label={label} title={label}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
}
export const copyText = async (t: string): Promise<boolean> => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
