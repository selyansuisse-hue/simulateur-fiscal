export const dynamic = 'force-static'

import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'

const TESTIMONIALS = [
  {
    texte: "J'ai économisé 8 000 €/an en passant de l'EI à la SASU. Le simulateur m'a convaincu en 10 minutes.",
    nom: 'Thomas D.',
    role: 'Consultant freelance, Lyon',
    initiales: 'TD',
  },
  {
    texte: 'Enfin un simulateur qui calcule les cotisations SSI par composante et pas avec un taux forfaitaire approximatif.',
    nom: 'Marie L.',
    role: 'Architecte libérale',
    initiales: 'ML',
  },
  {
    texte: "La comparaison score multicritère m'a fait réaliser que la SASU n'était pas forcément meilleure pour ma situation.",
    nom: 'Antoine R.',
    role: 'Développeur indépendant',
    initiales: 'AR',
  },
]

export default function LandingPage() {
  return (
    <>
      <PageHeader />

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden"
        style={{ backgroundColor: '#050c1a', minHeight: '100vh', display: 'flex', alignItems: 'center' }}
      >
        {/* Fonds */}
        <div style={{
          position: 'absolute', width: '800px', height: '800px', borderRadius: '50%',
          top: '-15rem', right: '-5rem', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(37,99,235,.40) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
          bottom: '-8rem', left: '-3rem', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(139,92,246,.20) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        }} />

        <div className="max-w-6xl mx-auto px-6 py-24 w-full relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* COLONNE GAUCHE */}
            <div>
              {/* Badge social proof */}
              <div className="inline-flex items-center gap-3 mb-8 px-4 py-2.5 rounded-full border"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)' }}>
                <div className="flex -space-x-1.5">
                  {(['T', 'M', 'A'] as const).map((l, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border-2 border-[#050c1a] flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ background: ['#3B82F6', '#8B5CF6', '#10B981'][i] }}>
                      {l}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-white/60">+1 200 dirigeants ont optimisé leur structure</span>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">GRATUIT</span>
              </div>

              {/* Titre */}
              <h1 className="font-display font-black tracking-tight leading-[1.02] mb-6"
                style={{ fontSize: 'clamp(2.8rem, 5.5vw, 4.2rem)', color: '#fff' }}>
                Quelle structure
                <br />
                <span style={{
                  backgroundImage: 'linear-gradient(135deg, #60A5FA, #3B82F6, #A78BFA)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  vous fait vraiment
                </span>
                <br />
                économiser ?
              </h1>

              <p className="text-lg mb-10" style={{ color: 'rgba(255,255,255,0.65)' }}>
                4 étapes. Résultat immédiat. Barème 2025.
              </p>

              {/* Stat cards */}
              <div className="flex flex-wrap gap-3 mb-10">
                {[
                  { val: '4', label: 'Structures', sub: 'comparées' },
                  { val: '2025', label: 'Barème IR & IS', sub: 'à jour' },
                  { val: '100%', label: 'Taux réels', sub: 'SSI composante' },
                  { val: 'Gratuit', label: 'Sans CB', sub: 'sans engagement' },
                ].map(s => (
                  <div key={s.val} className="flex flex-col px-4 py-3 rounded-xl border"
                    style={{ borderColor: 'rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)' }}>
                    <span className="font-display text-2xl font-bold text-white leading-none mb-0.5">{s.val}</span>
                    <span className="text-[11px] font-semibold text-white/60">{s.label}</span>
                    <span className="text-[10px] text-white/30">{s.sub}</span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 mb-6">
                <Link href="/simulateur"
                  className="inline-flex items-center gap-2 font-bold text-[15px] text-white rounded-xl px-8 py-4 transition-all duration-150 hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 8px 32px rgba(29,78,216,0.55)' }}>
                  ✦ Lancer la simulation gratuite
                </Link>
                <Link href="/auth/signup"
                  className="inline-flex items-center gap-2 font-semibold text-[15px] text-white rounded-xl px-7 py-4 transition-all hover:-translate-y-0.5"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)' }}>
                  Créer un compte →
                </Link>
              </div>

              {/* Pills techniques */}
              <div className="flex flex-wrap gap-2">
                {['Barème IR 2025 · QF 1 807 €', 'IS 15% / 25%', 'Cotisations SSI par composante', 'PER · Madelin intégrés'].map(p => (
                  <span key={p} className="text-[11px] px-3 py-1.5 rounded-full font-medium"
                    style={{ color: 'rgba(255,255,255,0.50)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* COLONNE DROITE — Mini dashboard */}
            <div className="hidden lg:block relative">
              <div style={{
                position: 'absolute', inset: '-40px', zIndex: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at center, rgba(37,99,235,.25) 0%, transparent 70%)',
              }} />

              <div className="relative" style={{ zIndex: 1 }}>

                {/* Card principale */}
                <div className="rounded-2xl p-5 mb-3" style={{
                  background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(59,130,246,0.35)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 0 0 1px rgba(59,130,246,0.15), 0 20px 40px rgba(0,0,0,0.3)',
                }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">★ Structure recommandée</span>
                    </div>
                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-medium">Score 78/100</span>
                  </div>
                  <div className="text-white/60 text-sm mb-1">SAS / SASU</div>
                  <div className="text-4xl font-black text-white tracking-tight mb-1">183 899 €</div>
                  <div className="text-white/40 text-sm mb-4">15 325 €/mois · net après IR &amp; cotisations</div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <span className="text-emerald-400 font-bold text-sm">+23 191 €/an</span>
                    <span className="text-emerald-400/60 text-xs">vs moins avantageuse</span>
                  </div>
                </div>

                {/* 3 mini-cards */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { nom: 'SAS / SASU', net: '183 899', tmi: '11%', tmiColor: '#34D399', rec: true },
                    { nom: 'EURL IS', net: '179 942', tmi: '41%', tmiColor: '#FBBF24', rec: false },
                    { nom: 'EI réel', net: '160 708', tmi: '41%', tmiColor: '#FBBF24', rec: false },
                  ].map(s => (
                    <div key={s.nom} className="rounded-xl p-3" style={{
                      background: s.rec ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
                      border: s.rec ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div className="text-[10px] font-medium text-white/40 mb-1 truncate">{s.nom}</div>
                      <div className={`text-sm font-bold mb-1 ${s.rec ? 'text-blue-300' : 'text-white/70'}`}>{s.net} €</div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.tmiColor }} />
                        <span className="text-[10px] font-bold" style={{ color: s.tmiColor }}>TMI {s.tmi}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Décomposition CA */}
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Décomposition CA 500 000 €</div>
                  {[
                    { label: 'Revenu net', pct: 37, val: '183 899 €', color: '#34D399' },
                    { label: 'Cotisations', pct: 6, val: '29 676 €', color: '#F87171' },
                    { label: 'IR + IS', pct: 27, val: '135 499 €', color: '#60A5FA' },
                    { label: 'Charges', pct: 30, val: '150 926 €', color: 'rgba(255,255,255,0.2)' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-2 mb-2 last:mb-0">
                      <div className="w-16 text-[10px] text-white/40 flex-shrink-0">{row.label}</div>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
                      </div>
                      <div className="w-20 text-[10px] font-bold text-right" style={{ color: row.color }}>{row.val}</div>
                    </div>
                  ))}
                </div>

                {/* Badge optimisation */}
                <div className="mt-3 rounded-xl p-3 flex items-center justify-between"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div className="text-xs text-emerald-400/70">Potentiel d&apos;optimisation supplémentaire</div>
                  <div className="text-sm font-black text-emerald-400">+6 340 €/an</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── APERÇU DU PRODUIT ── */}
      <section style={{ background: 'linear-gradient(180deg, #F8FAFF 0%, #EEF2FF 100%)', padding: '80px 0' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-widest mb-4 border border-blue-100">
              Aperçu du résultat
            </div>
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">
              En 4 minutes, vous savez exactement<br />
              <span className="text-blue-600">combien vous économisez</span>
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Chiffres réels, calculs certifiés barème 2025. Pas d&apos;estimation au doigt mouillé.
            </p>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #BFDBFE, transparent)' }} />
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest px-2">Simulation en direct</div>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #BFDBFE, transparent)' }} />
          </div>

          {/* Mockup */}
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-3xl blur-3xl -z-10" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(139,92,246,0.10))' }} />
            <div className="rounded-3xl p-8" style={{
              background: 'linear-gradient(135deg, #0f172a, #0d1f3c)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.25)',
            }}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="flex-1 rounded-full h-6 flex items-center px-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-white/30 text-xs">simulateur-fiscal-bkxh.vercel.app/simulateur</span>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Structure recommandée
                  </div>
                  <div className="text-white/60 text-sm mb-1">EURL / SARL IS</div>
                  <div className="text-5xl font-bold text-white tracking-tight mb-1">54 200 €</div>
                  <div className="text-white/40 text-sm mb-5">4 517 €/mois · net après IR, cotisations et IS</div>
                  <div className="inline-flex items-center gap-2 rounded-xl mb-4 px-4 py-2" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <span className="text-emerald-400 font-bold text-sm">+12 800 €/an vs la moins avantageuse</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-white/50 text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>TMI 30%</span>
                    <span className="text-white/50 text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>Score 78/100</span>
                  </div>
                </div>
                <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="text-xs text-white/40 uppercase tracking-wide mb-4">Comparaison des 4 structures</div>
                  {[
                    { nom: 'EURL / SARL IS', net: '54 200 €', badge: '★ Rec.', best: true },
                    { nom: 'SAS / SASU', net: '51 800 €', badge: '2ème', best: false },
                    { nom: 'EI (réel normal)', net: '43 100 €', badge: '3ème', best: false },
                    { nom: 'Micro-entreprise', net: '34 600 €', badge: '4ème', best: false },
                  ].map(s => (
                    <div key={s.nom} className={`flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 ${s.best ? '' : 'opacity-50'}`}>
                      <div className="flex items-center gap-2">
                        {s.best && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                        <span className={`text-sm ${s.best ? 'font-bold text-white' : 'text-white/50'}`}>{s.nom}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${s.best ? 'text-blue-400' : 'text-white/40'}`}>{s.net}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.best ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/30'}`}>{s.badge}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3 mini-aperçus */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Décomposition de votre CA</div>
              {[
                { label: 'Revenu net', pct: 54, color: 'bg-emerald-500', val: '54 200 €' },
                { label: 'Charges sociales', pct: 27, color: 'bg-red-400', val: '27 300 €' },
                { label: 'IR + IS', pct: 11, color: 'bg-blue-400', val: '11 200 €' },
                { label: 'Charges exploit.', pct: 8, color: 'bg-slate-300', val: '8 000 €' },
              ].map(row => (
                <div key={row.label} className="mb-2.5">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${row.color}`} />
                      {row.label}
                    </span>
                    <span className="font-bold text-slate-700">{row.val}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full">
                    <div className={`h-1.5 rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Votre situation fiscale</div>
              <div className="space-y-1.5">
                {[
                  { t: '0%', range: '≤ 11 497 €', active: false },
                  { t: '11%', range: '11 498 → 29 315 €', active: false },
                  { t: '30%', range: '29 316 → 83 823 €', active: true },
                  { t: '41%', range: '83 824 → 180 294 €', active: false },
                  { t: '45%', range: '> 180 294 €', active: false },
                ].map(row => (
                  <div key={row.t} className={`flex justify-between text-xs px-3 py-1.5 rounded-lg font-medium
                    ${row.active ? 'bg-blue-600 text-white' : 'text-slate-400 bg-white border border-slate-100'}`}>
                    <span>{row.range}</span>
                    <span>{row.t}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-slate-500 bg-blue-50 rounded-lg p-2 text-center">
                Votre TMI : <strong className="text-blue-600">30%</strong> · Taux effectif : <strong className="text-blue-600">14,2%</strong>
              </div>
            </div>
            <div className="bg-emerald-900 rounded-2xl p-5">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-3">Scénario optimisé</div>
              <div className="text-2xl font-bold text-white mb-1">+6 340 €/an</div>
              <div className="text-xs mb-4" style={{ color: 'rgba(52,211,153,0.6)' }}>supplémentaires avec les leviers</div>
              {[
                { ico: '📊', label: 'PER individuel', val: '+2 400 €' },
                { ico: '🚗', label: 'IK 8 000 km', val: '+764 €' },
                { ico: '🏠', label: 'Domiciliation', val: '+360 €' },
                { ico: '🛡', label: 'Prévoyance TNS', val: '+2 816 €' },
              ].map(lev => (
                <div key={lev.label} className="flex justify-between items-center py-1.5 border-b border-white/10 last:border-0 text-xs">
                  <span className="text-white/60">{lev.ico} {lev.label}</span>
                  <span className="font-bold text-emerald-400">{lev.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PREUVE SOCIALE / CHIFFRES ── */}
      <section style={{ backgroundColor: '#050c1a', padding: '64px 0' }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-white/40 text-sm uppercase tracking-widest mb-10">
            Des résultats concrets pour des dirigeants comme vous
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { val: '8 400 €', label: 'Économie moyenne/an', sub: 'vs structure non optimisée', color: '#34D399' },
              { val: '4 min', label: 'Pour obtenir vos résultats', sub: 'sans inscription requise', color: '#60A5FA' },
              { val: '4', label: 'Structures comparées', sub: 'Micro · EI · EURL · SASU', color: '#A78BFA' },
              { val: '100%', label: 'Calculs vérifiés', sub: 'Barème 2025 certifié', color: '#FBBF24' },
            ].map(stat => (
              <div key={stat.val} className="text-center">
                <div className="font-display text-5xl font-black mb-2" style={{ color: stat.color }}>{stat.val}</div>
                <div className="text-sm font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{stat.label}</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ── */}
      <section style={{ backgroundColor: '#FAFBFF', padding: '80px 0' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">4 étapes. C&apos;est tout.</h2>
            <p className="text-slate-500">En moins de 4 minutes, vous avez vos résultats complets.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { num: '01', titre: 'Votre situation', desc: 'Secteur, type de projet (création ou optimisation), priorité revenu ou protection.', icone: '📋' },
              { num: '02', titre: 'Vos chiffres', desc: 'CA, charges, amortissements, capital social. Vos vrais chiffres, pas des estimations.', icone: '📊' },
              { num: '03', titre: 'Votre foyer', desc: 'Situation familiale, enfants, parts fiscales. Le simulateur calcule votre quotient familial exact.', icone: '👨‍👩‍👧' },
              { num: '04', titre: 'Votre résultat', desc: "Recommandation précise, décomposition complète, leviers d'optimisation chiffrés.", icone: '✦' },
            ].map((step, i) => (
              <div key={step.num} className="relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-7 left-[60%] right-[-40%] h-px bg-slate-200 z-0" />
                )}
                <div className="relative z-10">
                  <div className="relative w-14 h-14 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-xl shadow-lg shadow-blue-600/20">
                      {step.icone}
                    </div>
                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)' }}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Étape {step.num}</div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{step.titre}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link href="/simulateur"
              className="inline-flex items-center gap-2 text-white px-8 py-4 rounded-2xl font-semibold text-base transition-all duration-150 hover:-translate-y-0.5"
              style={{ background: '#2563EB', boxShadow: '0 8px 24px rgba(37,99,235,0.30)' }}>
              ✦ Lancer ma simulation gratuite
              <span style={{ color: '#93C5FD', fontSize: '14px' }}>→</span>
            </Link>
            <div className="text-slate-400 text-sm mt-3">Gratuit · Sans inscription · Résultat en 4 minutes</div>
          </div>
        </div>
      </section>

      {/* ── TÉMOIGNAGES ── */}
      <section style={{ backgroundColor: '#0B1627', padding: '80px 0' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3" style={{ color: '#60A5FA' }}>
              Ils nous font confiance
            </div>
            <h2 className="font-display text-4xl font-bold tracking-tight text-white">Ce que disent nos clients</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ texte, nom, role, initiales }) => (
              <div key={nom} className="rounded-2xl p-6 flex flex-col"
                style={{ background: 'rgba(255,255,255,0.055)', border: '1.5px solid rgba(255,255,255,0.10)' }}>
                {/* Étoiles */}
                <div className="flex gap-0.5 mb-4">
                  {'★★★★★'.split('').map((s, i) => (
                    <span key={i} style={{ color: '#FBBF24', fontSize: '14px' }}>{s}</span>
                  ))}
                </div>
                {/* Quote mark */}
                <div style={{ fontFamily: 'Georgia,serif', fontSize: '72px', lineHeight: 1, marginBottom: '8px', marginTop: '-8px', color: 'rgba(96,165,250,0.3)' }}>
                  &ldquo;
                </div>
                {/* Texte */}
                <p className="text-sm leading-relaxed flex-1 mb-5" style={{ color: 'rgba(255,255,255,0.75)' }}>{texte}</p>
                {/* Auteur */}
                <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
                    {initiales}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{nom}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ background: 'linear-gradient(135deg, #0f172a, #0d1f3c)', padding: '80px 0' }} className="text-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">
            Belho Xper · Cabinet d&apos;expertise comptable · Lyon &amp; Montluel
          </div>
          <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Prêt à savoir combien<br />vous pourriez économiser ?
          </h2>
          <p className="mb-8 text-lg" style={{ color: 'rgba(255,255,255,0.50)' }}>
            Résultat en 4 minutes. Aucune inscription requise.
            Accompagnement expert disponible dès que vous le souhaitez.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link href="/simulateur"
              className="text-white px-8 py-4 rounded-2xl font-semibold transition-all hover:-translate-y-0.5"
              style={{ background: '#2563EB', boxShadow: '0 8px 30px rgba(37,99,235,0.40)' }}>
              ✦ Lancer la simulation gratuite
            </Link>
            <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
              className="px-8 py-4 rounded-2xl font-semibold transition-all"
              style={{ border: '1.5px solid rgba(255,255,255,0.20)', color: 'rgba(255,255,255,0.70)' }}>
              Prendre RDV avec un expert →
            </a>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>Cabinet Belho Xper</div>
            <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.20)' }} />
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>Lyon · Montluel</div>
            <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.20)' }} />
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>Simulation non contractuelle</div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
