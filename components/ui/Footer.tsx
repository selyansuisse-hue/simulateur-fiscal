'use client'

export function Footer() {
  return (
    <footer className="bg-navy border-t border-white/[0.10] pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-mid to-blue flex items-center justify-center">
                <span className="text-white text-xs font-black">B</span>
              </div>
              <span className="font-display font-bold text-white text-sm">Belho Xper</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.50)' }}>
              Cabinet d&apos;expertise comptable. Accompagnement fiscal et social des dirigeants indépendants.
            </p>
          </div>

          <div>
            <div className="text-[10.5px] font-bold tracking-widest uppercase mb-4" style={{ color: 'rgba(255,255,255,.35)' }}>Simulateur</div>
            <div className="space-y-2.5">
              {[['/', 'Accueil'], ['/simulateur', 'Lancer une simulation'], ['/auth/signup', 'Créer un compte'], ['/auth/login', 'Se connecter']].map(([href, label]) => (
                <a key={href} href={href} className="block text-sm transition-colors duration-150 text-white/45 hover:text-white">
                  {label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10.5px] font-bold tracking-widest uppercase mb-4" style={{ color: 'rgba(255,255,255,.35)' }}>Cabinet</div>
            <div className="space-y-2.5">
              {[
                ['https://www.belhoxper.com/', 'À propos'],
                ['https://www.belhoxper.com/contact', 'Prendre RDV'],
                ['https://www.belhoxper.com/', 'Nos services'],
              ].map(([href, label]) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                  className="block text-sm transition-colors duration-150 text-white/45 hover:text-white">
                  {label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10.5px] font-bold tracking-widest uppercase mb-4" style={{ color: 'rgba(255,255,255,.35)' }}>Adresses</div>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,.70)' }}>Lyon</div>
                <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.40)' }}>Cabinet Belho Xper</div>
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,.70)' }}>Montluel</div>
                <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.40)' }}>Cabinet Belho Xper</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.08] pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,.38)' }}>© {new Date().getFullYear()} Belho Xper — Cabinet d&apos;expertise comptable</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,.30)' }}>Simulation indicative — non contractuelle</p>
        </div>
      </div>
    </footer>
  )
}
