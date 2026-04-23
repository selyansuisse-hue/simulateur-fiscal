export function ExpertCTA() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #050c1a, #0d1f3c)' }}>
      <div className="p-5">
        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3">
          Cabinet Belho Xper
        </div>
        <h3 className="text-sm font-bold text-white mb-2">
          Vous avez des questions sur vos résultats ?
        </h3>
        <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.50)' }}>
          Nos experts-comptables analysent votre situation et valident votre stratégie de rémunération.
        </p>
        <a
          href="https://www.belhoxper.com/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs font-bold text-white py-2.5 rounded-xl transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
        >
          Prendre RDV gratuitement →
        </a>
      </div>
      <div className="px-5 pb-5 flex items-center gap-3">
        <div className="flex -space-x-1.5">
          {(['A', 'H'] as const).map((l, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full border-2 border-[#050c1a] flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: ['#3B82F6', '#8B5CF6'][i] }}
            >
              {l}
            </div>
          ))}
        </div>
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Alban &amp; Herwan · Lyon &amp; Montluel
        </span>
      </div>
    </div>
  )
}
