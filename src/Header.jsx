import { useEffect, useState } from 'react'
const WX = c => c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 48 ? '🌫️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌦️' : '⛈️'
export default function Header({ m }) {
  const [now, setNow] = useState(new Date()), [wx, setWx] = useState(() => JSON.parse(localStorage.getItem('fm_wx') || 'null'))
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t) }, [])
  useEffect(() => {   // Open-Meteo: free, no key. Falls back to Ahmedabad if location is blocked.
    const load = (lat, lon, place) => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`).then(r => r.json())
      .then(j => { const w = { t: Math.round(j.current.temperature_2m), c: j.current.weather_code, place }; setWx(w); localStorage.setItem('fm_wx', JSON.stringify(w)) }).catch(() => {})
    navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => load(p.coords.latitude, p.coords.longitude, 'Near you'), () => load(23.02, 72.57, 'Ahmedabad'), { timeout: 5000 }) : load(23.02, 72.57, 'Ahmedabad')
  }, [])
  const h = now.getHours(), hi = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return <div className="hdr"><div><h1>{hi}, {m.display_name}</h1><span className="muted">{m.household.name}</span></div>
    <div className="clock"><b>{now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</b><br /><span className="muted">{now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}{wx ? ` · ${WX(wx.c)} ${wx.t}°C · ${wx.place}` : ''}</span></div></div>
}
