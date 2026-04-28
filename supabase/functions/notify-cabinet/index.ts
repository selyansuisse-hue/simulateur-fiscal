import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = 'notifications@belhoxper.fr'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { lead_id, cabinet_id, cabinet } = await req.json()

    if (!cabinet?.email_contact) {
      return new Response(JSON.stringify({ error: 'email_contact manquant' }), { status: 400 })
    }

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY non configurée — email non envoyé')
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f1f5f9; padding: 32px; border-radius: 12px;">
        <div style="font-size: 20px; font-weight: 900; margin-bottom: 8px;">✦ Belho Xper</div>
        <div style="font-size: 14px; color: #64748b; margin-bottom: 24px;">Nouveau lead reçu</div>
        <div style="background: #1e293b; border-radius: 10px; padding: 20px; margin-bottom: 20px; border-left: 3px solid #3B82F6;">
          <div style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">🎯 Nouveau lead pour ${cabinet.nom}</div>
          <div style="font-size: 13px; color: #94a3b8; line-height: 1.8;">
            Un prospect vient de terminer une simulation fiscale sur votre widget.<br/>
            Connectez-vous à votre tableau de bord pour consulter ses coordonnées et lui répondre.
          </div>
        </div>
        <a href="https://simulateur-fiscal-bkxh.vercel.app/cabinet/${cabinet.slug}"
           style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #2563EB, #1D4ED8); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          Voir le lead →
        </a>
        <div style="margin-top: 24px; font-size: 11px; color: #475569;">
          Réf. lead: ${lead_id} · Cabinet: ${cabinet_id}
        </div>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [cabinet.email_contact],
        subject: `[${cabinet.nom}] Nouveau lead reçu via votre simulateur`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: 'Email non envoyé' }), { status: 500 })
    }

    return new Response(JSON.stringify({ sent: true }), { status: 200 })
  } catch (err) {
    console.error('notify-cabinet error:', err)
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), { status: 500 })
  }
})
