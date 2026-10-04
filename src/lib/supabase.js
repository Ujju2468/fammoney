// All backend calls live here (blueprint §11 "Better option"): swapping the backend later touches only this file.
import { createClient } from '@supabase/supabase-js'
export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY)
export const openBill = async p => { const { data: d } = await sb.storage.from('bills').createSignedUrl(p, 60); if (d) window.open(d.signedUrl, '_blank') }
export const data = {
  async myMembership(userId) {
    const { data: m, error } = await sb.from('members')
      .select('id,role,display_name,household:households(id,name)').eq('user_id', userId).eq('status', 'active').limit(1)
    if (error) throw error
    return m?.[0] ?? null
  },
  async members(h) {
    const { data: m, error } = await sb.from('members').select('id,user_id,display_name,role,status,version,colour').eq('household_id', h).order('created_at')
    if (error) throw error
    return m
  },
  async rpc(name, args) { const { data: d, error } = await sb.rpc(name, args); if (error) throw error; return d },
}
