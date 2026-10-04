import { useState } from 'react'
import { sb } from './lib/supabase'
import { useData } from './lib/hooks'
const COLS = ['#c4ed93', '#7bac7e', '#e0787c', '#6fb7c9', '#e0b36b', '#b48ee0', '#e08fb5', '#9aa3b2']
export default function Settings({ m, members }) {
  const hid = m.household.id, owner = m.role === 'owner', me = members.find(x => x.id === m.id)
  const [name, setName] = useState(m.display_name), [col, setCol] = useState(me?.colour || COLS[0]), [msg, setMsg] = useState(''), [hn, setHn] = useState(null), [msd, setMsd] = useState(null), [ng, setNg] = useState('')
  const [d, reload] = useData(async () => {
    const [h, c] = await Promise.all([sb.from('households').select('id,name,month_start_day,version').eq('id', hid).single(),
      sb.from('categories').select('id,name,kind,parent_id,archived,sort,version').eq('household_id', hid).order('sort')])
    return { h: h.data, cats: c.data || [] }
  }, [hid])
  if (!d) return <div className="skel" />
  const say = e => setMsg(e ? e.message : 'Saved ✓')
  const profile = async () => { const { error } = await sb.rpc('update_profile', { p_household: hid, p_name: name, p_colour: col }); say(error); if (!error) setTimeout(() => location.reload(), 700) }
  const house = async () => { const { error } = await sb.from('households').update({ name: hn ?? d.h.name, month_start_day: Number(msd ?? d.h.month_start_day), version: d.h.version }).eq('id', hid); say(error); reload() }
  const catUp = async (c, patch) => { const { error } = await sb.from('categories').update({ ...patch, version: c.version }).eq('id', c.id); say(error); reload() }
  const addCat = async (nm, parent) => { if (!nm?.trim()) return; const { error } = await sb.from('categories').insert({ household_id: hid, name: nm.trim(), kind: parent?.kind || 'spend', parent_id: parent?.id || null, sort: Math.max(0, ...d.cats.map(c => c.sort)) + 100 }); say(error); setNg(''); reload() }
  const line = (c, ind) => <div className="row" key={c.id} style={{ paddingLeft: ind ? '1.25rem' : 0, opacity: c.archived ? 0.5 : 1 }}>
    <span>{c.name}{c.archived && <span className="muted"> · archived</span>}</span>
    <span><a onClick={() => { const v = prompt('Rename', c.name); if (v?.trim()) catUp(c, { name: v.trim() }) }}>rename</a> · <a onClick={() => catUp(c, { archived: !c.archived })}>{c.archived ? 'restore' : 'archive'}</a>
      {!c.parent_id && <> · <a onClick={() => addCat(prompt('New item under ' + c.name), c)}>+ item</a></>}</span></div>
  return (<><h1>Settings</h1>
    <div className="card"><h2>Your profile</h2><label>Name</label><input value={name} maxLength={40} onChange={e => setName(e.target.value)} />
      <label>Colour</label><div className="chips">{COLS.map(c => <button key={c} aria-label={c} onClick={() => setCol(c)} style={{ width: 40, minHeight: 40, padding: 0, borderRadius: 99, background: c, outline: col === c ? '3px solid #fff' : 'none' }} />)}</div>
      <button disabled={!name.trim()} onClick={profile}>Save profile</button></div>
    {owner && <div className="card"><h2>Household</h2><label>Household name</label><input value={hn ?? d.h.name} onChange={e => setHn(e.target.value)} />
      <label>Month starts on day (1-28)</label><input type="number" min="1" max="28" value={msd ?? d.h.month_start_day} onChange={e => setMsd(e.target.value)} />
      <p className="muted">Applies to new entries only. Change it at the start of a month, not in the middle.</p><button onClick={house}>Save household</button></div>}
    {owner && <div className="card"><h2>Categories</h2>
      {d.cats.filter(c => !c.parent_id).map(g => <div key={g.id}>{line(g)}{d.cats.filter(c => c.parent_id === g.id).map(c => line(c, true))}</div>)}
      <label>New group</label><input value={ng} onChange={e => setNg(e.target.value)} placeholder="e.g. Health" /><button className="alt" disabled={!ng.trim()} onClick={() => addCat(ng, null)}>Add group</button>
      <p className="muted">Archived items stay in old entries but disappear from pickers.</p></div>}
    {msg && <p className={msg.startsWith('Saved') ? 'ok' : 'err'}>{msg}</p>}</>)
}
