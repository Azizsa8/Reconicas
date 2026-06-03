-- Lead capture from the landing page. Public-write via service-role only —
-- no RLS-allowed insert path, because anonymous users post to /api/leads
-- which uses the service key.
--
-- Apply by pasting the contents into Supabase SQL Editor.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  company text,
  message text,
  source text not null default 'landing',
  user_agent text,
  ip_hash text, -- sha-256 hex; never store raw IP
  utm jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_desc on public.leads (created_at desc);
create index if not exists leads_email on public.leads (lower(email));

-- RLS on but no policies: only service-role inserts can succeed.
-- Authenticated users see nothing through this table.
alter table public.leads enable row level security;
