import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from './hooks';
import { emptyService, priceText, SVC_PERIODS, type Service, type ServiceInput } from './services';
import { buildRows, COL_KINDS, guessColumns, looksLikeHeader, mergePrices, parseDelimited, parseXlsx, type ColKind, type Grid } from './sheetImport';

// Traer el Excel: archivo o pegado → elegir qué es cada columna → revisar → guardar.
export default function ServiciosImport({ existing, onClose, add, update }: {
  existing: Service[]; onClose: () => void;
  add: (l: ServiceInput[]) => Promise<boolean>; update: (id: string, p: Partial<ServiceInput>) => Promise<boolean>;
}) {
  const [sheets, setSheets] = useState<{ name: string; grid: Grid }[]>([]);
  const [sheet, setSheet] = useState(0);
  const [paste, setPaste] = useState('');
  const [head, setHead] = useState(0);           // fila de títulos (-1 = no hay)
  const [kinds, setKinds] = useState<ColKind[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const open = (s: { name: string; grid: Grid }[], i = 0) => {
    const grid = s[i]?.grid;
    if (!grid?.length) { toast('No encontré datos en ese archivo', 'error'); return; }
    const h = grid.slice(0, 6).findIndex(looksLikeHeader);
    const cols = Math.max(...grid.map(r => r.length));
    const g: ColKind[] = h >= 0 ? guessColumns(Array.from({ length: cols }, (_, c) => grid[h][c] || '')) : Array.from({ length: cols }, (_, c) => (c === 0 ? 'nombre' : 'ignorar'));
    if (!g.includes('nombre')) g[Math.max(0, g.indexOf('ignorar'))] = 'nombre';
    setSheets(s); setSheet(i); setHead(h); setKinds(g);
  };
  const file = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) open(await parseXlsx(await f.arrayBuffer()));
      else if (/\.(csv|tsv|txt)$/i.test(f.name)) open([{ name: f.name, grid: parseDelimited(await f.text()) }]);
      else toast('Usá un archivo .xlsx o .csv', 'error');
    } catch (e) { toast((e as Error).message || 'No pude leer el archivo', 'error'); }
  };

  const grid = sheets[sheet]?.grid;
  const header = (grid && head >= 0 && grid[head]) || [];
  const rows = useMemo(() => grid ? buildRows(grid.slice(head + 1), kinds, header, existing) : [], [grid, kinds, head, existing]);
  const news = rows.filter(r => !r.match), upd = rows.filter(r => r.match);

  const apply = async () => {
    setBusy(true);
    let ok = true;
    if (news.length) ok = await add(news.map((r, i) => ({ ...emptyService(), ...r.patch, sort: existing.length + i })));
    for (const r of upd) {
      if (!ok) break;
      const { name: _n, ...p } = r.patch;
      ok = await update(r.match!.id, p.prices ? { ...p, prices: mergePrices(r.match!.prices, p.prices) } : p);
    }
    setBusy(false);
    if (ok) { toast(`Listo: ${news.length} nuevos, ${upd.length} actualizados`); onClose(); }
  };
  const setKind = (c: number, k: ColKind) => setKinds(l => l.map((x, i) => i === c ? k : k === 'nombre' && x === 'nombre' ? 'ignorar' : x));

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}><div className="modal sv-modal wide" onClick={e => e.stopPropagation()}>
      <h2>Importar Excel</h2>
      {!sheets.length ? <>
        <label className={`sv-drop${over ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); file(e.dataTransfer.files[0]); }}>
          <FileSpreadsheet size={26} /><b>Elegí el archivo o arrastralo acá</b><span>.xlsx o .csv</span>
          <input type="file" accept=".xlsx,.csv,.tsv,.txt" hidden onChange={e => { file(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <label className="sv-f"><span>O copiá las celdas en Excel y pegalas acá</span><textarea className="textarea" rows={5} value={paste} onChange={e => setPaste(e.target.value)} /></label>
        <div className="modal-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!paste.trim()} onClick={() => open([{ name: 'Pegado', grid: parseDelimited(paste) }])}>Revisar</button></div>
      </> : <>
        {sheets.length > 1 && <label className="sv-f"><span>Hoja</span><select className="select" value={sheet} onChange={e => open(sheets, Number(e.target.value))}>{sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}</select></label>}
        <p className="sv-help">Revisá qué es cada columna. Nada se guarda hasta que confirmes.</p>
        <div className="sv-map">{kinds.map((k, c) => (
          <label key={c} className={k === 'ignorar' ? 'off' : ''}><span title={header[c]}>{header[c] || `Columna ${c + 1}`}</span>
            <select className="select" value={k} onChange={e => setKind(c, e.target.value as ColKind)}>{COL_KINDS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>))}</div>
        <div className="sv-prev">
          {rows.length === 0 ? <div className="sv-none">No encontré servicios. Revisá cuál es la columna del nombre.</div> : rows.map((r, i) => (
            <div key={i}><b>{r.name}</b>
              <span>{[r.patch.area, r.patch.prices?.map(p => priceText(p) + SVC_PERIODS.find(x => x.key === p.period)!.suffix).join(', '), r.patch.includes ? `incluye ${r.patch.includes.length}` : ''].filter(Boolean).join(' · ') || 'Sólo el nombre'}</span>
              <em className={r.match ? 'upd' : ''}>{r.match ? 'Actualiza' : 'Nuevo'}</em></div>))}
        </div>
        <div className="modal-actions"><button className="btn btn-ghost" disabled={busy} onClick={() => setSheets([])}>Volver</button><button className="btn btn-primary" disabled={busy || !rows.length} onClick={apply}>{busy ? 'Guardando…' : `Importar ${rows.length}`}</button></div>
      </>}
    </div></div>
  );
}
