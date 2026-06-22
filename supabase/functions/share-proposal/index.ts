// Edge Function PÚBLICA: sirve UNA propuesta (deck HTML autocontenido) por token,
// validando el vencimiento (30 días). No expone el dashboard ni ningún otro dato.
// Origen = dominio de Supabase, así el prospecto no tiene camino al dashboard.

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

function page(title: string, inner: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head><body>${inner}</body></html>`;
}

function unavailable(msg: string) {
  return html(page('Propuesta', `<div style="margin:0;font-family:Inter,system-ui,sans-serif;background:#0a0f1e;color:#cbd5e1;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px"><div><div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(145deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:#fff;margin:0 auto 18px">M</div><h1 style="color:#f8fafc;font-family:Inter,sans-serif">Propuesta no disponible</h1><p style="font-size:16px">${esc(msg)}</p></div></div>`));
}

interface Proposal {
  cliente: string; subtitulo: string;
  diagnostico: { texto: string; pilares: string[] };
  secciones: { titulo: string; bullets: string[]; descripcion: string }[];
  inversion?: { texto: string; items: string[] };
  proximosPasos: string;
}

function renderDeck(p: Proposal): string {
  const slides: string[] = [];
  slides.push(`<section class="s cover"><div class="logo">M</div><div class="eb">${esc(p.subtitulo || 'Propuesta de valor')}</div><h1>${esc(p.cliente)}</h1><div class="by">Presentado por <b>MYB Digitals</b> · soluciones digitales</div></section>`);
  slides.push(`<section class="s"><div class="eb"><i></i>Diagnóstico</div><h2>Lo que necesita ${esc(p.cliente)}</h2><p class="lead">${esc(p.diagnostico?.texto)}</p><div class="pills">${(p.diagnostico?.pilares || []).map((x, k) => `<div class="pill"><span>${String(k + 1).padStart(2, '0')}</span>${esc(x)}</div>`).join('')}</div></section>`);
  (p.secciones || []).forEach((sec, idx) => {
    slides.push(`<section class="s sec"><div class="num">${String(idx + 1).padStart(2, '0')}</div><div class="secbody"><div class="eb"><i></i>Solución</div><h2>${esc(sec.titulo)}</h2><div class="cols"><ul class="bul">${(sec.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul><p class="desc">${esc(sec.descripcion)}</p></div></div></section>`);
  });
  if (p.inversion && (p.inversion.texto || (p.inversion.items || []).length)) {
    slides.push(`<section class="s"><div class="eb"><i></i>Inversión</div><h2>Inversión</h2><p class="lead">${esc(p.inversion.texto)}</p>${(p.inversion.items || []).length ? `<ul class="bul" style="margin-top:18px;max-width:620px">${p.inversion.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>` : ''}</section>`);
  }
  slides.push(`<section class="s cover"><div class="eb">Próximos pasos</div><h2 style="max-width:820px">${esc(p.proximosPasos)}</h2><div class="by">Gracias · <b>MYB Digitals</b></div></section>`);

  const css = `*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:radial-gradient(70% 60% at 14% 6%,rgba(99,102,241,.20),transparent 55%),radial-gradient(70% 60% at 86% 96%,rgba(16,185,129,.14),transparent 55%),#0a0f1e;color:#cbd5e1;min-height:100vh}
  .deck{display:flex;flex-direction:column;min-height:100vh;padding:52px 56px 0}
  .prog{position:fixed;top:0;left:0;right:0;height:3px;background:rgba(255,255,255,.06);z-index:5}.prog>div{height:100%;background:linear-gradient(90deg,#6366f1,#10b981);transition:width .4s}
  .stage{flex:1;display:flex;align-items:center;width:100%;max-width:1140px;margin:0 auto;cursor:pointer}
  .s{width:100%;display:none;animation:in .4s cubic-bezier(.2,.7,.2,1)}
  .s.on{display:block}.cover.on{display:flex}.sec.on{display:flex}
  @keyframes in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  .eb{display:inline-flex;align-items:center;gap:9px;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#818cf8;margin-bottom:16px}.eb i{width:22px;height:2px;background:#a5b4fc;border-radius:2px}
  h1{font-size:60px;font-weight:800;color:#f8fafc;letter-spacing:-2px;line-height:1.02;margin:0}
  h2{font-size:40px;font-weight:800;color:#f8fafc;letter-spacing:-1px;line-height:1.08;margin:0 0 22px}
  .lead{font-size:20px;line-height:1.6;color:#cbd5e1;max-width:820px}
  .cover{text-align:center;flex-direction:column;align-items:center}.cover h1{margin:10px 0}
  .logo{width:64px;height:64px;border-radius:16px;background:linear-gradient(145deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:800;color:#fff;margin-bottom:22px;box-shadow:0 0 40px rgba(99,102,241,.5)}
  .by{font-size:15px;color:#64748b;margin-top:20px}.by b{color:#a5b4fc}
  .pills{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.pill{display:flex;align-items:center;gap:12px;font-size:16px;font-weight:600;color:#e2e8f0;background:rgba(255,255,255,.03);border:1px solid rgba(99,102,241,.28);border-radius:12px;padding:13px 18px}.pill span{font-size:13px;font-weight:800;color:#a5b4fc;letter-spacing:1px}
  .sec{align-items:flex-start;gap:32px}.num{font-size:90px;font-weight:800;line-height:1;color:transparent;-webkit-text-stroke:2px rgba(129,140,248,.5);flex-shrink:0}.secbody{flex:1;min-width:0}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:start}
  .bul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:14px}.bul li{position:relative;padding-left:28px;font-size:16px;line-height:1.45;color:#e2e8f0}.bul li:before{content:'';position:absolute;left:0;top:6px;width:14px;height:14px;border-radius:50%;background:#10b981;box-shadow:0 0 12px rgba(16,185,129,.6)}
  .desc{font-size:17px;line-height:1.65;color:#cbd5e1;padding-left:22px;border-left:2px solid rgba(99,102,241,.4);margin:0}
  .foot{width:100%;max-width:1140px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:16px 0 20px;border-top:1px solid rgba(255,255,255,.06)}
  .fb{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#94a3b8}.fb .m{width:22px;height:22px;border-radius:6px;background:#6366f1;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}
  .fc{font-size:13px;color:#64748b}
  .nav{display:flex;align-items:center;gap:14px;font-size:13px;font-weight:600;color:#94a3b8}.nav button{background:none;border:1px solid rgba(255,255,255,.12);color:#94a3b8;width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:16px}.nav button:hover{color:#fff;background:rgba(255,255,255,.08)}.nav button:disabled{opacity:.3;cursor:default}
  @media(max-width:768px){.deck{padding:40px 20px 0}h1{font-size:36px}h2{font-size:25px}.num{font-size:52px}.sec{gap:14px}.cols{grid-template-columns:1fr;gap:16px}.desc{padding-left:0;border-left:none}.fc{display:none}}`;

  const total = slides.length;
  const script = `(function(){var s=[].slice.call(document.querySelectorAll('.s')),i=0,p=document.getElementById('pf'),c=document.getElementById('ct'),pv=document.getElementById('pv'),nx=document.getElementById('nx');function show(){for(var k=0;k<s.length;k++)s[k].classList.toggle('on',k===i);p.style.width=((i+1)/${total}*100)+'%';c.textContent=(i+1)+' / ${total}';pv.disabled=i===0;nx.disabled=i===${total - 1};}function go(d){i=Math.max(0,Math.min(${total - 1},i+d));show();}document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key===' ')go(1);else if(e.key==='ArrowLeft')go(-1);});pv.onclick=function(e){e.stopPropagation();go(-1)};nx.onclick=function(e){e.stopPropagation();go(1)};document.querySelector('.stage').onclick=function(){go(1)};show();})();`;

  return html(page(`Propuesta · ${p.cliente}`, `<style>${css}</style><div class="prog"><div id="pf"></div></div><div class="deck"><div class="stage">${slides.join('')}</div><div class="foot"><span class="fb"><span class="m">M</span> MYB Digitals</span><span class="fc">${esc(p.cliente)}</span><div class="nav"><button id="pv">&lsaquo;</button><span id="ct"></span><button id="nx">&rsaquo;</button></div></div></div><script>${script}</script>`));
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return unavailable('Link inválido.');
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/prospects?share_token=eq.${encodeURIComponent(token)}&select=name,proposal,share_expires`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !row.proposal) return unavailable('Este link no existe o fue revocado.');
    if (row.share_expires && Number(row.share_expires) < Date.now()) return unavailable('Este link expiró. Pedile a MYB Digitals uno nuevo.');
    return renderDeck(row.proposal as Proposal);
  } catch (e) {
    return unavailable('No se pudo cargar la propuesta. ' + String((e as Error)?.message || ''));
  }
});
