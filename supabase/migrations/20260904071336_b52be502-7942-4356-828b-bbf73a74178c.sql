-- 1. Galerie communautaire centralisée
CREATE TABLE public.community_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid REFERENCES public.generations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  media_url text,
  storage_path text,
  status text NOT NULL DEFAULT 'en_attente',
  rejection_reason text,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX community_gallery_status_idx ON public.community_gallery(status, created_at DESC);
CREATE INDEX community_gallery_user_idx ON public.community_gallery(user_id);

GRANT SELECT ON public.community_gallery TO anon;
GRANT SELECT, UPDATE, DELETE ON public.community_gallery TO authenticated;
GRANT ALL ON public.community_gallery TO service_role;

ALTER TABLE public.community_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir les creations approuvees"
  ON public.community_gallery FOR SELECT TO anon, authenticated
  USING (status = 'approuve');

CREATE POLICY "Auteur voit ses creations"
  ON public.community_gallery FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Equipe voit tout"
  ON public.community_gallery FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Equipe modere"
  ON public.community_gallery FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Equipe supprime"
  ON public.community_gallery FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TRIGGER update_community_gallery_updated_at
  BEFORE UPDATE ON public.community_gallery
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Compteurs d'usage images / vidéos + pause de 3 h
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS images_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS videos_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_pause_until timestamptz;

CREATE OR REPLACE FUNCTION public.reserve_media_quota(_user_id uuid, _media_type text)
RETURNS TABLE(allowed boolean, reason text, retry_at timestamptz, images_used integer, videos_used integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text := public.current_tier(_user_id);
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_img integer;
  v_vid integer;
  v_pause timestamptz;
  v_tomorrow timestamptz := ((v_today + 1)::timestamp AT TIME ZONE 'utc');
BEGIN
  INSERT INTO public.daily_usage(user_id, usage_date, seconds_used, tier)
  VALUES (_user_id, v_today, 0, v_tier)
  ON CONFLICT (user_id, usage_date) DO UPDATE SET tier = v_tier;

  SELECT du.images_used, du.videos_used, du.video_pause_until
    INTO v_img, v_vid, v_pause
  FROM public.daily_usage du
  WHERE du.user_id = _user_id AND du.usage_date = v_today;

  IF v_tier <> 'free' THEN
    IF _media_type = 'image' THEN
      UPDATE public.daily_usage du SET images_used = du.images_used + 1
        WHERE du.user_id = _user_id AND du.usage_date = v_today;
    ELSE
      UPDATE public.daily_usage du SET videos_used = du.videos_used + 1
        WHERE du.user_id = _user_id AND du.usage_date = v_today;
    END IF;
    RETURN QUERY SELECT true, 'ok'::text, NULL::timestamptz, v_img, v_vid;
    RETURN;
  END IF;

  IF _media_type = 'image' THEN
    IF v_img >= 5 THEN
      RETURN QUERY SELECT false, 'image_daily'::text, v_tomorrow, v_img, v_vid;
      RETURN;
    END IF;
    UPDATE public.daily_usage du SET images_used = du.images_used + 1
      WHERE du.user_id = _user_id AND du.usage_date = v_today
      RETURNING du.images_used INTO v_img;
    RETURN QUERY SELECT true, 'ok'::text, NULL::timestamptz, v_img, v_vid;
    RETURN;
  END IF;

  IF v_vid >= 9 THEN
    RETURN QUERY SELECT false, 'video_daily'::text, v_tomorrow, v_img, v_vid;
    RETURN;
  END IF;

  IF v_pause IS NOT NULL AND v_pause > now() THEN
    RETURN QUERY SELECT false, 'video_pause'::text, v_pause, v_img, v_vid;
    RETURN;
  END IF;

  UPDATE public.daily_usage du SET videos_used = du.videos_used + 1
    WHERE du.user_id = _user_id AND du.usage_date = v_today
    RETURNING du.videos_used INTO v_vid;

  IF v_vid = 5 THEN
    UPDATE public.daily_usage du SET video_pause_until = now() + interval '3 hours'
      WHERE du.user_id = _user_id AND du.usage_date = v_today;
  END IF;

  RETURN QUERY SELECT true, 'ok'::text, NULL::timestamptz, v_img, v_vid;
END; $$;

CREATE OR REPLACE FUNCTION public.refund_media_quota(_user_id uuid, _media_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF _media_type = 'image' THEN
    UPDATE public.daily_usage du SET images_used = GREATEST(0, du.images_used - 1)
      WHERE du.user_id = _user_id AND du.usage_date = v_today;
  ELSE
    UPDATE public.daily_usage du
      SET videos_used = GREATEST(0, du.videos_used - 1),
          video_pause_until = CASE WHEN du.videos_used - 1 < 5 THEN NULL ELSE du.video_pause_until END
      WHERE du.user_id = _user_id AND du.usage_date = v_today;
  END IF;
END; $$;

-- 3. Réglages application (offre promotionnelle)
CREATE TABLE public.app_settings (
  id text PRIMARY KEY,
  promo_enabled boolean NOT NULL DEFAULT false,
  promo_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des reglages"
  ON public.app_settings FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins modifient les reglages"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT UPDATE ON public.app_settings TO authenticated;

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings(id, promo_enabled, promo_prices)
VALUES ('global', false, '{"base": 0, "plus": null, "heavy": null}'::jsonb);

REVOKE EXECUTE ON FUNCTION public.reserve_media_quota(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refund_media_quota(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.reserve_media_quota(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_media_quota(uuid, text) TO service_role;

CREATE POLICY "Equipe lit tous les medias"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'generations'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  );