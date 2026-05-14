import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { fmt } from '@/lib/utils'
import { SimulationCards, type StoredResult } from '@/components/simulations/SimulationCards'

interface SimParams {
  ca?: number; charges?: number; amort?: number; situation?: string
  partsBase?: number; nbEnfants?: number; parts?: number; remNetAnn?: number
  perMontant?: number; secteur?: string; autresRev?: number; stratActif?: string
}
interface SimRow {
  id: string; name: string; created_at: string
  params: SimParams
  results?: { scored?: StoredResult[] }
  best_forme: string; best_net_annuel: number; tmi: number; ca: number; gain: number; situation: string
}

const situLabel: Record<string, string> = { creation: 'Création', existant: 'Existant', changement: 'Changement' }
const secteurLabel: Record<string, string> = {
  services_bic: 'Services BIC', liberal_bnc: 'BNC libéral', commerce: 'Commerce', btp: 'BTP/Artisanat',
}

function structureBadge(forme: string) {
  const f = (forme || '').toLowerCase()
  if (f.includes('micro')) return { bg: 'rgba(100,116,139,0.18)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' }
  if (f.includes('ei') && !f.includes('eurl')) return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' }
  if (f.includes('eurl') || f.includes('sarl')) return { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' }
  return { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: 'rgba(139,92,246,0.3)' }
}

function genExpertAnalysis(s: SimRow, best: StoredResult | undefined, scored: StoredResult[]) {
  if (!best) return null
  const f = best.forme
  const isSAS = f.includes('SAS')
  const isEURL = f.includes('EURL') || f.includes('SARL')
  const isMicro = f.includes('Micro')
  const second = scored.find(r => r.forme !== f)

  const constat = `Avec un CA de ${fmt(s.ca)}, votre structure optimale est ${f} avec ${fmt(best.netAnnuel)}/an net (${fmt(Math.round(best.netAnnuel / 12))}/mois).${s.gain > 500 ? ` Ce choix vous rapporte ${fmt(s.gain)}/an de plus que la structure la moins avantageuse.` : ''}`

  let pourquoi = ''
  if (isSAS) {
    pourquoi = `La SASU offre le meilleur ratio net/protection pour votre profil (TMI ${s.tmi}%). Le président perçoit un salaire assimilé salarié et peut se verser des dividendes sans cotisations sociales. C'est la seule structure combinant droits retraite/maladie du régime général et distribution optimisée.`
  } else if (isEURL) {
    pourquoi = `L'EURL à l'IS est avantageuse car votre bénéfice supporterait l'IS 15% plutôt que votre TMI IR de ${s.tmi}%. La rémunération TNS est déductible de l'IS, et la séparation patrimoine personnel/société limite votre exposition personnelle.`
  } else if (isMicro) {
    pourquoi = `Le régime micro est optimal car l'abattement forfaitaire (34% à 71% selon activité) est supérieur à vos charges réelles. Pas de comptabilité complexe, cotisations proportionnelles au CA — idéal à ce niveau de CA.`
  } else {
    pourquoi = `L'EI au réel permet de déduire toutes vos charges réelles. Les cotisations SSI sont calculées sur votre résultat net réel, ce qui les rend très compétitives à votre niveau de CA. Pas d'IS, pas de comptabilité société.`
  }

  let vigilance = ''
  if (isSAS) {
    vigilance = `En tant que président de SASU, vous n'êtes pas couvert par France Travail en cas de cessation d'activité. Un contrat GSC (assurance perte d'emploi) est fortement recommandé et déductible de l'IS. Optimisez le ratio salaire/dividendes selon votre TMI.`
  } else if (isEURL) {
    vigilance = `Les dividendes EURL dépassant 10% du capital social supportent les cotisations TNS (~45%). Veillez à dimensionner votre capital ou à limiter les distributions pour préserver l'optimisation. Une prévoyance Madelin complémentaire est déductible.`
  } else if (isMicro) {
    vigilance = `Le régime micro ne permet pas de déduire vos charges réelles. Si vos charges dépassent l'abattement forfaitaire, le réel devient plus favorable. Surveillez également le plafond de CA (77 700 € services, 188 700 € commerce).`
  } else {
    vigilance = `En EI, votre patrimoine personnel est engagé (pensez à la déclaration d'insaisissabilité de votre résidence principale). Si votre résultat dépasse 60 000 €/an, le passage en EURL/SASU à l'IS devient généralement plus avantageux.`
  }

  const perMax = Math.min(35194, Math.round(s.ca * 0.10 * 0.7))
  const optimisation = `Levier PER : à TMI ${s.tmi}%, verser ${fmt(perMax)}/an au PER réduit votre IR de ${s.tmi} centimes par euro versé. ${second ? `Structure alternative : ${second.forme} donnerait ${fmt(second.netAnnuel)}/an (${fmt(Math.round(second.netAnnuel / 12))}/mois), soit ${fmt(Math.round(best.netAnnuel - second.netAnnuel))} de moins par an.` : ''}`

  return { constat, pourquoi, vigilance, optimisation }
}

export default async function SimulationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: sim } = await supabase
    .from('simulations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!sim) notFound()
  const s = sim as SimRow
  const scored: StoredResult[] = s.results?.scored || []
  const best = scored[0]
  const p: SimParams = s.params || {}

  const netAnnuel = best?.netAnnuel ?? s.best_net_annuel
  const date = new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const bestBadge = structureBadge(s.best_forme)

  const paramPills = [
    { label: 'CA', val: fmt(s.ca) },
    { label: 'Charges', val: fmt(p.charges || 0) },
    ...(p.amort ? [{ label: 'Amortissements', val: fmt(p.amort) }] : []),
    { label: 'Situation', val: situLabel[p.situation || s.situation] || s.situation },
    { label: 'Foyer', val: `${p.partsBase === 2 ? 'En couple' : 'Célibataire'}${(p.nbEnfants || 0) > 0 ? ` · ${p.nbEnfants} enfant${(p.nbEnfants || 0) > 1 ? 's' : ''}` : ''}` },
    { label: 'Parts', val: `${p.parts ?? p.partsBase ?? 1}` },
    ...(p.remNetAnn ? [{ label: 'Rém. souhaitée', val: fmt(p.remNetAnn) }] : []),
    ...(p.perMontant ? [{ label: 'PER', val: fmt(p.perMontant) }] : []),
    ...(p.secteur ? [{ label: 'Secteur', val: secteurLabel[p.secteur] || p.secteur }] : []),
    ...(p.autresRev ? [{ label: 'Autres revenus', val: fmt(p.autresRev) }] : []),
  ]

  return (
    <>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#080d1a' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px 80px' }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569', marginBottom: '28px' }}>
            <Link href="/simulations" style={{ color: '#60a5fa', textDecoration: 'none' }}>Mes simulations</Link>
            <span style={{ color: '#334155' }}>/</span>
            <span style={{ color: '#64748b' }}>{s.name}</span>
          </div>

          {/* ── HERO — dense 2-column layout ───────────────────── */}
          <div style={{
            background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 60%, #0f1535 100%)',
            borderRadius: '16px', padding: '24px',
            marginBottom: '20px', position: 'relative', overflow: 'hidden',
            border: `1px solid ${bestBadge.color}33`,
          }}>
            {/* Glow */}
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: '256px', height: '256px', borderRadius: '50%',
              background: `radial-gradient(circle, ${bestBadge.color} 0%, transparent 70%)`,
              transform: 'translate(30%, -30%)', opacity: 0.08, pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: '999px', background: `${bestBadge.color}26`, border: `1px solid ${bestBadge.color}55`, color: bestBadge.color }}>
                    ★ Structure recommandée
                  </span>
                  <span style={{ fontSize: '11px', color: '#475569' }}>{date}</span>
                </div>
                {s.gain > 500 && (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '999px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7', fontVariantNumeric: 'tabular-nums' }}>
                    +{fmt(s.gain)}/an vs moins favorable
                  </span>
                )}
              </div>

              {/* 2-column grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '32px' }}>

                {/* Gauche — structure + montant + actions */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: bestBadge.color, flexShrink: 0 }} />
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '20px', letterSpacing: '-0.01em' }}>{s.best_forme}</span>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 16px 18px' }}>{s.name}</p>

                  <div style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#6ee7b7' }}>
                    {fmt(netAnnuel)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', marginBottom: '20px' }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{fmt(Math.round(netAnnuel / 12))}</span>
                    {' '}net/mois · après IR, cotisations &amp; IS
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <a href={`/api/simulations/${s.id}/pdf`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '9px 18px', borderRadius: '10px', textDecoration: 'none',
                      background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff',
                      fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                    }}>
                      📄 Rapport PDF
                    </a>
                    <Link href="/simulateur" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '9px 16px', borderRadius: '10px', textDecoration: 'none',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                      color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 600,
                    }}>
                      ← Modifier
                    </Link>
                  </div>
                </div>

                {/* Droite — tableau chiffres clés */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>CA simulé</span>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.ca)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Tranche marginale d&apos;imposition</span>
                      <span style={{ color: '#93c5fd', fontWeight: 600, fontSize: '13px' }}>TMI {s.tmi}%</span>
                    </div>
                    {best && best.charges != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ color: '#64748b', fontSize: '13px' }}>Cotisations sociales</span>
                        <span style={{ color: '#f87171', fontWeight: 600, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>−{fmt(best.charges)}</span>
                      </div>
                    )}
                    {best && best.ir != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ color: '#64748b', fontSize: '13px' }}>Impôt sur le revenu</span>
                        <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>−{fmt(best.ir)}</span>
                      </div>
                    )}
                    {best && best.is > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ color: '#64748b', fontSize: '13px' }}>IS société</span>
                        <span style={{ color: '#a78bfa', fontWeight: 600, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>−{fmt(best.is)}</span>
                      </div>
                    )}
                  </div>
                  {s.gain > 500 && (
                    <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>Gain vs pire structure</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#6ee7b7', fontWeight: 700, fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>+{fmt(s.gain)}/an</div>
                        <div style={{ color: '#475569', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>+{fmt(Math.round(s.gain / 12))}/mois</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Paramètres ───────────────────────────────────────── */}
          <div style={{
            background: '#0d1628', border: '1px solid rgba(51,65,85,0.45)',
            borderRadius: '16px', padding: '20px', marginBottom: '20px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '14px' }}>
              Paramètres de simulation
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {paramPills.map(pill => (
                <div key={pill.label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(15,23,42,0.8)', borderRadius: '8px', padding: '6px 12px',
                  border: '1px solid rgba(51,65,85,0.45)',
                }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>{pill.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>{pill.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Comparaison des 4 structures ─────────────────────── */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#60a5fa' }}>
                <span style={{ display: 'block', width: '16px', height: '1px', background: 'rgba(96,165,250,0.5)' }} />
                Comparaison des structures
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.015em', color: '#f1f5f9', margin: '8px 0 0' }}>
                Résultats détaillés
              </h2>
            </div>

            {scored.length > 0 ? (
              <SimulationCards
                scored={scored}
                params={p}
                ca={s.ca}
                gain={s.gain}
              />
            ) : (
              <div style={{
                background: '#0d1628', border: '1px solid rgba(51,65,85,0.45)',
                borderRadius: '16px', padding: '48px 24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📊</div>
                <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px' }}>
                  Données détaillées non disponibles pour cette simulation — relancez une simulation pour obtenir les résultats complets.
                </p>
                <Link href="/simulateur" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '10px 20px', borderRadius: '10px', textDecoration: 'none',
                  background: 'linear-gradient(135deg,#3B82F6,#2563eb)', color: '#fff',
                  fontSize: '13px', fontWeight: 700,
                }}>
                  Lancer une simulation
                </Link>
              </div>
            )}
          </div>

          {/* ── Analyse experte ──────────────────────────────────── */}
          {(() => {
            const analysis = genExpertAnalysis(s, best, scored)
            if (!analysis) return null
            return (
              <div style={{
                background: '#0d1628', border: '1px solid rgba(51,65,85,0.45)',
                borderRadius: '16px', padding: '24px', marginBottom: '20px',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '18px' }}>
                  ✦ Analyse experte
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {[
                    { label: 'Constat', icon: '📊', color: '#60a5fa', bg: 'rgba(37,99,235,0.07)', border: 'rgba(37,99,235,0.18)', text: analysis.constat },
                    { label: 'Pourquoi ce choix', icon: '💡', color: '#4ade80', bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.18)', text: analysis.pourquoi },
                    { label: 'Point de vigilance', icon: '⚠️', color: '#fbbf24', bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.18)', text: analysis.vigilance },
                    { label: "Levier d'optimisation", icon: '🚀', color: '#a78bfa', bg: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.18)', text: analysis.optimisation },
                  ].map(card => (
                    <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: '12px', padding: '14px 16px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: card.color, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '8px' }}>
                        {card.icon} {card.label}
                      </div>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, margin: 0 }}>
                        {card.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* ── Navigation ───────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <Link href="/simulations/comparer" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px', borderRadius: '10px', textDecoration: 'none',
              background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)',
              color: '#a78bfa', fontSize: '13px', fontWeight: 600,
            }}>
              ⇄ Comparer des scénarios
            </Link>
            <Link href="/simulations" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px', borderRadius: '10px', textDecoration: 'none',
              background: 'rgba(51,65,85,0.25)', border: '1px solid rgba(51,65,85,0.45)',
              color: '#64748b', fontSize: '13px', fontWeight: 600,
            }}>
              ← Mes simulations
            </Link>
          </div>

          {/* ── CTA Cabinet ──────────────────────────────────────── */}
          <div style={{
            background: 'linear-gradient(135deg, #050c1a 0%, #071428 50%, #0a1628 100%)',
            borderRadius: '20px', padding: '32px',
            border: '1px solid rgba(96,165,250,0.15)',
            boxShadow: '0 0 60px rgba(37,99,235,0.1)',
            display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', right: '-4rem', top: '-4rem',
              width: '320px', height: '320px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(37,99,235,0.2) 0%, transparent 65%)',
              pointerEvents: 'none',
            }} />
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                Cabinet Belho Xper · Lyon &amp; Montluel
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 10px' }}>
                Vous voulez aller plus loin ?
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: '0 0 20px', maxWidth: '360px' }}>
                Ces résultats sont des estimations barème 2025. Nos experts affinent votre stratégie et vous accompagnent dans la mise en œuvre concrète — de la création à l&apos;optimisation continue.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                  style={{
                    padding: '11px 24px', borderRadius: '12px', textDecoration: 'none',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: '#fff', fontSize: '14px', fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(29,78,216,0.4)',
                  }}>
                  Prendre RDV gratuitement →
                </a>
                <a href={`/api/simulations/${s.id}/pdf`}
                  style={{
                    padding: '11px 20px', borderRadius: '12px', textDecoration: 'none',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.65)', fontSize: '14px', fontWeight: 600,
                  }}>
                  📄 Rapport PDF
                </a>
              </div>
            </div>
            {best && (
              <div style={{
                flexShrink: 0, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '16px', padding: '20px 24px', textAlign: 'center', minWidth: '180px',
                position: 'relative',
              }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                  Meilleur résultat
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.50)', marginBottom: '4px' }}>
                  {best.forme}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#6ee7b7', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '4px', fontFamily: 'ui-monospace,monospace' }}>
                  {fmt(best.netAnnuel)}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '12px' }}>
                  {fmt(Math.round(best.netAnnuel / 12))}/mois
                </div>
                {s.gain > 500 && (
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '6px 10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#6ee7b7' }}>+{fmt(s.gain)}/an</div>
                    <div style={{ fontSize: '10px', color: 'rgba(16,185,129,0.55)', marginTop: '1px' }}>vs moins favorable</div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
      <Footer />
    </>
  )
}
