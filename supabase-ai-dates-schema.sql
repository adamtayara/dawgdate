-- AI First Date System — run in Supabase SQL Editor
-- Run this after supabase-schema.sql

-- 1. Add date AI columns to profiles (public-facing)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_personality TEXT,
  ADD COLUMN IF NOT EXISTS date_vibe_summary TEXT,
  ADD COLUMN IF NOT EXISTS date_vibe_vector JSONB;
-- date_vibe_vector is a safe 6-field subset: {setting, formality, energy, mood, time_of_day, budget}
-- It is used for client-side compatibility scoring without exposing private details.

-- 2. Private first-date preference storage
CREATE TABLE IF NOT EXISTS first_date_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  raw_input TEXT NOT NULL,
  input_method TEXT NOT NULL DEFAULT 'text', -- 'text' | 'voice'
  structured_prefs JSONB,  -- full private preference object
  date_personality TEXT,
  vibe_summary TEXT,       -- same as profiles.date_vibe_summary (source of truth here)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 3. Generated date plans per match
CREATE TABLE IF NOT EXISTS match_date_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  plan_text TEXT NOT NULL,
  regeneration_history JSONB DEFAULT '[]'::JSONB,
  feedback TEXT, -- 'accurate' | 'too_fancy' | 'too_boring' | 'perfect' | 'not_our_vibe'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id)
);

-- 4. Enable RLS
ALTER TABLE first_date_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_date_plans ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for first_date_preferences
-- Users can only read/write their own preferences (raw input stays private)
CREATE POLICY "Users own their date preferences" ON first_date_preferences
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. RLS Policies for match_date_plans
-- Both participants in a match can read the generated plan
CREATE POLICY "Match participants can read date plans" ON match_date_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_date_plans.match_id
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- Edge functions use service_role key which bypasses RLS — no insert policy needed for plans

-- 7. Allow users to submit feedback on their match date plans
CREATE POLICY "Match participants can update feedback" ON match_date_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_date_plans.match_id
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- 8. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_first_date_preferences_user_id ON first_date_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_match_date_plans_match_id ON match_date_plans(match_id);
