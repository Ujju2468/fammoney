// PIN lock kept on this device only: hash + salt in localStorage. Stops casual access on a shared phone; it is not a server-side control.
import { useEffect, useState } from 'react'
import { sb } from './lib/supabase'
const hash = async (pin, salt) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + pin)))].map(b => b.toString(16).padStart(2, '0')).join('')
const K = k => 'fm_pin_' + k
export const hasPin = k => !!localStorage.getItem(K(k))
const savePin = async (k, pin) => { const s = crypto.randomUUID(); localStorage.setItem(K(k), s + ':' + await hash(pin, s)) }
const okPin = async (k, pin) => { const [s, h] = (localStorage.getItem(K(k)) || ':').split(':'); return h === await hash(pin, s) }

export function PinGate({ k, minutes, title, children }) {
  const [ok, setOk] = useState(!hasPin(k)), [pin, setP] = useState(''), [bad, setBad] = useState(0)
  useEffect(() => {
    if (!hasPin(k)) return; let t
    const vis = () => { if (document.hidden) t = setTimeout(() => setOk(false), minutes * 60000); else clearTimeout(t) }
    document.addEventListener('visibilitychange', vis); return () => { document.removeEventListener('visibilitychange', vis); clearTimeout(t) }
  }, [k, minutes])
  if (ok || !hasPin(k)) return children
  const go = async () => { if (await okPin(k, pin)) { setOk(true); setP(''); setBad(0) } else { setBad(bad + 1); setP('') } }
  return <div className="wrap narrow"><div className="card"><h1>🔒 {title}</h1><p className="muted">Enter your PIN.</p>
    <input type="password" inputMode="numeric" maxLength={8} autoFocus value={pin} onChange={e => setP(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && go()} />
    {bad > 0 && <p className="err">Wrong PIN{bad >= 3 ? ` (${bad} tries)` : ''}.</p>}
    <button disabled={pin.length < 4} onClick={go}>Unlock</button>
    <button className="alt" onClick={async () => { if (confirm('Forgot PIN? You will be signed out and the PIN removed from this phone.')) { localStorage.removeItem(K(k)); await sb.auth.signOut() } }}>Forgot PIN</button></div></div>
}

export function PinSetting({ k, label }) {
  const [on, setOn] = useState(hasPin(k)), [pin, setP] = useState('')
  return <div><label>{label}{on && <span className="ok"> · on</span>}</label>
    {on ? <button className="alt" onClick={() => { if (confirm('Remove this PIN?')) { localStorage.removeItem(K(k)); setOn(false) } }}>Remove PIN</button>
      : <><input type="password" inputMode="numeric" maxLength={8} placeholder="4 to 8 digits" value={pin} onChange={e => setP(e.target.value.replace(/\D/g, ''))} />
        <button disabled={pin.length < 4} onClick={async () => { await savePin(k, pin); setOn(true); setP('') }}>Set PIN</button></>}</div>
}
