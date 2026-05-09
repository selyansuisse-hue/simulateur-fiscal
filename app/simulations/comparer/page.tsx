'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { SimulationsGrid } from '../../dashboard/SimulationsGrid'
import { EnrichedCompareTable } from '@/components/simulations/EnrichedCompareTable'
import { fmt } from '@/lib/utils'

const LOCAL_KEY = 'belhoxper_simulations'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SimRow = any

function getLocalSims(): SimRow[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch { return [] }
}
async function deleteLocalSim(id: string) {
  const updated = getLocalSims().filter((s: SimRow) => s.id !== id)
  localStorage.setItem(LOCAL_KEY, JSON.stringify(updated))
}

const HORIZONS = [
  { label: '1 an',  tag: 'Court terme', mult: 1,  long: false },
  { label: '3 ans', tag: 'Moyen terme', mult: 3,  long: false },
  { label: '5 ans', tag: 'Stratégique', mult: 5,  long: false },
  { label: '10 ans',tag: 'Long terme',  mult: 10, long: true  },
]
// Visual height proportions for projection bars (winner column)
const PROJ_H_A = [30, 50, 70, 100]

interface DecoData {
  ca: number; charges: number; cotis: number; ir: number; net: number
  pCharges: number; pCotis: number; pIr: number; pNet: number
}

function decoSim(s: SimRow): DecoData {
  const ca       = s.ca ?? 0
  const charges  = s.params?.charges ?? 0
  const ir       = s.best_ir ?? 0
  const net      = s.best_net_annuel ?? 0
  const cotis    = Math.max(0, ca - charges - ir - net)
  const safe     = (v: number) => ca > 0 ? Math.max(0.5, Math.min(99, (v / ca) * 100)) : 0
  return { ca, charges, cotis, ir, net, pCharges: safe(charges), pCotis: safe(cotis), pIr: safe(ir), pNet: safe(net) }
}

const emptyDeco: DecoData = { ca: 0, charges: 0, cotis: 0, ir: 0, net: 0, pCharges: 0, pCotis: 0, pIr: 0, pNet: 0 }

