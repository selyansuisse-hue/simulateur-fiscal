'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props { user: { id: string; email: string; full_name: string } }

export function ProfilForm({ user }: Props) {
  const router = useRouter()
  const [fullName, setFullName] = useState(user.full_name)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').upsert({ id: user.id, full_name: fullName, email: user.email })
    setMsg(error ? 'Erreur lors de la sauvegarde.' : 'Profil mis à jour !')
    setLoading(false)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
        <div className="text-[10.5px] font-bold tracking-widest uppercase text-slate-500 mb-5 pb-3 border-b border-slate-800">
          Informations personnelles
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-wide uppercase text-slate-400">Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="px-3.5 py-2.5 text-sm border-[1.5px] border-slate-600 rounded-lg text-slate-100 bg-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-wide uppercase text-slate-400">Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="px-3.5 py-2.5 text-sm border-[1.5px] border-slate-700 rounded-lg bg-slate-800/50 text-slate-500 cursor-not-allowed"
            />
          </div>
        </div>
        {msg && <p className={`text-xs mt-3 ${msg.includes('Erreur') ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all disabled:opacity-60"
        >
          {loading ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </form>

      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
        <div className="text-[10.5px] font-bold tracking-widest uppercase text-slate-500 mb-4 pb-3 border-b border-slate-800">
          Compte
        </div>
        <button
          onClick={handleSignOut}
          className="px-5 py-2.5 text-red-400 border border-red-500/30 text-sm font-semibold rounded-lg hover:bg-red-500/10 transition-all"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
