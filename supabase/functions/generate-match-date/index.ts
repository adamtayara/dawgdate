// Supabase Edge Function: generate-match-date
// Called when two users match OR when a user requests a plan change.
// Fetches both users' private preferences (service role),
// generates a vivid personalized date plan via Claude, stores in match_date_plans.
// Supports regeneration with user suggestions.

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

  const { matchId, user1Id, user2Id, suggestion, previousPlan } = await req.json()
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

  // Check for existing plan
  const { data: existing } = await supabaseAdmin
    .from('match_date_plans')
    .select('*')
    .eq('match_id', matchId)
    .maybeSingle()

  // Return existing plan if no suggestion (initial load / not a regeneration)
  if (existing?.plan_text && !suggestion) {
    return new Response(JSON.stringify({ plan: existing.plan_text, datePlan: existing }), {
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

  if (suggestion && previousPlan) {
    // REGENERATION MODE — user requested a change
    const pastPlans = (existing?.version_history || [])
      .map((v: any) => v.plan_text)
      .filter(Boolean)

    const avoidSection = pastPlans.length > 0
      ? `\n\nPrevious date ideas that should NOT be repeated:\n${pastPlans.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`
      : ''

    prompt = `Two college students matched on a dating app and received this date plan:
"${previousPlan}"

One of them suggested a change: "${suggestion}"
${avoidSection}

${p1?.structured_prefs && p2?.structured_prefs ? `
Person A (${p1.date_personality || 'unknown style'}):
${JSON.stringify(p1.structured_prefs, null, 2)}

Person B (${p2.date_personality || 'unknown style'}):
${JSON.stringify(p2.structured_prefs, null, 2)}
` : ''}
Generate a REVISED date plan that incorporates the suggestion while keeping it balanced for both people.

Rules:
- Incorporate the feedback naturally — don't just swap one activity
- Keep it realistic for college students in Athens, GA
- Has a clear flow: start → middle → optional end
- 3–5 sentences, tight and vivid, not padded
- Uses specific place types (coffee shop, park, rooftop bar — not "somewhere nice")
- Sounds like a real person described it, not an AI
- Avoids filler phrases: "grab food", "hang out", "do something fun"
- Fits college student budget unless both prefer splurge

Return ONLY the revised date plan text. No labels, no intro, no bullet points.`
  } else if (p1?.structured_prefs && p2?.structured_prefs) {
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
    prompt = `Two college students just matched on a dating app. Generate a fun, specific first date plan for them.

Make it:
- Realistic for college students in Athens, GA
- Specific about the type of place and activity
- 3 sentences max
- Sound like a real person described it
- Set in or around Athens, GA (UGA campus area)

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
      model: 'claude-sonnet-4-5-20250929',
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

  let result: any

  if (existing && suggestion) {
    // REGENERATION — update existing plan with new version
    const newVersion = (existing.current_version || 1) + 1
    const updatedHistory = [
      ...(existing.version_history || []),
      {
        version: existing.current_version || 1,
        plan_text: existing.plan_text,
        created_at: new Date().toISOString(),
        suggestion: suggestion,
      }
    ]

    const { data: updated } = await supabaseAdmin
      .from('match_date_plans')
      .update({
        plan_text: planText,
        current_version: newVersion,
        version_history: updatedHistory,
        status: 'proposed',
        user1_approved_version: null,
        user2_approved_version: null,
        change_suggestion: null,
        change_requested_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('match_id', matchId)
      .select('*')
      .single()

    result = updated
  } else {
    // INITIAL CREATION
    const { data: created } = await supabaseAdmin
      .from('match_date_plans')
      .upsert({
        match_id: matchId,
        plan_text: planText,
        user1_id: user1Id,
        user2_id: user2Id,
        status: 'proposed',
        current_version: 1,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    result = created
  }

  return new Response(JSON.stringify({ plan: planText, datePlan: result }), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
})
