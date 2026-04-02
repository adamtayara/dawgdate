// Supabase Edge Function: generate-match-date
// Called when two users match. Fetches both users' private preferences (service role),
// generates a vivid personalized date plan via Claude, stores in match_date_plans.
//
// Deploy: npx supabase functions deploy generate-match-date
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

  const { matchId, user1Id, user2Id } = await req.json()
  if (!matchId || !user1Id || !user2Id) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  // Only match participants can request this
  if (user.id !== user1Id && user.id !== user2Id) {
    return new Response('Forbidden', { status: 403, headers: CORS })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Return existing plan if already generated
  const { data: existing } = await supabaseAdmin
    .from('match_date_plans')
    .select('plan_text')
    .eq('match_id', matchId)
    .maybeSingle()

  if (existing?.plan_text) {
    return new Response(JSON.stringify({ plan: existing.plan_text }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  // Fetch both users' private preferences
  const { data: prefs } = await supabaseAdmin
    .from('first_date_preferences')
    .select('user_id, structured_prefs, date_personality')
    .in('user_id', [user1Id, user2Id])

  const p1 = prefs?.find(p => p.user_id === user1Id)
  const p2 = prefs?.find(p => p.user_id === user2Id)

  let prompt: string

  if (p1?.structured_prefs && p2?.structured_prefs) {
    prompt = `Two college students just matched on a dating app. Generate their perfect shared first date.

Person A (${p1.date_personality || 'unknown style'}):
${JSON.stringify(p1.structured_prefs, null, 2)}

Person B (${p2.date_personality || 'unknown style'}):
${JSON.stringify(p2.structured_prefs, null, 2)}

Write a vivid, specific first date plan that:
- Finds genuine overlap between their preferences
- Intelligently resolves differences (favor overlap, not just one person's style)
- Is realistic and actually doable — no fantasy scenarios
- Has a clear flow: start → middle → optional end
- Is 3–5 sentences, tight and vivid, not padded
- Uses specific place types (coffee shop, park, rooftop bar — not "somewhere nice")
- Sounds like a real person described it, not an AI
- Avoids filler phrases: "grab food", "hang out", "do something fun", "get to know each other"
- Fits college student budget unless both prefer splurge
- Can reference Athens GA area or be location-neutral

Return ONLY the date plan text. No labels, no intro, no bullet points.`
  } else {
    // Fallback: one or both haven't completed date onboarding
    prompt = `Two college students just matched on a dating app. Generate a fun, specific first date plan for them.

Make it:
- Realistic for college students
- Specific about the type of place and activity
- 3 sentences max
- Sound like a real person described it
- Set in or around a college town

Return ONLY the date plan text.`
  }

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      temperature: 1,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  if (!claudeRes.ok) {
    return new Response(JSON.stringify({ error: 'AI generation failed' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  const claudeData = await claudeRes.json()
  const planText = claudeData.content[0].text.trim()

  // Store the plan
  await supabaseAdmin
    .from('match_date_plans')
    .upsert({
      match_id: matchId,
      plan_text: planText,
    })

  return new Response(JSON.stringify({ plan: planText }), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
})
