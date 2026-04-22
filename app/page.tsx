export const dynamic = 'force-static'

import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'

const STATS = [
  { val: '4', lbl: 'Structures', sub: 'comparées' },
  { val: '2025', lbl: 'Barème IR & IS', sub: 'à jour' },
  { val: '100%', lbl: 'Taux réels', sub: 'SSI par composante' },
  { val: 'Gratuit', lbl: 'Sans CB', sub: 'sans engagement' },
]

const TESTIMONIALS = [
  { t: 'J\'ai économisé 8 000 €/an en passant de l\'EI à la SASU. Le simulateur m\'a convaincu en 10 minutes.', n: 'Thomas D.', r: 'Consultant freelance, Lyon' },
  { t: 'Enfin un simulateur qui calcule les cotisations SSI par composante et pas avec un taux forfaitaire approximatif.', n: 'Marie L.', r: 'Architecte libérale' },
  { t: 'La comparaison score multicritère m\'a fait réaliser que la SASU n\'était pas forcément meilleure pour ma situation.', n: 'Antoine R.', r: 'Développeur indépendant' },
]

const FAQ = [
  {
    q: 'Le simulateur est-il vraiment gratuit ?',
    a: 'Oui, totalement gratuit et sans inscription obligatoire. Vous obtenez vos résultats complets en 4 minutes, sans carte bancaire ni engagement.',
  },
  {
    q: 'Comment sont calculées les cotisations sociales ?',
    a: 'Nous utilisons le barème SSI 2025 par composante (maladie, retraite de base, retraite complémentaire, invalidité-décès, formation). Pas de taux forfaitaire approximatif — chaque composante est calculée sur la bonne base.',
  },
  {
    q: 'Puis-je faire confiance aux résultats pour prendre une décision ?',
    a: 'Le simulateur fournit une estimation fiable basée sur les barèmes officiels 2025. Il est conçu pour orienter votre réflexion. Pour toute décision juridique ou fiscale engageante, un rendez-vous avec un expert-comptable reste recommandé.',
  },
  {
    q: 'Quelle est la différence entre EURL et SASU ?',
    a: 'L\'EURL est soumise au régime SSI (cotisations sur rémunération + dividendes si > 10% du capital). La SASU est soumise au régime général (cotisations uniquement sur rémunération, dividendes non soumis aux cotisations). L\'impact dépend fortement de votre CA et de votre politique de rémunération — c\'est exactement ce que le simulateur calcule.',
  },
]

