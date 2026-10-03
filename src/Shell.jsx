import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { data } from './lib/supabase'
import Spend from './Spend.jsx'
import Plan from './Plan.jsx'
import Family from './Family.jsx'
import { Charts, Calendar } from './Insights.jsx'
const TABS = [['home', '🏠', 'Home'], ['plan', '🧾', 'Plan'], ['charts', '📊', 'Charts'], ['cal', '📅', 'Calendar'], ['more', '👪', 'More']]

export default function Shell({ m }) {
  const [tab, setTab] = useState('home'), [members, setMembers] = useState([])
  const { needRefresh: [need], updateServiceWorker } = useRegisterSW({ onRegisteredSW: (_u, r) => { if (r) setInterval(() => r.update(), 30 * 60 * 1000) } })
  useEffect(() => { data.members(m.household.id).then(setMembers) }, [m, tab])
  return (<div className="wrap" style={{ paddingBottom: '6rem' }}>
    {need && <div className="card" style={{ borderColor: 'var(--accent)' }}><b>Update available</b><button onClick={() => updateServiceWorker(true)}>Refresh</button></div>}
    {tab === 'home' && <><h1>{m.household.name}</h1><Spend m={m} members={members} /></>}
    {tab === 'plan' && <Plan m={m} members={members} />}
    {tab === 'charts' && <Charts />}
    {tab === 'cal' && <Calendar />}
    {tab === 'more' && <Family m={m} members={members} />}
    <nav className="nav">{TABS.map(([k, i, l]) => <a key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{i}</span>{l}</a>)}</nav></div>)
}
