// Dónde se guardan los datos. Los dos almacenes responden a lo mismo; el resto del servidor no nota la diferencia.
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ─── Postgres (nube, para los dos) ───
export const PG_SCHEMA = `
  create schema if not exists myb;
  create table if not exists myb.filas (
    n bigint generated always as identity,
    tabla text not null, id text not null, datos jsonb not null,
    creado timestamptz not null default now(), cambiado timestamptz not null default now(),
    primary key (tabla, id)
  );
  create index if not exists filas_orden on myb.filas (tabla, n);
  create table if not exists myb.papelera (
    n bigint generated always as identity primary key,
    tabla text not null, id text not null, datos jsonb not null, cuando bigint not null, grupo text not null
  );
  create index if not exists papelera_grupo on myb.papelera (grupo);
  create table if not exists myb.cambios (n bigint generated always as identity primary key, tabla text not null, cuando timestamptz not null default now());
  create table if not exists myb.archivos (ruta text primary key, tipo text not null, datos bytea not null, creado timestamptz not null default now());
  create table if not exists myb.usuarios (id text primary key, nombre text not null, clave text not null, creado timestamptz not null default now());
  create table if not exists myb.sesiones (huella text primary key, usuario text not null references myb.usuarios(id) on delete cascade, vence timestamptz not null);
  create table if not exists myb.intentos (n bigint generated always as identity primary key, clave text not null, cuando timestamptz not null default now());
`;

/** query(sql, params) → filas; tx(fn) → fn recibe otro query dentro de la transacción. */
export function pgStore({ query, tx, exec }) {
  const ops = q => ({
    all: async t => (await q('select datos from myb.filas where tabla = $1 order by n', [t])).map(r => r.datos),
    get: async (t, id) => (await q('select datos from myb.filas where tabla = $1 and id = $2', [t, id]))[0]?.datos ?? null,
    put: (t, row) => q('insert into myb.filas (tabla, id, datos) values ($1, $2, $3::jsonb) on conflict (tabla, id) do update set datos = excluded.datos, cambiado = now()', [t, String(row.id), JSON.stringify(row)]),
    del: (t, id) => q('delete from myb.filas where tabla = $1 and id = $2', [t, id]),
    trash: (t, row, g) => q('insert into myb.papelera (tabla, id, datos, cuando, grupo) values ($1, $2, $3::jsonb, $4, $5)', [t, String(row.id), JSON.stringify(row), Date.now(), g]),
    trashList: () => q('select tabla, datos, cuando, grupo from myb.papelera order by n desc limit 400'),
    trashGroup: g => q('select tabla, id, datos from myb.papelera where grupo = $1 order by n', [g]),
    untrash: g => q('delete from myb.papelera where grupo = $1', [g]),
    counts: async () => Object.fromEntries((await q('select tabla, count(*)::int as c from myb.filas group by tabla')).map(r => [r.tabla, r.c])),
    everything: () => q('select tabla, datos from myb.filas order by n'),
    wipe: () => q('delete from myb.filas'),
  });
  return {
    ...ops(query),
    query,
    ready: () => exec(PG_SCHEMA),
    // Un cambio por vez: si los dos guardan a la vez, se ordenan en vez de pisarse
    tx: fn => tx(async q => { await q('select pg_advisory_xact_lock(4400)'); return fn(ops(q)); }),
    bump: async tables => {
      if (!tables.length) return;
      await query('insert into myb.cambios (tabla) select unnest($1::text[])', [tables]);
      if (Math.random() < 0.02) await query("delete from myb.cambios where cuando < now() - interval '2 days'");
    },
    since: async n => {
      const last = Number((await query('select coalesce(max(n), 0) as n from myb.cambios'))[0].n);
      if (n == null) return { n: last, epoch: 'pg', tables: [] };
      const r = n >= last ? [] : await query('select distinct tabla from myb.cambios where n > $1', [n]);
      return { n: last, epoch: 'pg', tables: r.map(x => x.tabla) };
    },
    files: {
      get: async p => { const r = (await query('select tipo, datos from myb.archivos where ruta = $1', [p]))[0]; return r ? { type: r.tipo, data: Buffer.from(r.datos) } : null; },
      put: async (p, type, data, over) => (await query(`insert into myb.archivos (ruta, tipo, datos) values ($1, $2, $3) on conflict (ruta) do ${over ? 'update set datos = excluded.datos, tipo = excluded.tipo' : 'nothing'} returning ruta`, [p, type, data])).length > 0,
      count: async () => (await query('select count(*)::int as c from myb.archivos'))[0].c,
    },
  };
}

