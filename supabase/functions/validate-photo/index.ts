// Supabase Edge Function: validate-photo
// Accepts a base64-encoded image and uses Claude Vision to verify
// it contains a real human face. Rejects logos, animals, landscapes, etc.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Verify auth — user must be logged in
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { imageBase64, mediaType = 'image/jpeg' } = await req.json()
  if (!imageBase64) {
    return new Response(JSON.stringify({ valid: false, reason: 'No image provided' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 }
          },
          {
            type: 'text',
            text: `Does this image show a real human face or a real person? Answer with a JSON object only — no explanation:
{"valid": true or false, "reason": "one short sentence explaining why, only if false"}

Rules:
- true: a real photo of a human face, even partially visible, even with sunglasses
- false: cartoon, anime, drawing, logo, animal, landscape, object, meme, screenshot, heavily filtered to not look real, or no person visible at all`
          }
        ]
      }]
    })
  })

  if (!claudeRes.ok) {
    console.error('Claude error:', await claudeRes.text())
    // Fail open — don't block users if the AI is down
    return new Response(JSON.stringify({ valid: true, reason: '' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  const claudeData = await claudeRes.json()
  const raw = claudeData.content[0].text.trim()

  let result = { valid: true, reason: '' }
  try {
    // Claude may wrap in markdown — strip it
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim()
    result = JSON.parse(cleaned)
  } catch {
    // Parse failure → fail open
    console.error('Failed to parse Claude response:', raw)
  }

  return new Response(JSON.stringify(result), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
})
