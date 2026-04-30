import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { fmt } from '@/lib/utils'

interface SimResult { forme: string; netAnnuel: number; ir: number; charges: number; is: number; scoreTotal: number }
interface SimParams {
  ca: number; charges: number; amort: number; situation: string
  partsBase: number; nbEnfants: number; parts: number; remNetAnn: number
  perMontant: number; secteur: string; autresRev: number
}
interface SimRow {
  id: string; name: string; created_at: string
  params: SimParams
  results: { scored: SimResult[] }
  best_forme: string; best_net_annuel: number; tmi: number; ca: number; gain: number; situation: string
}

const situLabel: Record<string, string> = { creation: 'Création', existant: 'Existant', changement: 'Changement' }
const secteurLabel: Record<string, string> = {
  services_bic: 'Services BIC', liberal_bnc: 'BNC libéral', commerce: 'Commerce', btp: 'BTP/Artisanat',
}
const remDesc: Record<string, string> = {
  'SAS / SASU': 'Salaire assimilé salarié + dividendes sans cotisations sociales',
  'EURL / SARL (IS)': 'Rémunération TNS déductible de l\'IS + dividendes (IS 15%/25%)',
  'EI (réel normal)': 'Bénéfice imposable à l\'IR — cotisations SSI sur résultat net',
  'Micro-entreprise': 'Abattement forfaitaire sur CA — pas de déduction des charges réelles',
}