export async function connectPg(url) {
  const { default: pg } = await import('pg');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pool = new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000, ssl: local || /sslmode=/.test(url) ? undefined : { rejectUnauthorized: true } });
  pool.on('error', e => console.error('Postgres:', e.message));
  return {
    query: async (sql, p) => (await pool.query(sql, p)).rows,
    exec: sql => pool.query(sql),
    tx: async fn => {
      const c = await pool.connect();
      try { await c.query('begin'); const r = await fn(async (sql, p) => (await c.query(sql, p)).rows); await c.query('commit'); return r; }
      catch (e) { await c.query('rollback').catch(() => {}); throw e; }
      finally { c.release(); }
    },
    end: () => pool.end(),
  };
}

// ─── SQLite (en esta compu, sin internet) ───
export async function sqliteStore(dir) {
  const { DatabaseSync } = await import('node:sqlite');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, 'myb.db'));
  db.exec(`
    pragma journal_mode = wal;
    pragma synchronous = full;
    create table if not exists filas (n integer primary key autoincrement, tabla text not null, id text not null, datos text not null, unique (tabla, id));
    create table if not exists papelera (n integer primary key autoincrement, tabla text not null, id text not null, datos text not null, borrado_en integer not null, grupo text not null);
  `);
  const q = {
    all: db.prepare('select datos from filas where tabla = ? order by n'),
    get: db.prepare('select datos from filas where tabla = ? and id = ?'),
    put: db.prepare('insert into filas (tabla, id, datos) values (?, ?, ?) on conflict (tabla, id) do update set datos = excluded.datos'),
    del: db.prepare('delete from filas where tabla = ? and id = ?'),
    trash: db.prepare('insert into papelera (tabla, id, datos, borrado_en, grupo) values (?, ?, ?, ?, ?)'),
    trashList: db.prepare('select tabla, datos, borrado_en as cuando, grupo from papelera order by n desc limit 400'),
    trashGroup: db.prepare('select tabla, id, datos from papelera where grupo = ? order by n'),
    untrash: db.prepare('delete from papelera where grupo = ?'),
    counts: db.prepare('select tabla, count(*) as c from filas group by tabla'),
    everything: db.prepare('select tabla, datos from filas order by n'),
    wipe: db.prepare('delete from filas'),
  };
  const parse = r => ({ ...r, datos: JSON.parse(r.datos) });
  const ops = {
    all: async t => q.all.all(t).map(r => JSON.parse(r.datos)),
    get: async (t, id) => { const r = q.get.get(t, String(id)); return r ? JSON.parse(r.datos) : null; },
    put: async (t, row) => { q.put.run(t, String(row.id), JSON.stringify(row)); },
    del: async (t, id) => { q.del.run(t, id); },
    trash: async (t, row, g) => { q.trash.run(t, String(row.id), JSON.stringify(row), Date.now(), g); },
    trashList: async () => q.trashList.all().map(parse),
    trashGroup: async g => q.trashGroup.all(g).map(parse),
    untrash: async g => { q.untrash.run(g); },
    counts: async () => Object.fromEntries(q.counts.all().map(r => [r.tabla, r.c])),
    everything: async () => q.everything.all().map(parse),
    wipe: async () => { q.wipe.run(); },
  };
  // Las transacciones van en fila: dos pedidos a la vez no se mezclan
  let queue = Promise.resolve();
  const tx = fn => {
    const job = queue.then(async () => {
      db.exec('begin immediate');
      try { const r = await fn(ops); db.exec('commit'); return r; }
      catch (e) { db.exec('rollback'); throw e; }
    });
    queue = job.catch(() => {});
    return job;
  };
  const epoch = randomUUID(); let n = 0; const log = [];
  return {
    // Las lecturas esperan a que termine el cambio en curso, para no ver datos a medias
    ...Object.fromEntries(Object.entries(ops).map(([k, f]) => [k, async (...a) => { await queue; return f(...a); }])),
    tx,
    ready: async () => {},
    bump: async tables => { for (const t of tables) log.push([++n, t]); if (log.length > 2000) log.splice(0, 1000); },
    since: async from => ({ n, epoch, tables: from == null ? [] : [...new Set(log.filter(([i]) => i > from).map(([, t]) => t))] }),
    close: () => { db.exec('pragma wal_checkpoint(truncate)'); db.close(); },
  };
}
