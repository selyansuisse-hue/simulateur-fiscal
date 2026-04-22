import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'

const FEATURES = [
  { ico: '⚖️', color: '#EFF6FF', t: '4 structures comparées', d: 'Micro, EI, EURL/SARL IS, SAS/SASU — sur le même CA, les mêmes charges.' },
  { ico: '📐', color: '#F0FDF4', t: 'Calculs fiscaux 2025', d: 'Barème IR, QF, décote, cotisations SSI par composante, IS 15%/25%, PFU.' },
  { ico: '🎯', color: '#FFF7ED', t: 'Score multicritère', d: 'Pondération selon votre priorité : revenu net, protection, simplicité, croissance.' },
  { ico: '📊', color: '#FDF4FF', t: 'SWOT + leviers chiffrés', d: 'Analyse forces/faiblesses de la structure recommandée + leviers d\'optimisation.' },
  { ico: '💾', color: '#F0FDF4', t: 'Sauvegarde & comparaison', d: 'Enregistrez vos simulations, comparez-les côte à côte dans votre dashboard.' },
  { ico: '📄', color: '#FFF7ED', t: 'Export PDF', d: 'Rapport complet téléchargeable avec toutes les données et le plan d\'action.' },
]

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

export default function LandingPage() {
  return (
    <>
      <PageHeader />

      {/* ── HERO ── */}
      <section style={{ backgroundColor: '#050c1a' }} className="relative overflow-hidden">
        <div className="absolute w-[700px] h-[700px] rounded-full pointer-events-none animate-orb"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,.30) 0%, transparent 65%)', top: '-14rem', right: '-8rem' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full pointer-events-none animate-orb-rev"
          style={{ background: 'radial-gradient(circle, rgba(29,78,216,.18) 0%, transparent 65%)', bottom: '-10rem', left: '-5rem' }} />
        <div className="absolute inset-0 pointer-events-none opacity-35"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.13) 1px, transparent 1px)', backgroundSize: '28px 28px',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)' }} />

        <div className="max-w-5xl mx-auto px-6 py-28 relative">
          <div className="flex items-center gap-2.5 mb-7">
            <div className="h-0.5 w-8 rounded-full" style={{ background: 'linear-gradient(to right, #3B82F6, transparent)' }} />
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#3B82F6' }}>
              Simulateur fiscal · 2025
            </span>
          </div>

          <h1 className="font-display font-black leading-[1.03] tracking-[-0.03em] mb-6 max-w-3xl"
            style={{ fontSize: 'clamp(2.75rem, 6vw, 4.5rem)', color: '#fff' }}>
            Quelle structure vous fait<br />
            <span style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6, #93C5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              vraiment économiser ?
            </span>
          </h1>

          <p className="text-lg leading-relaxed max-w-xl mb-10" style={{ color: 'rgba(255,255,255,.70)' }}>
            4 étapes. Résultat immédiat. Barème 2025.
          </p>

          {/* Stats — hover via Tailwind uniquement */}
          <div className="flex flex-wrap gap-3 mb-10">
            {STATS.map(({ val, lbl, sub }) => (
              <div key={lbl}
                className="flex flex-col px-5 py-3.5 rounded-xl cursor-default transition-all duration-200
                  border border-white/10 bg-white/[0.04] hover:border-blue-mid/35 hover:bg-white/[0.07]">
                <span className="font-display text-2xl font-bold text-white leading-none">{val}</span>
                <span className="text-[11px] font-semibold mt-0.5 text-white/60">{lbl}</span>
                <span className="text-[10px] text-white/30">{sub}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex gap-4 flex-wrap items-center mb-8">
            <Link href="/simulateur"
              className="px-8 py-4 bg-blue font-bold text-[15px] rounded-xl text-white
                shadow-[0_4px_20px_rgba(29,78,216,.50)] hover:bg-blue-dark hover:-translate-y-0.5 transition-all duration-150">
              ✦ Lancer la simulation gratuite
            </Link>
            <Link href="/auth/signup"
              className="px-7 py-4 font-semibold text-[15px] rounded-xl text-white transition-all hover:-translate-y-0.5
                bg-white/[0.08] border border-white/[0.18] hover:bg-white/[0.12]">
              Créer un compte →
            </Link>
          </div>

          {/* Pills */}
          <div className="flex gap-2 flex-wrap">
            {['Barème IR 2025 · QF 1 807 €', 'IS 15% / 25%', 'Cotisations SSI par composante', 'PER · Madelin intégrés'].map(p => (
              <span key={p} className="text-[11.5px] font-medium px-3.5 py-1.5 rounded-full text-white/65 bg-white/[0.06] border border-white/[0.12]">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FONCTIONNALITÉS ── */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-blue-mid mb-3">Fonctionnalités</div>
            <h2 className="font-display text-[2rem] font-bold tracking-tight text-ink mb-3">
              Tout ce qu&apos;il vous faut pour décider
            </h2>
            <p className="text-[15px] text-ink3 max-w-xl mx-auto leading-relaxed">
              Calculs 100% côté client, aucune donnée transmise sans votre accord.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ ico, color, t, d }) => (
              <div key={t}
                className="group relative bg-white rounded-xl p-6 overflow-hidden transition-all duration-200
                  border border-slate-100 shadow-sm hover:shadow-md hover:border-blue/20 hover:-translate-y-0.5">
                {/* Top accent — CSS transform via group-hover */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                <div className="w-11 h-11 rounded-lg flex items-center justify-center text-2xl mb-4" style={{ background: color }}>
                  {ico}
                </div>
                <div className="font-display text-[15px] font-bold text-ink mb-2">{t}</div>
                <div className="text-sm text-ink3 leading-relaxed">{d}</div>
              </div>
            ))}
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
              <div key={n} className="rounded-2xl p-6 flex flex-col bg-white/[0.05] border border-white/[0.09]">
                <div className="flex gap-0.5 mb-3 text-sm">{'⭐'.repeat(5)}</div>
                <div className="font-serif text-5xl leading-none mb-2 text-blue-mid">&ldquo;</div>
                <p className="text-sm leading-relaxed flex-1 mb-5 text-white/65">{t}</p>
                <div className="border-t border-white/[0.09] pt-4">
                  <div className="text-sm font-semibold text-white">{n}</div>
                  <div className="text-xs mt-0.5 text-white/40">— {r}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-24 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #050c1a 0%, #0d1f3c 100%)' }}>
        <div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,.20) 0%, transparent 65%)', top: '-10rem', right: '-8rem' }} />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-blue-mid mb-4">Commencer maintenant</div>
          <h2 className="font-display text-4xl font-black tracking-tight mb-3 text-white">
            Prêt à optimiser votre structure ?
          </h2>
          <p className="text-lg mb-2 text-white/55">Résultat en 4 minutes. Aucune inscription requise.</p>
          <p className="text-[13px] mb-10 text-white/35">Créez un compte pour sauvegarder et comparer vos simulations.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/simulateur"
              className="px-8 py-4 bg-blue font-bold text-[15px] rounded-xl text-white
                shadow-[0_4px_20px_rgba(29,78,216,.45)] hover:bg-blue-dark hover:-translate-y-0.5 transition-all">
              ✦ Lancer la simulation
            </Link>
            <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
              className="px-7 py-4 font-semibold text-[15px] rounded-xl transition-all hover:-translate-y-0.5
                border border-white/[0.22] text-white/70 hover:text-white hover:border-white/40">
              Prendre RDV →
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
