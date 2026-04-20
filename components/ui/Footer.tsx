export function Footer() {
  return (
    <footer className="bg-navy border-t border-white/[0.05] pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-mid to-blue flex items-center justify-center">
                <span className="text-white text-xs font-black">B</span>
              </div>
              <span className="font-display font-bold text-white text-sm">Belho Xper</span>
            </div>
            <p className="text-sm text-white/38 leading-relaxed">
              Cabinet d&apos;expertise comptable. Accompagnement fiscal et social des dirigeants.
            </p>
          </div>
          <div>
            <div className="text-[10.5px] font-bold tracking-widest uppercase text-white/28 mb-4">Simulateur</div>
            <div className="space-y-2.5">
              {[['/', 'Accueil'], ['/simulateur', 'Lancer une simulation'], ['/auth/signup', 'Créer un compte'], ['/auth/login', 'Se connecter']].map(([href, label]) => (
                <a key={href} href={href} className="block text-sm text-white/45 hover:text-white transition-colors">{label}</a>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] font-bold tracking-widest uppercase text-white/28 mb-4">Cabinet</div>
            <div className="space-y-2.5">
              {[
                ['https://www.belhoxper.com/', 'À propos'],
                ['https://www.belhoxper.com/contact', 'Prendre RDV'],
                ['https://www.belhoxper.com/', 'Nos services'],
              ].map(([href, label]) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="block text-sm text-white/45 hover:text-white transition-colors">{label}</a>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] font-bold tracking-widest uppercase text-white/28 mb-4">Adresses</div>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-white/70">Lyon</div>
                <div className="text-sm text-white/38 leading-relaxed">Cabinet Belho Xper</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-white/70">Montluel</div>
                <div className="text-sm text-white/38 leading-relaxed">Cabinet Belho Xper</div>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-white/25">© {new Date().getFullYear()} Belho Xper — Cabinet d&apos;expertise comptable</p>
          <p className="text-xs text-white/20">Simulation indicative — non contractuelle</p>
        </div>
      </div>
    </footer>
  )
}