export default function SimulationsPage() {
  const [sims, setSims]                       = useState<SimRow[]>([])
  const [isLoggedIn, setIsLoggedIn]           = useState(false)
  const [isCabinetMembre, setIsCabinetMembre] = useState(false)
  const [loading, setLoading]                 = useState(true)
  const [selectedIds, setSelectedIds]         = useState<string[]>([])
  const [comparePdfLoading, setComparePdfLoading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setIsLoggedIn(true)
          const [simsResult, membreResult] = await Promise.all([
            supabase.from('simulations')
              .select('id, name, created_at, best_forme, best_net_annuel, best_net_mois, best_ir, tmi, ca, situation, gain, params')
              .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
            supabase.from('cabinet_membres').select('id').eq('user_id', user.id).limit(1),
          ])
          setSims(simsResult.data || [])
          setIsCabinetMembre((membreResult.data?.length ?? 0) > 0)
        } else {
          setIsLoggedIn(false); setIsCabinetMembre(false)
          setSims(getLocalSims())
        }
      } catch { setSims(getLocalSims()) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (sims.length >= 2 && selectedIds.length === 0) {
      setSelectedIds(sims.slice(0, 2).map((s: SimRow) => s.id))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sims])

  const handleComparePDF = useCallback(async () => {
    if (selectedIds.length < 2 || comparePdfLoading) return
    setComparePdfLoading(true)
    try {
      const res = await fetch('/api/simulations/compare/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulationIds: selectedIds.slice(0, 2) }),
      })
      const contentType = res.headers.get('content-type') || ''
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (contentType.includes('application/pdf')) {
        const a = document.createElement('a')
        a.href = url; a.download = `comparaison-belhoxper-${Date.now()}.pdf`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1500)
      } else { window.open(url, '_blank') }
    } catch (e) { console.error('[compare pdf]', e) }
    finally { setComparePdfLoading(false) }
  }, [selectedIds, comparePdfLoading])

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) { if (prev.length <= 2) return prev; return prev.filter(x => x !== id) }
      return [...prev, id]
    })
  }

  const selectedSims = sims.filter((s: SimRow) => selectedIds.includes(s.id))
  const projSims     = [...selectedSims]
    .sort((a: SimRow, b: SimRow) => (b.best_net_annuel ?? 0) - (a.best_net_annuel ?? 0))
    .slice(0, 2)
  const showComparison = isCabinetMembre && projSims.length >= 2

  // ── Derived comparison values ─────────────────────────────────────────────
  const simA = projSims[0]
  const simB = projSims[1]

  const ecartAnnuel  = showComparison ? Math.round((simA?.best_net_annuel ?? 0) - (simB?.best_net_annuel ?? 0)) : 0
  const ecartMensuel = Math.round(ecartAnnuel / 12)
  const ecartPct     = (simB?.best_net_annuel ?? 0) > 0
    ? Math.round((ecartAnnuel / simB.best_net_annuel) * 1000) / 10 : 0
  const ecart10ans   = ecartAnnuel * 10

  const barPctB = showComparison && (simA?.best_net_annuel ?? 0) > 0
    ? Math.round(((simB?.best_net_annuel ?? 0) / simA.best_net_annuel) * 100) : 0

  const projHB = showComparison && (simA?.best_net_annuel ?? 0) > 0
    ? PROJ_H_A.map(h => Math.max(4, Math.round(h * ((simB?.best_net_annuel ?? 0) / simA.best_net_annuel))))
    : [0, 0, 0, 0]

  const dA = showComparison ? decoSim(simA) : emptyDeco
  const dB = showComparison ? decoSim(simB) : emptyDeco

  const perA = showComparison ? (simA?.params?.perMontant ?? 0) : 0
  const perB = showComparison ? (simB?.params?.perMontant ?? 0) : 0
  const caDiff = showComparison ? ((simA?.ca ?? 0) - (simB?.ca ?? 0)) : 0

  function genResume(): string {
    const parts: string[] = []
    if (Math.abs(caDiff) > 5000)
      parts.push(`la différence de CA (${caDiff > 0 ? '+' : ''}${Math.round(caDiff).toLocaleString('fr-FR')} €)`)
    if (perA !== perB && perA > 0)
      parts.push(`l'activation du PER (${fmt(perA)}) non utilisée dans le scénario alternatif`)
    else if (perA !== perB && perB > 0)
      parts.push(`le PER activé dans le scénario alternatif (${fmt(perB)})`)
    if (simA?.best_forme !== simB?.best_forme)
      parts.push(`la structure juridique (${simA?.best_forme} vs ${simB?.best_forme})`)
    if (parts.length === 0) parts.push('les paramètres de simulation')
    return parts.join(' et ')
  }

  const ecartFontSize = ecartAnnuel > 99999 ? '48px' : ecartAnnuel > 9999 ? '60px' : '72px'

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{`html, body { background: #080d1a !important; }`}</style>
        <PageHeader />
        <div style={{ minHeight: '100vh', background: '#080d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>Chargement…</div>
        </div>
        <Footer />
      </>
    )
  }

  // ── Shared inline style helpers ───────────────────────────────────────────
  const chipBase = { display: 'inline-flex' as const, alignItems: 'center' as const, padding: '3px 9px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 600 }
  const mono     = { fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontVariantNumeric: 'tabular-nums' as const }

  return (
    <>
      <style>{`html, body { background: #080d1a !important; }`}</style>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#080d1a' }}>

        {/* ── Non-connecté banner ───────────────────────────────────────── */}
        {!isLoggedIn && sims.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.09),rgba(139,92,246,0.06))', borderBottom: '1px solid rgba(37,99,235,0.18)', padding: '12px 24px' }}>
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
              <div style={{ fontSize: '13px', color: '#60a5fa' }}>
                💾 Simulations sauvegardées localement — créez un compte pour les conserver définitivement.
              </div>
              <Link href="/auth/signup" style={{ fontSize: '12px', fontWeight: 700, padding: '7px 14px', borderRadius: '8px', background: '#2563eb', color: '#fff', textDecoration: 'none', flexShrink: 0 }}>
                Créer un compte →
              </Link>
            </div>
          </div>
        )}

        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 40px 80px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ── PAGE HEAD ─────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700, color: '#60a5fa' }}>
                <span style={{ display: 'block', width: '18px', height: '1px', background: 'rgba(96,165,250,0.5)' }}></span>
                Analyse comparative · {sims.length} scénario{sims.length !== 1 ? 's' : ''}
              </div>
              <h1 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.025em', color: '#f1f5f9', margin: '10px 0 0' }}>
                Mes simulations
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '8px 0 0', maxWidth: '580px', lineHeight: 1.55 }}>
                {showComparison
                  ? `Comparaison détaillée de vos scénarios. Le scénario optimal et l'écart annuel sont mis en évidence ci-dessous.`
                  : `${sims.length} simulation${sims.length !== 1 ? 's' : ''} enregistrée${sims.length !== 1 ? 's' : ''}${!isLoggedIn && sims.length > 0 ? ' (locales)' : ''}.`
                }
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link href="/simulateur" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', background: 'linear-gradient(135deg,#3B82F6,#2563eb)', color: '#fff', textDecoration: 'none', boxShadow: '0 10px 28px -10px rgba(59,130,246,0.6)', border: '1px solid rgba(59,130,246,0.5)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}><path d="M12 5v14M5 12h14"/></svg>
                Nouvelle simulation
              </Link>
              {isLoggedIn && selectedIds.length >= 2 && (
                <button onClick={handleComparePDF} disabled={comparePdfLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', cursor: comparePdfLoading ? 'default' : 'pointer', background: comparePdfLoading ? 'rgba(139,92,246,0.35)' : 'linear-gradient(135deg,#8B5CF6,#7c3aed)', color: '#fff', border: '1px solid rgba(139,92,246,0.5)', boxShadow: '0 10px 28px -10px rgba(139,92,246,0.6)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {comparePdfLoading ? 'Génération…' : 'Exporter en PDF'}
                </button>
              )}
            </div>
          </div>

          {/* ── Selector pills — cabinet + more than 2 sims ───────────────── */}
          {isCabinetMembre && sims.length > 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '14px 18px', background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(51,65,85,0.55)', borderRadius: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', flexShrink: 0 }}>Comparer :</span>
              {sims.map((s: SimRow) => {
                const active = selectedIds.includes(s.id)
                return (
                  <button key={s.id} onClick={() => toggleId(s.id)} style={{ fontSize: '12px', fontWeight: 600, padding: '5px 14px', borderRadius: '999px', border: active ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(51,65,85,0.5)', background: active ? '#2563eb' : 'rgba(15,23,42,0.8)', color: active ? '#fff' : '#475569', cursor: 'pointer', transition: 'all 150ms', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </button>
                )
              })}
              {selectedIds.length > 2 && (
                <span style={{ fontSize: '11px', color: '#475569', marginLeft: '4px' }}>{selectedIds.length} sélectionnés</span>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              COMPARISON SECTIONS — cabinet members with ≥ 2 projSims
          ════════════════════════════════════════════════════════════════ */}
          {showComparison && (
            <>
              {/* ── HERO ─────────────────────────────────────────────────── */}
              <section className="cmp-hero">
                {/* Eyebrow */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.28)', color: '#60a5fa', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', position: 'relative', zIndex: 1 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: '#3B82F6', boxShadow: '0 0 10px #3B82F6', flexShrink: 0 }}></span>
                  Analyse comparative — {projSims.length} scénarios
                </div>

                {/* 3-col grid */}
                <div style={{ marginTop: '22px', display: 'grid', gridTemplateColumns: '1.1fr 1.4fr 1fr', gap: '20px', alignItems: 'stretch', position: 'relative', zIndex: 1 }}>

                  {/* Winner cell */}
                  <div style={{ background: 'rgba(8,13,26,0.5)', border: '1px solid rgba(51,65,85,0.35)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                    {/* Winner badge */}
                    <div style={{ position: 'absolute', top: '-1px', right: '14px', transform: 'translateY(-50%)', padding: '4px 10px', borderRadius: '999px', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: 'white', fontSize: '9.5px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800, boxShadow: '0 6px 18px -6px rgba(59,130,246,0.7)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '11px', height: '11px' }}><polygon points="12 2 15 9 22 9 17 14 19 22 12 18 5 22 7 14 2 9 9 9 12 2"/></svg>
                      Meilleur
                    </div>
                    <div style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Scénario optimal</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>
                      {simA.name}
                      <br/><span style={{ color: '#60a5fa', fontSize: '13px', fontWeight: 600 }}>{simA.best_forme}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      <span style={{ ...chipBase, background: 'rgba(59,130,246,0.14)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.32)' }}>CA {fmt(simA.ca)}</span>
                      {perA > 0 && <span style={{ ...chipBase, background: 'rgba(139,92,246,0.14)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.32)' }}>PER {fmt(perA)}</span>}
                      <span style={{ ...chipBase, background: 'rgba(148,163,184,0.10)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.20)' }}>TMI {simA.tmi ?? '—'}%</span>
                    </div>
                    <div style={{ ...mono, fontSize: '38px', fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1, color: '#6ee7b7', marginTop: '8px' }}>{fmt(simA.best_net_annuel)}</div>
                    <div style={{ ...mono, color: '#94a3b8', fontSize: '12px' }}>net/an · {fmt(Math.round((simA.best_net_annuel ?? 0) / 12))}/mois</div>
                    <div style={{ marginTop: 'auto', height: '6px', background: 'rgba(148,163,184,0.15)', borderRadius: '99px', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: '100%', background: 'linear-gradient(90deg,#10B981,#3B82F6)', borderRadius: '99px' }}></span>
                    </div>
                  </div>

                  {/* Écart central */}
                  <div style={{ textAlign: 'center', background: 'radial-gradient(400px 180px at 50% 50%,rgba(16,185,129,0.18),transparent 70%),linear-gradient(180deg,rgba(16,185,129,0.06),rgba(16,185,129,0.02))', border: '1px solid rgba(16,185,129,0.35)', boxShadow: 'inset 0 0 60px rgba(16,185,129,0.06),0 20px 60px -30px rgba(16,185,129,0.4)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6ee7b7', fontWeight: 700 }}>Écart annuel net</div>
                    <div style={{ ...mono, fontSize: ecartFontSize, fontWeight: 900, letterSpacing: '-0.045em', lineHeight: 0.95, color: '#6ee7b7', textShadow: '0 0 50px rgba(16,185,129,0.35)', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
                      +{ecartAnnuel.toLocaleString('fr-FR')}<span style={{ fontSize: '38px', opacity: 0.85 }}>€</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#6ee7b7', fontSize: '13px', fontWeight: 600 }}>
                      <span>+{fmt(ecartMensuel)}/mois</span>
                      <span style={{ width: '4px', height: '4px', borderRadius: '99px', background: '#10B981' }}></span>
                      <span>+{ecartPct}%</span>
                    </div>
                    <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.32)', color: '#fcd34d', fontWeight: 700, fontSize: '13px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>
                      Sur 10 ans : +{fmt(ecart10ans)}
                    </div>
                  </div>

                  {/* Alternatif cell */}
                  <div style={{ background: 'rgba(8,13,26,0.5)', border: '1px solid rgba(51,65,85,0.35)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.85 }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Scénario alternatif</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#cbd5e1', lineHeight: 1.3 }}>
                      {simB.name}
                      <br/><span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>{simB.best_forme}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      <span style={{ ...chipBase, background: 'rgba(148,163,184,0.10)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.20)' }}>CA {fmt(simB.ca)}</span>
                      {perB > 0
                        ? <span style={{ ...chipBase, background: 'rgba(139,92,246,0.14)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.32)' }}>PER {fmt(perB)}</span>
                        : <span style={{ ...chipBase, background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>PER 0</span>
                      }
                      <span style={{ ...chipBase, background: 'rgba(148,163,184,0.10)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.20)' }}>TMI {simB.tmi ?? '—'}%</span>
                    </div>
                    <div style={{ ...mono, fontSize: '38px', fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1, color: '#cbd5e1', marginTop: '8px' }}>{fmt(simB.best_net_annuel)}</div>
                    <div style={{ ...mono, color: '#94a3b8', fontSize: '12px' }}>net/an · {fmt(Math.round((simB.best_net_annuel ?? 0) / 12))}/mois</div>
                    <div style={{ marginTop: 'auto', height: '6px', background: 'rgba(148,163,184,0.15)', borderRadius: '99px', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${barPctB}%`, background: 'linear-gradient(90deg,#475569,#64748b)', borderRadius: '99px' }}></span>
                    </div>
                  </div>
                </div>

                {/* En résumé */}
                <div style={{ marginTop: '18px', padding: '14px 18px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.35)', borderLeft: '2px solid #3B82F6', borderRadius: '10px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>
                  <strong style={{ color: '#f1f5f9' }}>En résumé :</strong> votre scénario le plus favorable est{' '}
                  <strong style={{ color: '#f1f5f9' }}>&ldquo;{simA.name} — {simA.best_forme}&rdquo;</strong> avec{' '}
                  <strong style={{ ...mono, color: '#6ee7b7' }}>{fmt(simA.best_net_annuel)}/an</strong>.{' '}
                  L&apos;écart provient principalement de {genResume()}.
                </div>
              </section>

              {/* ── POURQUOI section ──────────────────────────────────────── */}
              <section className="cmp-card">
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '2px', background: 'linear-gradient(90deg,transparent,#3B82F6,transparent)' }}></div>
                <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid rgba(51,65,85,0.35)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                    Pourquoi &ldquo;{simA.name}&rdquo; est plus rentable ?
                  </h3>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Analyse dynamique</span>
                </div>
                <div style={{ padding: '22px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>

                    {/* CA diff */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '14px 16px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.35)', borderRadius: '12px' }}>
                      <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59,130,246,0.14)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.30)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px', margin: 0 }}>
                          CA {caDiff > 0 ? 'supérieur' : caDiff < 0 ? 'inférieur' : 'identique'}{Math.abs(caDiff) > 0 ? ` de ${fmt(Math.abs(caDiff))}` : ''}
                        </h4>
                        <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.55, margin: '4px 0 0' }}>
                          {fmt(simA.ca)} vs {fmt(simB.ca)} — impact direct sur le revenu brut disponible avant cotisations.
                        </p>
                        {Math.abs(caDiff) > 0 && (
                          <span style={{ ...mono, display: 'inline-block', marginTop: '6px', fontSize: '12px', fontWeight: 700, color: '#6ee7b7' }}>
                            Impact ≈ {caDiff > 0 ? '+' : ''}{fmt(Math.round(caDiff * 0.3))}/an net
                          </span>
                        )}
                      </div>
                    </div>

                    {/* PER */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '14px 16px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.35)', borderRadius: '12px' }}>
                      <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.14)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.30)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px', margin: 0 }}>
                          {Math.max(perA, perB) > 0
                            ? `PER ${perA >= perB ? 'activé' : 'non activé'} à ${fmt(Math.max(perA, perB))}`
                            : 'PER non activé'
                          }
                        </h4>
                        <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.55, margin: '4px 0 0' }}>
                          {Math.max(perA, perB) > 0
                            ? "Réduit la base imposable et génère une économie d'IR à votre TMI."
                            : "Activer le PER peut réduire la base imposable et générer une économie d'IR."
                          }
                        </p>
                        {Math.max(perA, perB) > 0 && (
                          <span style={{ ...mono, display: 'inline-block', marginTop: '6px', fontSize: '12px', fontWeight: 700, color: '#6ee7b7' }}>
                            Économie IR ≈ +{fmt(Math.round(Math.max(perA, perB) * (simA.tmi ?? 30) / 100))}/an
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Structure */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '14px 16px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.35)', borderRadius: '12px' }}>
                      <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,185,129,0.14)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.30)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/></svg>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px', margin: 0 }}>
                          {simA.best_forme === simB.best_forme ? 'Structure identique' : 'Structures différentes'}
                        </h4>
                        <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.55, margin: '4px 0 0' }}>
                          {simA.best_forme === simB.best_forme
                            ? "Aucun biais structurel — l'avantage vient bien des paramètres et non du choix juridique."
                            : `${simA.best_forme} vs ${simB.best_forme} — impact structurel sur les cotisations.`
                          }
                        </p>
                        <span style={{ ...mono, display: 'inline-block', marginTop: '6px', fontSize: '12px', fontWeight: 700, color: '#6ee7b7' }}>
                          {simA.best_forme === simB.best_forme ? 'Comparaison fiable' : 'Biais structurel à noter'}
                        </span>
                      </div>
                    </div>

                    {/* Effet long terme */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '14px 16px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.35)', borderRadius: '12px' }}>
                      <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.14)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.30)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px', margin: 0 }}>
                          Effet long terme amplifié
                        </h4>
                        <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.55, margin: '4px 0 0' }}>
                          L&apos;écart annuel se compose : sur 10 ans, le différentiel atteint {fmt(ecart10ans)}.
                        </p>
                        <span style={{ ...mono, display: 'inline-block', marginTop: '6px', fontSize: '12px', fontWeight: 700, color: '#fcd34d' }}>
                          +{fmt(ecart10ans)} sur 10 ans
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              </section>

              {/* ── DÉCOMPOSITION VISUELLE ────────────────────────────────── */}
              <section className="cmp-card">
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '2px', background: 'linear-gradient(90deg,transparent,#8B5CF6,transparent)' }}></div>
                <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid rgba(51,65,85,0.35)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Décomposition visuelle des coûts</h3>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>% du CA brut · charges → net</span>
                </div>
                <div style={{ padding: '22px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {([{ sim: simA, d: dA, winner: true }, { sim: simB, d: dB, winner: false }] as const).map(({ sim, d, winner }) => (
                      <div key={sim.id} style={{ padding: '18px', background: winner ? 'linear-gradient(180deg,rgba(59,130,246,0.05),rgba(15,23,42,0.5))' : 'rgba(15,23,42,0.5)', border: winner ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(51,65,85,0.35)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{sim.name}</div>
                            <div style={{ ...mono, fontSize: '12px', color: '#94a3b8' }}>CA brut · {fmt(d.ca)}</div>
                          </div>
                          <span style={{ ...chipBase, background: winner ? 'rgba(59,130,246,0.14)' : 'rgba(148,163,184,0.10)', color: winner ? '#60a5fa' : '#cbd5e1', border: `1px solid ${winner ? 'rgba(59,130,246,0.32)' : 'rgba(148,163,184,0.20)'}` }}>
                            {winner ? 'Meilleur' : 'Alternatif'}
                          </span>
                        </div>
                        {/* Stacked bar */}
                        <div style={{ display: 'flex', height: '36px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(51,65,85,0.35)', background: '#0b1326' }}>
                          <div className="cmp-seg" style={{ width: `${d.pCharges}%`, background: 'linear-gradient(135deg,#ef4444,#dc2626)' }} title="Charges d'exploitation">
                            {d.pCharges > 8 && <span style={{ ...mono, fontSize: '10.5px', opacity: 0.95 }}>{Math.round(d.pCharges)}%</span>}
                          </div>
                          <div className="cmp-seg" style={{ width: `${d.pCotis}%`, background: 'linear-gradient(135deg,#f59e0b,#d97706)' }} title="Cotisations sociales">
                            {d.pCotis > 8 && <span style={{ ...mono, fontSize: '10.5px', opacity: 0.95 }}>{Math.round(d.pCotis)}%</span>}
                          </div>
                          <div className="cmp-seg" style={{ width: `${d.pIr}%`, background: 'linear-gradient(135deg,#8B5CF6,#7c3aed)' }} title="IR + IS">
                            {d.pIr > 8 && <span style={{ ...mono, fontSize: '10.5px', opacity: 0.95 }}>{Math.round(d.pIr)}%</span>}
                          </div>
                          <div className="cmp-seg" style={{ width: `${d.pNet}%`, background: 'linear-gradient(135deg,#10B981,#059669)' }} title="Net">
                            {d.pNet > 8 && <span style={{ ...mono, fontSize: '10.5px', opacity: 0.95 }}>{Math.round(d.pNet)}%</span>}
                          </div>
                        </div>
                        {/* Legend */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginTop: '12px' }}>
                          {[
                            { key: 'Charges', color: '#ef4444', val: d.charges },
                            { key: 'Cotis.',  color: '#f59e0b', val: d.cotis  },
                            { key: 'IR + IS', color: '#8B5CF6', val: d.ir     },
                            { key: 'Net',     color: '#10B981', val: d.net    },
                          ].map(({ key, color, val }) => (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10.5px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: '9.5px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }}></span>
                                {key}
                              </div>
                              <div style={{ ...mono, color: key === 'Net' ? '#6ee7b7' : '#f1f5f9', fontWeight: 700, fontSize: '12px' }}>{fmt(Math.round(val))}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Delta row */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '18px', paddingTop: '14px', borderTop: '1px dashed rgba(51,65,85,0.35)', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Δ Charges',     val: dA.charges - dB.charges, positiveIsBad: true  },
                      { label: 'Δ Cotisations', val: dA.cotis   - dB.cotis,   positiveIsBad: true  },
                      { label: 'Δ IR + IS',     val: dA.ir      - dB.ir,      positiveIsBad: true  },
                      { label: 'Δ Net final',   val: ecartAnnuel,              positiveIsBad: false },
                    ].map(({ label, val, positiveIsBad }) => {
                      const isUp  = positiveIsBad ? val <= 0 : val >= 0
                      const color = Math.abs(val) < 100 ? '#cbd5e1' : isUp ? '#6ee7b7' : '#f87171'
                      return (
                        <div key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(8,13,26,0.6)', border: '1px solid rgba(51,65,85,0.35)', fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
                          <span>{label}</span>
                          <span style={{ ...mono, fontWeight: 700, color }}>{val > 0 ? '+' : ''}{fmt(Math.round(val))}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>

              {/* ── TABLEAU COMPARATIF ────────────────────────────────────── */}
              <section>
                <EnrichedCompareTable simulations={selectedSims} />
              </section>

              {/* ── PROJECTION PLURIANNUELLE ──────────────────────────────── */}
              <section className="cmp-card">
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '2px', background: 'linear-gradient(90deg,transparent,#10B981,transparent)' }}></div>
                <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid rgba(51,65,85,0.35)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Projection pluriannuelle</h3>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Linéaire · hors revalorisation</span>
                </div>
                <div style={{ padding: '22px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', alignItems: 'stretch' }}>

                    {/* Bar chart */}
                    <div style={{ background: 'rgba(8,13,26,0.5)', border: '1px solid rgba(51,65,85,0.35)', borderRadius: '12px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Revenu net cumulé · 1 / 3 / 5 / 10 ans</span>
                        <div style={{ display: 'flex', gap: '14px', fontSize: '11px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3B82F6' }}></span>
                            <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{simA.name}</span>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#475569' }}></span>
                            <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{simB.name}</span>
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '22px', height: '200px', alignItems: 'flex-end', paddingTop: '24px', borderBottom: '1px solid rgba(51,65,85,0.35)', position: 'relative' }}>
                        {HORIZONS.map((h, i) => (
                          <div key={h.label} style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '100%' }}>
                            <div className="cmp-proj-bar" style={{ background: 'linear-gradient(180deg,#3B82F6,rgba(59,130,246,0.4))', height: `${PROJ_H_A[i]}%` }}>
                              <span style={{ ...mono, fontSize: '10px', fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
                                {Math.round(((simA.best_net_annuel ?? 0) * h.mult) / 1000)}k
                              </span>
                            </div>
                            <div className="cmp-proj-bar" style={{ background: 'linear-gradient(180deg,#475569,rgba(71,85,105,0.4))', height: `${projHB[i]}%` }}>
                              <span style={{ ...mono, fontSize: '10px', fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
                                {Math.round(((simB.best_net_annuel ?? 0) * h.mult) / 1000)}k
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '22px', paddingTop: '12px' }}>
                        {HORIZONS.map(h => (
                          <div key={h.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{h.label}</div>
                            <div style={{ ...mono, fontSize: '12px', color: '#6ee7b7', marginTop: '2px', fontWeight: 700 }}>
                              +{fmt(ecartAnnuel * h.mult)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Detail table */}
                    <div style={{ background: 'rgba(8,13,26,0.5)', border: '1px solid rgba(51,65,85,0.35)', borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column' }}>
                      {HORIZONS.map((h, i) => {
                        const a    = Math.round((simA.best_net_annuel ?? 0) * h.mult)
                        const b    = Math.round((simB.best_net_annuel ?? 0) * h.mult)
                        const diff = a - b
                        return (
                          <div key={h.label} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '9px', borderTop: i > 0 ? '1px solid rgba(51,65,85,0.35)' : 'none' }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: h.long ? '#fcd34d' : '#f1f5f9' }}>{h.label}</div>
                              <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', marginTop: '2px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h.tag}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ ...mono, fontSize: '13px', color: '#60a5fa', fontWeight: 700 }}>{fmt(a)}</span>
                              <span style={{ ...mono, fontSize: '11px', color: '#64748b' }}>vs {fmt(b)}</span>
                            </div>
                            <div style={{ ...mono, fontWeight: 800, fontSize: '16px', color: h.long ? '#fcd34d' : '#6ee7b7', padding: '6px 10px', borderRadius: '8px', background: h.long ? 'rgba(245,158,11,0.10)' : 'rgba(16,185,129,0.10)', border: `1px solid ${h.long ? 'rgba(245,158,11,0.32)' : 'rgba(16,185,129,0.28)'}`, minWidth: '100px', textAlign: 'right' }}>
                              +{fmt(diff)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── Simulations résumé heading (cabinet only) ─────────────────── */}
          {showComparison && sims.length > 0 && (
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700, color: '#60a5fa' }}>
                <span style={{ display: 'block', width: '18px', height: '1px', background: 'rgba(96,165,250,0.5)' }}></span>
                Résumé des simulations
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.015em', color: '#f1f5f9', margin: '8px 0 0' }}>
                Vos {sims.length} scénario{sims.length !== 1 ? 's' : ''} sauvegardé{sims.length !== 1 ? 's' : ''}
              </h2>
            </div>
          )}

          {/* ── SimulationsGrid — everyone ────────────────────────────────── */}
          {sims.length > 0 && (
            <SimulationsGrid
              initialSimulations={sims}
              onPersistDelete={!isLoggedIn ? deleteLocalSim : undefined}
            />
          )}

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {sims.length === 0 && (
            <div style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(51,65,85,0.55)', borderRadius: '20px', padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 12px' }}>
                Aucune simulation enregistrée
              </h2>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 auto 28px', maxWidth: '400px', lineHeight: 1.7 }}>
                Lancez une simulation et cliquez sur &quot;Enregistrer&quot; pour la retrouver ici, même sans compte.
              </p>
              <Link href="/simulateur" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#3B82F6,#2563eb)', color: '#fff', borderRadius: '12px', padding: '12px 28px', fontSize: '15px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}>
                ✦ Lancer une simulation
              </Link>
            </div>
          )}

        </div>
      </div>
      <Footer />
    </>
  )
}
