import { useEffect, useState } from 'react'
import { sb, data } from './lib/supabase'

const inviteFromUrl = () => new URLSearchParams(location.search).get('invite')

function SignIn() {
  const [email, setEmail] = useState(''), [msg, setMsg] = useState('')
  const keepInvite = () => { const t = inviteFromUrl(); if (t) localStorage.setItem('fm_invite', t) }
  const magic = async () => {
    keepInvite()
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } })
    setMsg(error ? error.message : 'Check your email for the sign-in link.')
  }
  const google = async () => { keepInvite(); await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }) }
  return (
    <div className="wrap"><h1>FamMoney</h1><p className="muted">One salary, every rupee, the whole family.</p>
      <div className="card">
        <button onClick={google}>Continue with Google</button>
        <p className="muted">or use an email link</p>
        <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="alt" onClick={magic} disabled={!email}>Email me a link</button>
        {msg && <p className={msg.startsWith('Check') ? 'ok' : 'err'}>{msg}</p>}
      </div></div>)
}

function Onboarding({ onDone }) {
  const invite = localStorage.getItem('fm_invite')
  const [name, setName] = useState(''), [me, setMe] = useState(''), [err, setErr] = useState('')
  const go = async () => {
    try {
      if (invite) { await data.rpc('accept_invite', { p_token: invite, p_display: me }); localStorage.removeItem('fm_invite') }
      else await data.rpc('create_household', { p_name: name, p_display: me })
      onDone()
    } catch (e) { setErr(e.message) }
  }
  return (
    <div className="wrap"><h1>{invite ? 'Join your family' : 'Create your household'}</h1>
      <div className="card">
        {!invite && <><label>Household name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Patel Family" /></>}
        <label>Your name</label><input value={me} onChange={e => setMe(e.target.value)} placeholder="e.g. Dad" />
        <button onClick={go} disabled={!me || (!invite && !name)}>{invite ? 'Join' : 'Create'}</button>
        {err && <p className="err">{err}</p>}
      </div></div>)
}

function Home({ m }) {
  const [list, setList] = useState([]), [link, setLink] = useState(''), [err, setErr] = useState('')
  useEffect(() => { data.members(m.household.id).then(setList).catch(e => setErr(e.message)) }, [m])
  const invite = async role => {
    try { const t = await data.rpc('create_invite', { p_household: m.household.id, p_role: role }); setLink(`${location.origin}/?invite=${t}`) }
    catch (e) { setErr(e.message) }
  }
  return (
    <div className="wrap"><h1>{m.household.name}</h1><p className="muted">Signed in as {m.display_name} · {m.role}</p>
      <div className="card"><h2>Family ({list.length}/10)</h2>
        {list.map(x => <div className="row" key={x.id}><span>{x.display_name}</span><span className="pill">{x.role}</span></div>)}
      </div>
      {m.role === 'owner' && <div className="card"><h2>Invite someone</h2>
        <button onClick={() => invite('owner')}>Invite as Owner (spouse)</button>
        <button className="alt" onClick={() => invite('member')}>Invite adult member</button>
        <button className="alt" onClick={() => invite('dependent')}>Invite child (dependent)</button>
        {link && <><p className="muted">Single-use, valid 48 hours. Send it privately:</p><input readOnly value={link} onFocus={e => e.target.select()} /></>}
      </div>}
      {err && <p className="err">{err}</p>}
      <button className="alt" onClick={() => sb.auth.signOut()}>Sign out</button></div>)
}

export default function App() {
  const [session, setSession] = useState(undefined), [m, setM] = useState(undefined)
  useEffect(() => {
    sb.auth.getSession().then(({ data: d }) => setSession(d.session))
    const { data: s } = sb.auth.onAuthStateChange((_e, ses) => setSession(ses))
    return () => s.subscription.unsubscribe()
  }, [])
  const load = () => session ? data.myMembership(session.user.id).then(setM) : setM(undefined)
  useEffect(() => { load() }, [session])
  if (session === undefined) return <div className="wrap muted">Loading…</div>
  if (!session) return <SignIn />
  if (m === undefined) return <div className="wrap muted">Loading…</div>
  return m ? <Home m={m} /> : <Onboarding onDone={load} />
}
