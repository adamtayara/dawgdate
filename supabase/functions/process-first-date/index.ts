// Supabase Edge Function: process-first-date
// Receives raw user input, calls Claude to extract preferences, personality, and summary.
// Stores private data in first_date_preferences, updates public profile fields.
//
// Deploy: npx supabase functions deploy process-first-date
// Secrets: npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Verify auth
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { rawInput, inputMethod = 'text' } = await req.json()
  if (!rawInput || rawInput.trim().length < 10) {
    return new Response(JSON.stringify({ error: 'Input too short' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  // Call Claude to analyze the first-date description
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are analyzing someone's description of their ideal first date for a college dating app.

Their description: "${rawInput.trim()}"

Return a single JSON object (no markdown, no explanation, just raw JSON):

{
  "vibe_summary": "A 1-2 sentence profile teaser. Make it feel attractive and authentic — like something that would make someone want to swipe right. Don't be robotic. Don't reveal overly personal details. Make it sound like the person, not an AI.",
  "date_personality": "Exactly one of: Spontaneous Explorer, Chill Minimalist, Cozy Romantic, Playful Adventurer, Luxury Planner, Artsy Connector, Social Butterfly, Intimate Intellectual",
  "structured_prefs": {
    "setting": "outdoor OR indoor OR both",
    "formality": "casual OR moderate OR fancy",
    "energy": "low OR medium OR high",
    "social_context": "intimate OR semi-private OR social",
    "planning_style": "spontaneous OR semi-planned OR planned",
    "time_of_day": "daytime OR evening OR night OR flexible",
    "focus": "food OR activity OR conversation OR mixed",
    "budget": "free OR cheap OR moderate OR splurge",
    "mood": "romantic OR playful OR chill OR adventurous OR intellectual",
    "atmosphere": "quiet OR lively OR mixed",
    "activities": ["up to 5 specific activities extracted or inferred"],
    "settings": ["up to 4 specific venue types extracted or inferred"],
    "dealbreakers": ["any explicit dislikes mentioned, or empty array"]
  },
  "vibe_vector": {
    "setting": "outdoor OR indoor OR both",
    "formality": "casual OR moderate OR fancy",
    "energy": "low OR medium OR high",
    "mood": "romantic OR playful OR chill OR adventurous OR intellectual",
    "time_of_day": "daytime OR evening OR night OR flexible",
    "budget": "free OR cheap OR moderate OR splurge"
  }
}`
      }]
    })
  })

  if (!claudeRes.ok) {
    const err = await claudeRes.text()
    console.error('Claude error:', err)
    return new Response(JSON.stringify({ error: 'AI processing failed' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  const claudeData = await claudeRes.json()
  const rawJson = claudeData.content[0].text.trim()

  let parsed: any
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    console.error('Failed to parse Claude response:', rawJson)
    return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  // Use service role to write to DB
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Store private preferences
  const { error: prefsError } = await supabaseAdmin
    .from('first_date_preferences')
    .upsert({
      user_id: user.id,
      raw_input: rawInput.trim(),
      input_method: inputMethod,
      structured_prefs: parsed.structured_prefs,
      date_personality: parsed.date_personality,
      vibe_summary: parsed.vibe_summary,
      updated_at: new Date().toISOString(),
    })

  if (prefsError) {
    console.error('DB error storing prefs:', prefsError)
    return new Response(JSON.stringify({ error: 'Failed to save preferences' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  // Update public profile fields
  await supabaseAdmin
    .from('profiles')
    .update({
      date_personality: parsed.date_personality,
      date_vibe_summary: parsed.vibe_summary,
      date_vibe_vector: parsed.vibe_vector,
    })
    .eq('id', user.id)

  return new Response(JSON.stringify({
    date_personality: parsed.date_personality,
    vibe_summary: parsed.vibe_summary,
  }), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
})
