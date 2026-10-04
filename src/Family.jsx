import { useState } from 'react'
import { sb, data } from './lib/supabase'
import { useData } from './lib/hooks'

export default function Family({ m, members, reload }) {
  const [link, setLink] = useState(''), [err, setErr] = useState('')
  const [audit] = useData(async () => (await sb.from('audit_entries').select('id,entity_type,action,after,at,actor_user_id').order('id', { ascending: false }).limit(40)).data || [], [])
  const invite = async role => { try { setLink(`${location.origin}/?invite=${await data.rpc('create_invite', { p_household: m.household.id, p_role: role })}`) } catch (e) { setErr(e.message) } }
  const remove = async x => { if (!confirm(`Remove ${x.display_name}? They lose access; their history stays.`)) return
    const { error } = await sb.from('members').update({ status: 'former', version: x.version }).eq('id', x.id); setErr(error ? error.message : ''); reload() }
  const who = u => members.find(x => x.user_id === u)?.display_name || 'System'
  return (<><h1>{m.household.name}</h1><p className="muted">Signed in as {m.display_name} · {m.role}</p>
    <div className="card"><h2>Family ({members.filter(x => x.status === 'active').length}/10)</h2>{members.map(x => <div className="row" key={x.id}><span><span style={{ color: x.colour }}>●</span> {x.display_name}</span><span><span className="pill">{x.status === 'former' ? 'former' : x.role}</span>{m.role === 'owner' && x.status === 'active' && x.id !== m.id && <> <a className="muted" onClick={() => remove(x)}>remove</a></>}</span></div>)}</div>
    {m.role === 'owner' && <div className="card"><h2>Invite someone</h2>
      <button onClick={() => invite('owner')}>Invite co-owner</button><button className="alt" onClick={() => invite('member')}>Invite adult</button><button className="alt" onClick={() => invite('dependent')}>Invite child (limited)</button>
      {link && <><p className="muted">Single-use, valid 48 hours:</p><input readOnly value={link} onFocus={e => e.target.select()} /></>}{err && <p className="err">{err}</p>}</div>}
    <div className="card"><h2>Audit log</h2>{(audit || []).map(a => <div className="row" key={a.id}><span>{a.action} · {a.entity_type}<br /><span className="muted">{who(a.actor_user_id)} · {new Date(a.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></span>
      <span>{a.after?.amount_paise ? '₹' + a.after.amount_paise / 100 : ''}</span></div>)}</div>
    <button className="alt" onClick={() => sb.auth.signOut()}>Sign out</button></>)
}
