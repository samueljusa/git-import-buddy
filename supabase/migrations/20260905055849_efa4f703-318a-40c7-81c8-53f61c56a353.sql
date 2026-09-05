ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_type text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.subscriptions
SET plan_type = CASE WHEN tier = 'superhearly' THEN 'superhearly_monthly'
                     WHEN tier = 'super_grok' THEN 'super_grok_monthly'
                     ELSE plan_type END
WHERE plan_type IS NULL;

CREATE TABLE IF NOT EXISTS public.user_quotas (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_video_limit_seconds integer NOT NULL DEFAULT 30,
  daily_video_used_seconds integer NOT NULL DEFAULT 0,
  daily_video_remaining_seconds integer NOT NULL DEFAULT 30,
  quota_period_start timestamptz NOT NULL DEFAULT now(),
  quota_period_end timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_quotas TO authenticated;
GRANT ALL ON public.user_quotas TO service_role;
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quota" ON public.user_quotas;
CREATE POLICY "Users can view own quota" ON public.user_quotas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_quotas_updated_at ON public.user_quotas;
CREATE TRIGGER update_user_quotas_updated_at BEFORE UPDATE ON public.user_quotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.plan_video_seconds(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan
    WHEN 'super_grok_monthly' THEN 190
    WHEN 'superhearly_monthly' THEN 380
    WHEN 'super_grok_annuel' THEN 950
    WHEN 'super_grok_plus' THEN 1900
    WHEN 'super_grok' THEN 190
    WHEN 'superhearly' THEN 380
    ELSE 30
  END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_video_seconds(_user_id uuid, _seconds integer)
RETURNS TABLE(
  allowed boolean,
  reason text,
  plan_type text,
  limit_seconds integer,
  used_seconds integer,
  remaining_seconds integer,
  period_end timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expired boolean := false;
  v_plan text := 'free';
  v_expires timestamptz;
  v_limit integer;
  v_used integer;
  v_pstart timestamptz;
  v_pend timestamptz;
BEGIN
  -- Désactive les abonnements arrivés à expiration.
  UPDATE public.subscriptions
     SET is_active = false, status = 'expired'
   WHERE user_id = _user_id AND status = 'active'
     AND ends_at IS NOT NULL AND ends_at <= now();
  v_expired := FOUND;

  SELECT COALESCE(s.plan_type, s.tier), s.ends_at
    INTO v_plan, v_expires
    FROM public.subscriptions s
   WHERE s.user_id = _user_id AND s.status = 'active' AND s.is_active
     AND (s.ends_at IS NULL OR s.ends_at > now())
   ORDER BY s.started_at DESC
   LIMIT 1;

  v_plan := COALESCE(v_plan, 'free');
  v_limit := public.plan_video_seconds(v_plan);

  INSERT INTO public.user_quotas(user_id, daily_video_limit_seconds, daily_video_used_seconds,
                                 daily_video_remaining_seconds, quota_period_start, quota_period_end)
  VALUES (_user_id, v_limit, 0, v_limit, now(), now() + interval '24 hours')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT q.daily_video_used_seconds, q.quota_period_start, q.quota_period_end
    INTO v_used, v_pstart, v_pend
    FROM public.user_quotas q WHERE q.user_id = _user_id;

  -- Période glissante de 24 h : réinitialisation dès que la fenêtre est dépassée.
  IF now() > v_pend THEN
    v_used := 0;
    v_pstart := now();
    v_pend := now() + interval '24 hours';
  END IF;

  UPDATE public.user_quotas q
     SET daily_video_limit_seconds = v_limit,
         daily_video_used_seconds = v_used,
         daily_video_remaining_seconds = GREATEST(0, v_limit - v_used),
         quota_period_start = v_pstart,
         quota_period_end = v_pend
   WHERE q.user_id = _user_id;

  IF v_expired AND v_plan = 'free' THEN
    RETURN QUERY SELECT false, 'subscription_expired', v_plan, v_limit, v_used,
                        GREATEST(0, v_limit - v_used), v_pend, v_expires;
    RETURN;
  END IF;

  IF _seconds > 0 AND v_used + _seconds > v_limit THEN
    RETURN QUERY SELECT false, 'video_seconds', v_plan, v_limit, v_used,
                        GREATEST(0, v_limit - v_used), v_pend, v_expires;
    RETURN;
  END IF;

  IF _seconds > 0 THEN
    UPDATE public.user_quotas q
       SET daily_video_used_seconds = v_used + _seconds,
           daily_video_remaining_seconds = GREATEST(0, v_limit - (v_used + _seconds))
     WHERE q.user_id = _user_id;
    v_used := v_used + _seconds;
  END IF;

  RETURN QUERY SELECT true, 'ok', v_plan, v_limit, v_used,
                      GREATEST(0, v_limit - v_used), v_pend, v_expires;
END; $$;

CREATE OR REPLACE FUNCTION public.refund_video_seconds(_user_id uuid, _seconds integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_quotas
     SET daily_video_used_seconds = GREATEST(0, daily_video_used_seconds - _seconds),
         daily_video_remaining_seconds = LEAST(daily_video_limit_seconds,
             daily_video_limit_seconds - GREATEST(0, daily_video_used_seconds - _seconds))
   WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.tier_daily_seconds(_tier text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT public.plan_video_seconds(_tier);
$$;