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
      <form onSubmit={handleSave} className="bg-white border border-black/[0.07] rounded-xl p-6 shadow-card">
        <div className="text-[10.5px] font-bold tracking-widest uppercase text-ink4 mb-5 pb-3 border-b border-surface2">
          Informations personnelles
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="px-3.5 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg text-ink bg-white focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="px-3.5 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg bg-surface text-ink4 cursor-not-allowed"
            />
          </div>
        </div>
        {msg && <p className={`text-xs mt-3 ${msg.includes('Erreur') ? 'text-red-600' : 'text-green-700'}`}>{msg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 px-5 py-2.5 bg-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-dark transition-all disabled:opacity-60"
        >
          {loading ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </form>

      <div className="bg-white border border-black/[0.07] rounded-xl p-6 shadow-card">
        <div className="text-[10.5px] font-bold tracking-widest uppercase text-ink4 mb-4 pb-3 border-b border-surface2">
          Compte
        </div>
        <button
          onClick={handleSignOut}
          className="px-5 py-2.5 text-red-600 border border-red-200 text-sm font-semibold rounded-lg hover:bg-red-50 transition-all"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
