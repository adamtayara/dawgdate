-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- 1. Profiles table
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  age integer not null check (age >= 18),
  bio text default '',
  photo_url text default '',
  major text default '',
  created_at timestamptz default now()
);

-- 2. Swipes table
create table swipes (
  id uuid default gen_random_uuid() primary key,
  swiper_id uuid references profiles(id) on delete cascade not null,
  swiped_id uuid references profiles(id) on delete cascade not null,
  direction text not null check (direction in ('left', 'right')),
  created_at timestamptz default now(),
  unique(swiper_id, swiped_id)
);

-- 3. Matches table (created when mutual like)
create table matches (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references profiles(id) on delete cascade not null,
  user2_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- 4. Messages table
create table messages (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);

-- 5. Enable Row Level Security on all tables
alter table profiles enable row level security;
alter table swipes enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;

-- 6. RLS Policies

-- Profiles: anyone logged in can read, only own profile can update
create policy "Anyone can view profiles" on profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Swipes: users can insert their own swipes, read own swipes
create policy "Users can insert own swipes" on swipes
  for insert with check (auth.uid() = swiper_id);

create policy "Users can read own swipes" on swipes
  for select using (auth.uid() = swiper_id);

-- Matches: users can read their own matches
create policy "Users can read own matches" on matches
  for select using (auth.uid() = user1_id or auth.uid() = user2_id);

create policy "Authenticated users can insert matches" on matches
  for insert with check (auth.uid() = user1_id or auth.uid() = user2_id);

-- Messages: users can read/send in their matches
create policy "Users can read messages in their matches" on messages
  for select using (
    exists (
      select 1 from matches
      where matches.id = messages.match_id
      and (matches.user1_id = auth.uid() or matches.user2_id = auth.uid())
    )
  );

create policy "Users can send messages in their matches" on messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from matches
      where matches.id = messages.match_id
      and (matches.user1_id = auth.uid() or matches.user2_id = auth.uid())
    )
  );

-- 7. Enable Realtime on messages
alter publication supabase_realtime add table messages;

-- 8. Function to check for mutual match after a swipe
create or replace function check_match()
returns trigger as $$
declare
  mutual_swipe_exists boolean;
  new_match_id uuid;
begin
  -- Only check on right swipes (likes)
  if NEW.direction = 'right' then
    -- Check if the other person also swiped right on us
    select exists(
      select 1 from swipes
      where swiper_id = NEW.swiped_id
      and swiped_id = NEW.swiper_id
      and direction = 'right'
    ) into mutual_swipe_exists;

    if mutual_swipe_exists then
      -- Create a match (smaller uuid first for consistency)
      insert into matches (user1_id, user2_id)
      values (
        least(NEW.swiper_id, NEW.swiped_id),
        greatest(NEW.swiper_id, NEW.swiped_id)
      )
      on conflict do nothing;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- 9. Trigger to auto-check match on new swipe
create trigger on_swipe_check_match
  after insert on swipes
  for each row
  execute function check_match();