export default function LandingPage() {
  return (
    <>
      <PageHeader />

      {/* ── HERO ── */}
      <section style={{ backgroundColor: '#050c1a' }} className="relative overflow-hidden">
        {/* Orbes plus grands */}
        <div className="absolute w-[900px] h-[900px] rounded-full pointer-events-none animate-orb"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,.35) 0%, transparent 60%)', top: '-18rem', right: '-12rem' }} />
        <div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none animate-orb-rev"
          style={{ background: 'radial-gradient(circle, rgba(29,78,216,.22) 0%, transparent 60%)', bottom: '-14rem', left: '-8rem' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,.12) 0%, transparent 65%)', top: '30%', left: '40%' }} />
        <div className="absolute inset-0 pointer-events-none opacity-35"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.13) 1px, transparent 1px)', backgroundSize: '28px 28px',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)' }} />

        <div className="max-w-5xl mx-auto px-6 py-28 relative">

          {/* Badge crédibilité */}
          <div className="inline-flex items-center gap-2.5 mb-7 px-4 py-2 rounded-full border"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <div className="flex -space-x-1">
              {['T', 'M', 'A'].map(l => (
                <div key={l} className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border border-white/20 flex items-center justify-center text-[9px] font-bold text-white">{l}</div>
              ))}
            </div>
            <span className="text-[11.5px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
              +1 200 dirigeants ont optimisé leur structure
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
              GRATUIT
            </span>
          </div>

          <h1 className="font-display font-black leading-[1.03] tracking-[-0.03em] mb-6 max-w-3xl"
            style={{ fontSize: 'clamp(3rem, 7vw, 5rem)', color: '#fff' }}>
            Quelle structure<br />
            <span style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6, #93C5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              vous fait vraiment
            </span><br />
            économiser ?
          </h1>

          <p className="text-lg leading-relaxed max-w-xl mb-10" style={{ color: 'rgba(255,255,255,.70)' }}>
            4 étapes. Résultat immédiat. Barème 2025.
          </p>

          {/* Stat cards avec hover Tailwind */}
          <div className="flex flex-wrap gap-3 mb-10">
            {STATS.map(({ val, lbl, sub }) => (
              <div key={lbl}
                className="flex flex-col px-5 py-3.5 rounded-xl cursor-default transition-all duration-200
                  border border-white/10 bg-white/[0.04] hover:border-blue-500/40 hover:bg-blue-500/[0.08] hover:-translate-y-0.5">
                <span className="font-display text-2xl font-bold text-white leading-none">{val}</span>
                <span className="text-[11px] font-semibold mt-0.5 text-white/60">{lbl}</span>
                <span className="text-[10px] text-white/30">{sub}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex gap-4 flex-wrap items-center mb-4">
            <Link href="/simulateur"
              className="px-8 py-4 bg-blue font-bold text-[15px] rounded-xl text-white
                hover:bg-blue-dark hover:-translate-y-0.5 transition-all duration-150"
              style={{ boxShadow: '0 6px 30px rgba(29,78,216,.60), 0 2px 8px rgba(29,78,216,.40)' }}>
              ✦ Lancer la simulation gratuite
            </Link>
            <Link href="/auth/signup"
              className="px-7 py-4 font-semibold text-[15px] rounded-xl text-white transition-all hover:-translate-y-0.5
                bg-white/[0.08] border border-white/[0.18] hover:bg-white/[0.12]">
              Créer un compte →
            </Link>
          </div>

          {/* Utilisé par */}
          <div className="flex items-center gap-3 flex-wrap mb-6">
            <span className="text-white/40 text-xs">Utilisé par</span>
            {['Consultants indépendants', 'Freelances IT', 'Professions libérales', 'Artisans / Commerçants'].map(p => (
              <span key={p} className="text-white/60 text-xs bg-white/5 px-3 py-1 rounded-full">{p}</span>
            ))}
          </div>

          {/* Technical pills */}
          <div className="flex gap-2 flex-wrap">
            {['Barème IR 2025 · QF 1 807 €', 'IS 15% / 25%', 'Cotisations SSI par composante', 'PER · Madelin intégrés'].map(p => (
              <span key={p} className="text-[11.5px] font-medium px-3.5 py-1.5 rounded-full text-white/65 bg-white/[0.06] border border-white/[0.12]">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── APERÇU DU PRODUIT ── */}
      <section className="py-20" style={{ background: 'linear-gradient(180deg, #F8FAFF 0%, #EEF2FF 100%)' }}>
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

          {/* Séparateur */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest px-2">Simulation en direct</div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
          </div>

          {/* Mockup principal */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-3xl blur-3xl -z-10" />
            <div className="bg-gradient-to-br from-slate-900 to-[#0d1f3c] rounded-3xl p-8"
              style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.25)' }}>

              {/* Fausse barre navigateur */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="flex-1 bg-white/5 rounded-full h-6 flex items-center px-4">
                  <span className="text-white/30 text-xs">simulateur-fiscal-bkxh.vercel.app/simulateur</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Recommandation principale */}
                <div>
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Structure recommandée
                  </div>
                  <div className="text-white/60 text-sm mb-1">EURL / SARL IS</div>
                  <div className="text-5xl font-bold text-white tracking-tight mb-1">54 200 €</div>
                  <div className="text-white/40 text-sm mb-5">4 517 €/mois · net après IR, cotisations et IS</div>
                  <div className="inline-flex items-center gap-2 bg-emerald-500/15 text-emerald-400 text-sm font-bold px-4 py-2 rounded-xl mb-4">
                    +12 800 €/an vs la moins avantageuse
                  </div>
                  <div className="flex gap-2">
                    <span className="bg-white/10 text-white/50 text-xs px-3 py-1 rounded-full">TMI 30%</span>
                    <span className="bg-white/10 text-white/50 text-xs px-3 py-1 rounded-full">Score 78/100</span>
                  </div>
                </div>

                {/* Mini tableau comparatif */}
                <div className="bg-white/5 rounded-2xl p-5">
                  <div className="text-xs text-white/40 uppercase tracking-wide mb-4">Comparaison des 4 structures</div>
                  {[
                    { nom: 'EURL / SARL IS', net: '54 200 €', badge: '★ Rec.', best: true },
                    { nom: 'SAS / SASU', net: '51 800 €', badge: '2ème', best: false },
                    { nom: 'EI (réel normal)', net: '43 100 €', badge: '3ème', best: false },
                    { nom: 'Micro-entreprise', net: '34 600 €', badge: '4ème', best: false },
                  ].map(s => (
                    <div key={s.nom}
                      className={`flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 ${s.best ? '' : 'opacity-50'}`}>
                      <div className="flex items-center gap-2">
                        {s.best && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                        <span className={`text-sm ${s.best ? 'font-bold text-white' : 'text-white/50'}`}>{s.nom}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${s.best ? 'text-blue-400' : 'text-white/40'}`}>{s.net}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.best ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/30'}`}>
                          {s.badge}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3 mini-aperçus */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Décomposition CA */}
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

            {/* TMI barème */}
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
                  <div key={row.t}
                    className={`flex justify-between text-xs px-3 py-1.5 rounded-lg font-medium
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

            {/* Scénario optimisé */}
            <div className="bg-emerald-900 rounded-2xl p-5">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-3">Scénario optimisé</div>
              <div className="text-2xl font-bold text-white mb-1">+6 340 €/an</div>
              <div className="text-xs text-emerald-400/60 mb-4">supplémentaires avec les leviers</div>
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
      <section style={{ backgroundColor: '#050c1a' }} className="py-16">
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
                <div className="font-display text-5xl font-black mb-1" style={{ color: stat.color }}>{stat.val}</div>
                <div className="text-sm font-medium text-white/70 mb-0.5">{stat.label}</div>
                <div className="text-xs text-white/30">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ── */}
      <section className="py-20" style={{ backgroundColor: '#FAFBFF' }}>
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
                  {/* Icone avec badge numéro en overlay */}
                  <div className="relative w-14 h-14 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-xl shadow-lg shadow-blue-600/20">
                      {step.icone}
                    </div>
                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white z-10"
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
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold text-base
                hover:bg-blue-700 transition-all duration-150 shadow-lg shadow-blue-600/25">
              ✦ Lancer ma simulation gratuite
              <span className="text-blue-200 text-sm">→</span>
            </Link>
            <div className="text-slate-400 text-sm mt-3">Gratuit · Sans inscription · Résultat en 4 minutes</div>
          </div>
        </div>
      </section>

      {/* ── TÉMOIGNAGES ── */}
      <section className="py-20" style={{ backgroundColor: '#0B1627' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-blue-mid mb-3">Ils nous font confiance</div>
            <h2 className="font-display text-4xl font-bold tracking-tight text-white">Ce que disent nos clients</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ t, n, r }) => (
              <div key={n}
                className="rounded-2xl p-6 flex flex-col border border-white/[0.09]"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                {/* Étoiles individuelles */}
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <div className="font-serif text-5xl leading-none mb-2 text-blue-mid">&ldquo;</div>
                <p className="text-sm leading-relaxed flex-1 mb-5 text-white/65">{t}</p>
                <div className="border-t border-white/[0.09] pt-4 flex items-center gap-3">
                  {/* Avatar avec initiales */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {n[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{n}</div>
                    <div className="text-xs mt-0.5 text-white/40">{r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-blue-600 mb-3">Questions fréquentes</div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Tout ce que vous voulez savoir</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group border border-slate-200 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer text-slate-900 font-semibold text-[15px] select-none hover:bg-slate-50 transition-colors">
                  {q}
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-base font-light transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <div className="px-6 pb-5 pt-1 text-sm text-slate-500 leading-relaxed border-t border-slate-100">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="bg-gradient-to-br from-slate-900 to-[#0d1f3c] py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">
            Belho Xper · Cabinet d&apos;expertise comptable · Lyon &amp; Montluel
          </div>
          <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Prêt à savoir combien<br />vous pourriez économiser ?
          </h2>
          <p className="text-white/50 mb-8 text-lg">
            Résultat en 4 minutes. Aucune inscription requise.
            Accompagnement expert disponible dès que vous le souhaitez.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link href="/simulateur"
              className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30">
              ✦ Lancer la simulation gratuite
            </Link>
            <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
              className="border border-white/20 text-white/70 px-8 py-4 rounded-2xl font-semibold hover:border-white/40 hover:text-white transition-all">
              Prendre RDV avec un expert →
            </a>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="text-xs text-white/30">Cabinet Belho Xper</div>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <div className="text-xs text-white/30">Lyon · Montluel</div>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <div className="text-xs text-white/30">Simulation non contractuelle</div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
