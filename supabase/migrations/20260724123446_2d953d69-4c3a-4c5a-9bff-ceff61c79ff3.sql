
CREATE TABLE public.player_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, activity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_activities TO authenticated;
GRANT ALL ON public.player_activities TO service_role;

ALTER TABLE public.player_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own player_activities" ON public.player_activities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_player_activities_player ON public.player_activities(player_id);
CREATE INDEX idx_player_activities_activity ON public.player_activities(activity_id);

-- Backfill from existing players.activity_id
INSERT INTO public.player_activities (user_id, player_id, activity_id)
SELECT user_id, id, activity_id FROM public.players
WHERE activity_id IS NOT NULL
ON CONFLICT DO NOTHING;
