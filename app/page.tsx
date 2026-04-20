import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'

export default function LandingPage() {
  return (
    <>
      <PageHeader />

      {/* HERO */}
      <section className="bg-navy relative overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.28)_0%,transparent_65%)] -top-48 -right-24 animate-orb pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(29,78,216,.18)_0%,transparent_65%)] -bottom-36 -left-20 animate-orb-rev pointer-events-none" />
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(rgba(255,255,255,.15)_1px,transparent_1px)] bg-[length:28px_28px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black_30%,transparent_100%)]" />

        <div className="max-w-4xl mx-auto px-6 py-24 relative">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="h-0.5 w-8 bg-gradient-to-r from-blue-mid to-transparent rounded-full" />
            <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-blue-mid">Simulateur fiscal · 2025</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-black text-white leading-[1.04] tracking-[-0.03em] mb-5 max-w-2xl">
            Quelle structure vous fait<br />
            <span className="bg-gradient-to-r from-blue-mid via-blue-light to-[#bfdbfe] bg-clip-text text-transparent">
              vraiment économiser ?
            </span>
          </h1>
          <p className="text-base text-white/50 leading-[1.75] max-w-xl mb-10">
            4 étapes. Le simulateur compare toutes les structures sur votre CA, calcule la stratégie de rémunération optimale et détaille chaque résultat.
          </p>

          {/* Stats */}
          <div className="flex bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden w-fit max-w-full mb-10">
            {[
              { val: '4', lbl: 'Structures comparées' },
              { val: '2025', lbl: 'Barème IR & IS' },
              { val: '100 %', lbl: 'Calcul taux réel' },
              { val: 'Gratuit', lbl: 'Sans engagement' },
            ].map(({ val, lbl }, i, arr) => (
              <div key={lbl} className={`px-7 py-4 flex flex-col gap-0.5 min-w-[110px] ${i < arr.length - 1 ? 'border-r border-white/[0.07]' : ''}`}>
                <span className="font-display text-[22px] font-bold text-white leading-none">{val}</span>
                <span className="text-[11px] text-white/38 font-medium tracking-wide">{lbl}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex gap-4 flex-wrap items-center">
            <Link
              href="/simulateur"
              className="px-8 py-4 bg-blue text-white font-bold text-[15px] rounded-xl
                shadow-[0_4px_20px_rgba(29,78,216,.45)] hover:bg-blue-dark hover:-translate-y-0.5
                hover:shadow-[0_8px_32px_rgba(29,78,216,.5)] transition-all duration-150"
            >
              ✦ Lancer la simulation gratuite
            </Link>
            <Link
              href="/auth/signup"
              className="px-7 py-4 bg-white/8 text-white font-semibold text-[15px] rounded-xl border border-white/15
                hover:bg-white/12 transition-all"
            >
              Créer un compte →
            </Link>
          </div>

          {/* Pills */}
          <div className="flex gap-2 flex-wrap mt-8">
            {['Barème IR 2025 · QF 1 807 €', 'IS 15% / 25%', 'Cotisations SSI réelles par composante', 'IK · PER · Madelin intégrés'].map(p => (
              <span key={p} className="text-[11.5px] font-medium text-white/48 bg-white/5 border border-white/[0.09] px-3.5 py-1.5 rounded-full">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FONCTIONNALITÉS */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-blue mb-3">Fonctionnalités</div>
          <h2 className="font-display text-4xl font-bold text-ink tracking-tight mb-4">Tout ce qu&apos;il vous faut pour décider</h2>
          <p className="text-[15px] text-ink3 max-w-xl mx-auto leading-relaxed">Calculs 100% côté client, aucune donnée transmise sans votre accord.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { ico: '⚖️', t: '4 structures comparées', d: 'Micro, EI, EURL/SARL IS, SAS/SASU — sur le même CA, les mêmes charges.' },
            { ico: '📐', t: 'Calculs fiscaux 2025', d: 'Barème IR, QF, décote, cotisations SSI par composante, IS 15%/25%, PFU.' },
            { ico: '🎯', t: 'Score multicritère', d: 'Pondération selon votre priorité : revenu net, protection sociale, simplicité, croissance.' },
            { ico: '📊', t: 'SWOT + leviers', d: 'Analyse forces/faiblesses de la structure recommandée + leviers d\'optimisation chiffrés.' },
            { ico: '💾', t: 'Sauvegarde & comparaison', d: 'Enregistrez vos simulations, comparez-les côte à côte dans votre dashboard.' },
            { ico: '📄', t: 'Export PDF', d: 'Rapport complet téléchargeable avec toutes les données et le plan d\'action.' },
          ].map(({ ico, t, d }) => (
            <div key={t} className="bg-white border border-black/[0.07] rounded-xl p-5 shadow-card hover:-translate-y-0.5 hover:shadow-card-md transition-all">
              <div className="text-2xl mb-3">{ico}</div>
              <div className="font-display text-[15px] font-bold text-ink mb-1.5">{t}</div>
              <div className="text-sm text-ink3 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TÉMOIGNAGES */}
      <section className="bg-navy py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-blue-mid mb-3">Ils nous font confiance</div>
            <h2 className="font-display text-4xl font-bold text-white tracking-tight">Ce que disent nos clients</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { t: 'J\'ai économisé 8 000 €/an en passant de l\'EI à la SASU. Le simulateur m\'a convaincu en 10 minutes.', n: 'Thomas D.', r: 'Consultant freelance, Lyon' },
              { t: 'Enfin un simulateur qui calcule les cotisations SSI par composante et pas avec un taux forfaitaire approximatif.', n: 'Marie L.', r: 'Architecte libérale' },
              { t: 'La comparaison score multicritère m\'a fait réaliser que la SASU n\'était pas forcément meilleure pour ma situation.', n: 'Antoine R.', r: 'Développeur indépendant' },
            ].map(({ t, n, r }) => (
              <div key={n} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="text-white/60 text-sm leading-relaxed mb-4 italic">&quot;{t}&quot;</div>
                <div className="text-white font-semibold text-[13px]">{n}</div>
                <div className="text-white/38 text-xs">{r}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-4xl font-black text-ink tracking-tight mb-4">
          Prêt à optimiser votre structure ?
        </h2>
        <p className="text-[15px] text-ink3 mb-8 leading-relaxed">
          Gratuit, 4 étapes, résultat immédiat. Créez un compte pour sauvegarder vos simulations.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/simulateur" className="px-8 py-4 bg-blue text-white font-bold text-[15px] rounded-xl shadow-[0_4px_20px_rgba(29,78,216,.4)] hover:bg-blue-dark transition-all">
            ✦ Lancer la simulation
          </Link>
          <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer" className="px-7 py-4 border border-surface2 text-ink2 font-semibold text-[15px] rounded-xl hover:bg-surface transition-all">
            Prendre RDV →
          </a>
        </div>
      </section>

      <Footer />
    </>
  )
}
