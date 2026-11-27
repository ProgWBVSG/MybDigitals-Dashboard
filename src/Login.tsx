import { useState } from 'react';
import { PEOPLE, post, whoAmI, type Me, type Person } from './base';
import { Logo } from './Shell';

// Entrada en la nube: cada uno con su contraseña. La primera vez se crean las dos.
export default function Login({ me, onDone }: { me: Me; onDone: (m: Me) => void }) {
  const [user, setUser] = useState<Person>('benja');
  const [pass, setPass] = useState('');
  const [first, setFirst] = useState(!!me.first);
  const [code, setCode] = useState(''); const [a, setA] = useState(''); const [b, setB] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  const enter = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await post('entrar', { user, pass });
    const m = error ? null : await whoAmI();
    setBusy(false);
    if (error) setErr(error.message); else if (m?.user) onDone(m); else setErr('No se pudo entrar. Probá de nuevo.');
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await post('crear-claves', { code, benja: a, mati: b });
    setBusy(false);
    if (error) setErr(error.message); else setFirst(false);
  };

  return (
    <div className="lg"><div className="lg-box">
      <Logo />
      {first ? <>
        <h1>Creen sus contraseñas</h1>
        <form onSubmit={create}>
          <input className="input" placeholder="Código de instalación" aria-label="Código de instalación" value={code} onChange={e => setCode(e.target.value)} required autoComplete="off" />
          <input className="input" type="password" placeholder="Contraseña de Benjamín" aria-label="Contraseña de Benjamín" value={a} onChange={e => setA(e.target.value)} minLength={10} required autoComplete="new-password" />
          <input className="input" type="password" placeholder="Contraseña de Matías" aria-label="Contraseña de Matías" value={b} onChange={e => setB(e.target.value)} minLength={10} required autoComplete="new-password" />
          <p className="lg-help">Diez caracteres o más cada una.</p>
          {err && <div className="lg-err" role="alert">{err}</div>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Crear'}</button>
        </form>
      </> : <>
        <h1>¿Quién sos?</h1>
        <form onSubmit={enter}>
          <div className="seg lg-seg">{(Object.keys(PEOPLE) as Person[]).map(p => <button type="button" key={p} className={user === p ? 'on' : ''} onClick={() => setUser(p)}>{PEOPLE[p]}</button>)}</div>
          <input type="text" name="username" value={user} readOnly hidden autoComplete="username" />
          <input className="input" type="password" placeholder="Contraseña" aria-label="Contraseña" value={pass} onChange={e => setPass(e.target.value)} autoFocus required autoComplete="current-password" />
          {err && <div className="lg-err" role="alert">{err}</div>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </>}
    </div></div>
  );
}
