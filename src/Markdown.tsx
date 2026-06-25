import React from 'react';

// Renderer de markdown liviano (sin dependencias): encabezados, negrita, itálica,
// listas, links y párrafos. Suficiente para el contenido de la Guía.

// Parseo inline: **negrita**, *itálica*, `código`, [texto](url)
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${i++}`;
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[4]) out.push(<em key={k}>{m[4]}</em>);
    else if (m[6]) out.push(<code key={k} className="md-code">{m[6]}</code>);
    else if (m[8]) out.push(<a key={k} href={m[9]} target="_blank" rel="noreferrer">{m[8]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text }: { text: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, j) => <li key={j}>{inline(it, `li${key}-${j}`)}</li>);
    blocks.push(list.ordered ? <ol key={key++} className="md-ol">{items}</ol> : <ul key={key++} className="md-ul">{items}</ul>);
    list = null;
  };
  const flushPara = () => {
    if (!para.length) return;
    blocks.push(<p key={key++} className="md-p">{inline(para.join(' '), `p${key}`)}</p>);
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flushPara(); flushList(); const lvl = h[1].length; const T = (`h${Math.min(lvl + 1, 5)}`) as 'h2' | 'h3' | 'h4' | 'h5'; blocks.push(<T key={key++} className={`md-h md-h${lvl}`}>{inline(h[2], `h${key}`)}</T>); continue; }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push((ul ? ul[1] : ol![1]));
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara(); flushList();

  return <div className="md">{blocks}</div>;
}
