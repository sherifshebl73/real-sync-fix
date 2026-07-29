ALTER TABLE public.player_activities
  ADD COLUMN IF NOT EXISTS total_sessions integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS remaining_sessions integer NOT NULL DEFAULT 8;

-- Backfill from players for existing links
UPDATE public.player_activities pa
SET total_sessions = p.total_sessions,
    remaining_sessions = p.remaining_sessions
FROM public.players p
WHERE pa.player_id = p.id;