function structureBadge(forme: string) {
  const f = (forme || '').toLowerCase()
  if (f.includes('micro')) return { bg: 'rgba(100,116,139,0.18)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' }
  if (f.includes('ei') && !f.includes('eurl')) return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' }
  if (f.includes('eurl') || f.includes('sarl')) return { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' }
  return { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: 'rgba(139,92,246,0.3)' }
}

function genExpertAnalysis(s: SimRow, best: SimResult | undefined, scored: SimResult[]) {
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
  const scored: SimResult[] = s.results?.scored || []
  const best = scored[0]
  const p = s.params || {} as SimParams

  const date = new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const bestBadge = structureBadge(s.best_forme)

  const paramPills = [
    { label: 'CA', val: fmt(s.ca) },
    { label: 'Charges', val: fmt(p.charges || 0) },
    ...(p.amort ? [{ label: 'Amortissements', val: fmt(p.amort) }] : []),
    { label: 'Situation', val: situLabel[p.situation || s.situation] || s.situation },
    { label: 'Foyer', val: `${p.partsBase === 2 ? 'En couple' : 'Célibataire'}${p.nbEnfants > 0 ? ` · ${p.nbEnfants} enfant${p.nbEnfants > 1 ? 's' : ''}` : ''}` },
    { label: 'Parts', val: `${p.parts ?? p.partsBase ?? 1}` },
    ...(p.remNetAnn ? [{ label: 'Rém. souhaitée', val: fmt(p.remNetAnn) }] : []),
    ...(p.perMontant ? [{ label: 'PER', val: fmt(p.perMontant) }] : []),
    ...(p.secteur ? [{ label: 'Secteur', val: secteurLabel[p.secteur] || p.secteur }] : []),
    ...(p.autresRev ? [{ label: 'Autres revenus', val: fmt(p.autresRev) }] : []),
  ]

  return (
    <>
      <style>{`
        .sim-tr:hover { background: rgba(51,65,85,0.25) !important; }
      `}</style>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#020617' }}>
        <div style={{ maxWidth: '920px', margin: '0 auto', padding: '40px 24px' }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', marginBottom: '24px' }}>
            <Link href="/simulations" style={{ color: '#60a5fa', textDecoration: 'none' }}>Mes simulations</Link>
            <span>/</span>
            <span style={{ color: '#94a3b8' }}>{s.name}</span>
          </div>

          {/* HERO */}
          <div style={{
            background: 'linear-gradient(135deg, #0d1627 0%, #0d1f3c 100%)',
            borderRadius: '20px', padding: '32px',
            marginBottom: '20px', position: 'relative', overflow: 'hidden',
            border: '1px solid rgba(37,99,235,0.15)',
          }}>
            <div style={{
              position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(37,99,235,.2) 0%,transparent 65%)',
              top: '-9rem', right: '-4rem', pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#60a5fa', marginBottom: '8px' }}>
                Simulation · {date}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginBottom: '8px' }}>{s.name}</div>
              {best && (
                <>
                  <div style={{ fontSize: '52px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '6px' }}>
                    <span style={{ background: 'linear-gradient(90deg, #60a5fa, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {fmt(best.netAnnuel)}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)', marginBottom: '20px' }}>
                    {fmt(Math.round(best.netAnnuel / 12))}/mois · {best.forme}
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '999px', background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', color: '#93c5fd' }}>
                  TMI {s.tmi}%
                </span>
                <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                  CA {fmt(s.ca)}
                </span>
                <span style={{
                  fontSize: '11px', padding: '4px 12px', borderRadius: '999px',
                  background: bestBadge.bg, border: `1px solid ${bestBadge.border}`, color: bestBadge.color,
                }}>
                  {s.best_forme}
                </span>
                {s.gain > 500 && (
                  <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '999px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
                    +{fmt(s.gain)}/an vs moins favorable
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Paramètres de simulation */}
          <div style={{
            background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
            borderRadius: '16px', padding: '20px', marginBottom: '20px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
              Paramètres de simulation
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {paramPills.map(pill => (
                <div key={pill.label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: '#1e293b', borderRadius: '8px', padding: '6px 12px',
                  border: '1px solid rgba(51,65,85,0.5)',
                }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>{pill.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>{pill.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tableau comparaison */}
          {scored.length > 0 && (
            <div style={{
              background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
              borderRadius: '16px', overflow: 'hidden', marginBottom: '20px',
            }}>
              <div style={{ background: 'rgba(30,41,59,0.8)', padding: '14px 20px', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Comparaison des structures
                </h2>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(30,41,59,0.5)' }}>
                      {['Structure', 'Net/an', 'Net/mois', 'Cotisations', 'IR', 'IS', 'Score'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                          textTransform: 'uppercase', color: '#475569', padding: '10px 14px',
                          whiteSpace: 'nowrap', borderBottom: '1px solid rgba(51,65,85,0.5)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scored.map((r, i) => {
                      const rb = structureBadge(r.forme)
                      return (
                        <tr key={r.forme} className="sim-tr" style={{
                          background: i === 0 ? 'rgba(37,99,235,0.05)' : 'transparent',
                          borderBottom: '1px solid rgba(51,65,85,0.3)',
                          borderLeft: i === 0 ? '3px solid #2563eb' : '3px solid transparent',
                          transition: 'background 150ms',
                        }}>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: rb.color }}>{r.forme}</span>
                              {i === 0 && (
                                <span style={{ fontSize: '9px', fontWeight: 700, background: '#2563eb', color: '#fff', padding: '2px 7px', borderRadius: '999px' }}>
                                  ⭐ Meilleur
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.4, maxWidth: '200px' }}>
                              {remDesc[r.forme] || ''}
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 700, color: '#4ade80', whiteSpace: 'nowrap' }}>{fmt(r.netAnnuel)}</td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmt(Math.round(r.netAnnuel / 12))}/mois</td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: '#f87171', whiteSpace: 'nowrap' }}>−{fmt(r.charges)}</td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: '#f87171', whiteSpace: 'nowrap' }}>−{fmt(r.ir)}</td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: r.is > 0 ? '#818cf8' : '#334155', whiteSpace: 'nowrap' }}>
                            {r.is > 0 ? `−${fmt(r.is)}` : '—'}
                          </td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: i === 0 ? '#60a5fa' : '#475569' }}>
                              {r.scoreTotal}/100
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analyse — mode de rémunération par structure */}
          {scored.length > 0 && (
            <div style={{
              background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
              borderRadius: '16px', padding: '20px', marginBottom: '20px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
                Analyse — mode de rémunération
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {scored.map((r, i) => {
                  const rb = structureBadge(r.forme)
                  const desc = remDesc[r.forme] || ''
                  return (
                    <div key={r.forme} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '12px 14px', borderRadius: '10px',
                      background: i === 0 ? 'rgba(37,99,235,0.07)' : 'rgba(30,41,59,0.4)',
                      border: `1px solid ${i === 0 ? 'rgba(37,99,235,0.2)' : 'rgba(51,65,85,0.3)'}`,
                    }}>
                      <div style={{ flexShrink: 0, marginTop: '1px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                          background: rb.bg, color: rb.color, border: `1px solid ${rb.border}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {r.forme}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>{desc}</div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                          Net {fmt(r.netAnnuel)}/an · Score {r.scoreTotal}/100
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Analyse experte */}
          {(() => {
            const analysis = genExpertAnalysis(s, best, scored)
            if (!analysis) return null
            return (
              <div style={{
                background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
                borderRadius: '16px', padding: '24px', marginBottom: '20px',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '18px' }}>
                  ✦ Analyse experte
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  {[
                    { label: 'Constat', icon: '📊', color: '#60a5fa', bg: 'rgba(37,99,235,0.07)', border: 'rgba(37,99,235,0.18)', text: analysis.constat },
                    { label: 'Pourquoi ce choix', icon: '💡', color: '#4ade80', bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.18)', text: analysis.pourquoi },
                    { label: 'Point de vigilance', icon: '⚠️', color: '#fbbf24', bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.18)', text: analysis.vigilance },
                    { label: 'Levier d\'optimisation', icon: '🚀', color: '#a78bfa', bg: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.18)', text: analysis.optimisation },
                  ].map(card => (
                    <div key={card.label} style={{
                      background: card.bg, border: `1px solid ${card.border}`,
                      borderRadius: '12px', padding: '14px 16px',
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: card.color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                        {card.icon} {card.label}
                      </div>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.6, margin: 0 }}>
                        {card.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <a
              href={`/api/simulations/${s.id}/pdf`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px', borderRadius: '10px', textDecoration: 'none',
                background: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: 600,
              }}
            >
              📄 Télécharger le rapport PDF
            </a>
            <Link href="/simulateur" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px', borderRadius: '10px', textDecoration: 'none',
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
              color: '#34d399', fontSize: '14px', fontWeight: 600,
            }}>
              + Nouvelle simulation
            </Link>
            <Link href="/simulations" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px', borderRadius: '10px', textDecoration: 'none',
              background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.5)',
              color: '#94a3b8', fontSize: '14px', fontWeight: 600,
            }}>
              ← Retour
            </Link>
          </div>

          {/* CTA Cabinet — 2 colonnes */}
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
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#60a5fa', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '4px' }}>
                  {fmt(best.netAnnuel)}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '12px' }}>
                  {fmt(Math.round(best.netAnnuel / 12))}/mois
                </div>
                {s.gain > 500 && (
                  <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '8px', padding: '6px 10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#34d399' }}>+{fmt(s.gain)}/an</div>
                    <div style={{ fontSize: '10px', color: 'rgba(52,211,153,0.55)', marginTop: '1px' }}>vs moins favorable</div>
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
