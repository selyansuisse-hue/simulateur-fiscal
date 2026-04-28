'use client'
import { useState } from 'react'
import type { Cabinet } from '@/lib/types/cabinet'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://simulateur-fiscal-bkxh.vercel.app'

export function WidgetPreview({ cabinet }: { cabinet: Cabinet }) {
  const [copied, setCopied] = useState(false)
  const widgetUrl = `${BASE_URL}/widget/${cabinet.slug}`
  const iframeCode = `<iframe\n  src="${widgetUrl}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.1);"\n></iframe>`

  function copyCode() {
    navigator.clipboard.writeText(iframeCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Code bloc */}
      <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', fontFamily: 'monospace' }}>HTML · iframe à intégrer</span>
          <button onClick={copyCode} style={{
            padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
            background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(37,99,235,0.15)',
            border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(37,99,235,0.3)'}`,
            color: copied ? '#34d399' : '#60a5fa',
            fontSize: '11px', fontWeight: 700, transition: 'all 150ms',
          }}>
            {copied ? '✓ Copié !' : '📋 Copier'}
          </button>
        </div>
        <pre style={{ padding: '16px', margin: 0, fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', overflowX: 'auto', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
          {iframeCode}
        </pre>
      </div>

      {/* URL directe */}
      <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '14px 16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
          URL directe
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <code style={{ flex: 1, fontSize: '12px', color: '#60a5fa', background: '#0f172a', padding: '6px 10px', borderRadius: '6px', border: '1px solid #334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {widgetUrl}
          </code>
          <a href={widgetUrl} target="_blank" rel="noopener noreferrer" style={{
            padding: '6px 12px', borderRadius: '7px', flexShrink: 0,
            background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)',
            color: '#60a5fa', fontSize: '11px', fontWeight: 700,
            textDecoration: 'none',
          }}>
            Ouvrir →
          </a>
        </div>
      </div>

      {/* Infos couleurs */}
      <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '14px 16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
          Couleurs du widget
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Principale', value: cabinet.couleur_principale },
            { label: 'Secondaire', value: cabinet.couleur_secondaire },
          ].map(c => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: c.value, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>{c.label}</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace' }}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '12px', fontSize: '11px', color: '#475569' }}>
          Pour modifier les couleurs, rendez-vous dans Paramètres.
        </div>
      </div>

      {/* Preview iframe */}
      <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
          Aperçu live
        </div>
        <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #334155' }}>
          <iframe
            src={widgetUrl}
            width="100%"
            height="500"
            frameBorder="0"
            title={`Widget ${cabinet.nom}`}
            style={{ display: 'block' }}
          />
        </div>
      </div>
    </div>
  )
}
