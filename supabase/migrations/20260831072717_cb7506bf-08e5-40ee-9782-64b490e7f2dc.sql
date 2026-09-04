CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TYPE public.app_role AS ENUM ('admin','moderator','user','support','finance');

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email text, full_name text, avatar_url text,
 credits_balance integer NOT NULL DEFAULT 20,
 preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role public.app_role NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE TABLE public.generations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 prompt text NOT NULL, media_type text NOT NULL DEFAULT 'image', resolution text, duration text, aspect_ratio text,
 media_url text, storage_path text, status text NOT NULL DEFAULT 'ready', duration_seconds integer NOT NULL DEFAULT 0,
 error_message text, submitted_public boolean NOT NULL DEFAULT false, moderation_status text NOT NULL DEFAULT 'pending',
 approved boolean NOT NULL DEFAULT false, rejection_reason text, moderated_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generations TO authenticated; GRANT SELECT ON public.generations TO anon; GRANT ALL ON public.generations TO service_role;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
CREATE INDEX generations_user_created_idx ON public.generations(user_id, created_at DESC);
CREATE POLICY "Users can view own generations" ON public.generations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own generations" ON public.generations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own generations" ON public.generations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own generations" ON public.generations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public can view approved community generations" ON public.generations FOR SELECT TO anon, authenticated USING (submitted_public AND approved AND moderation_status = 'approved');
CREATE POLICY "Staff can view all generations" ON public.generations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "Staff can moderate generations" ON public.generations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE TRIGGER update_generations_updated_at BEFORE UPDATE ON public.generations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 tier text NOT NULL DEFAULT 'free', status text NOT NULL DEFAULT 'active', started_at timestamptz NOT NULL DEFAULT now(),
 ends_at timestamptz, auto_renew boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated; GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.daily_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date, seconds_used integer NOT NULL DEFAULT 0,
 tier text NOT NULL DEFAULT 'free', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,usage_date)
);
GRANT SELECT ON public.daily_usage TO authenticated; GRANT ALL ON public.daily_usage TO service_role;
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON public.daily_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_daily_usage_updated_at BEFORE UPDATE ON public.daily_usage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.tier_daily_seconds(_tier text) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE _tier WHEN 'super_grok' THEN 190 WHEN 'superhearly' THEN 380 ELSE 30 END; $$;
CREATE OR REPLACE FUNCTION public.current_tier(_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT COALESCE((SELECT tier FROM public.subscriptions WHERE user_id=_user_id AND status='active' AND (ends_at IS NULL OR ends_at>now()) LIMIT 1),'free'); $$;
CREATE OR REPLACE FUNCTION public.reserve_quota(_user_id uuid,_seconds integer) RETURNS TABLE(allowed boolean,seconds_used integer,seconds_limit integer,tier text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_tier text:=public.current_tier(_user_id); v_limit integer:=public.tier_daily_seconds(v_tier); v_today date:=(now() AT TIME ZONE 'utc')::date; v_used integer; BEGIN INSERT INTO public.daily_usage(user_id,usage_date,seconds_used,tier) VALUES(_user_id,v_today,0,v_tier) ON CONFLICT(user_id,usage_date) DO UPDATE SET tier=v_tier RETURNING public.daily_usage.seconds_used INTO v_used; IF v_used+_seconds>v_limit THEN RETURN QUERY SELECT false,v_used,v_limit,v_tier; RETURN; END IF; UPDATE public.daily_usage SET seconds_used=public.daily_usage.seconds_used+_seconds WHERE user_id=_user_id AND usage_date=v_today RETURNING public.daily_usage.seconds_used INTO v_used; RETURN QUERY SELECT true,v_used,v_limit,v_tier; END; $$;
CREATE OR REPLACE FUNCTION public.refund_quota(_user_id uuid,_seconds integer) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE public.daily_usage SET seconds_used=GREATEST(0,seconds_used-_seconds) WHERE user_id=_user_id AND usage_date=(now() AT TIME ZONE 'utc')::date; $$;
REVOKE EXECUTE ON FUNCTION public.reserve_quota(uuid,integer) FROM PUBLIC,anon,authenticated; REVOKE EXECUTE ON FUNCTION public.refund_quota(uuid,integer) FROM PUBLIC,anon,authenticated; REVOKE EXECUTE ON FUNCTION public.current_tier(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_quota(uuid,integer), public.refund_quota(uuid,integer), public.current_tier(uuid) TO service_role; GRANT EXECUTE ON FUNCTION public.tier_daily_seconds(text) TO authenticated,service_role;

CREATE TABLE public.product_prices (
 id text PRIMARY KEY, label text NOT NULL, tier text NOT NULL, amount_eur numeric(10,2) NOT NULL CHECK(amount_eur>=0), amount_eur_yearly numeric,
 active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_prices TO anon,authenticated; GRANT ALL ON public.product_prices TO service_role;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view prices" ON public.product_prices FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY "Admins can update prices" ON public.product_prices FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Finance can update prices" ON public.product_prices FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'finance')) WITH CHECK(public.has_role(auth.uid(),'finance'));
CREATE TRIGGER update_product_prices_updated_at BEFORE UPDATE ON public.product_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.product_prices(id,label,tier,amount_eur,sort_order) VALUES ('base','Super grok','super_grok',35,1),('plus','Super grok plus','super_grok',79,2),('heavy','Super grok heavy','superhearly',349,3);

CREATE TABLE public.orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transaction_id uuid NOT NULL UNIQUE, user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 product_id text NOT NULL REFERENCES public.product_prices(id), tier text NOT NULL, period text NOT NULL DEFAULT 'monthly', status text NOT NULL DEFAULT 'en_attente',
 amount_eur numeric(10,2) NOT NULL, amount_local numeric(14,2) NOT NULL, currency text NOT NULL, exchange_rate numeric(16,6) NOT NULL,
 country_code text NOT NULL, payment_method text NOT NULL, mobile text NOT NULL, customer_name text NOT NULL, customer_email text NOT NULL,
 provider_message text, provider_response jsonb, webhook_payload jsonb, error_message text, payment_link text, provider_transaction_id text, last_checked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orders TO authenticated; GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT TO authenticated USING(auth.uid()=user_id);
CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Finance can view orders" ON public.orders FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'finance'));
CREATE INDEX orders_user_created_idx ON public.orders(user_id,created_at DESC); CREATE INDEX orders_status_idx ON public.orders(status); CREATE INDEX orders_provider_transaction_id_idx ON public.orders(provider_transaction_id);
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, tier text NOT NULL,
 amount numeric(10,2) NOT NULL, currency text NOT NULL DEFAULT 'EUR', reference text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending',
 provider text NOT NULL DEFAULT 'swychr', checkout_url text, error_message text, last_webhook_at timestamptz, last_webhook_status text,
 last_webhook_payload jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_attempts TO authenticated; GRANT ALL ON public.payment_attempts TO service_role;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payment attempts" ON public.payment_attempts FOR SELECT TO authenticated USING(auth.uid()=user_id);
CREATE POLICY "Admins can view all payment attempts" ON public.payment_attempts FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE INDEX payment_attempts_user_idx ON public.payment_attempts(user_id,created_at DESC);
CREATE TRIGGER update_payment_attempts_updated_at BEFORE UPDATE ON public.payment_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.team_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, role public.app_role NOT NULL, invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(email,role)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.team_invitations TO authenticated; GRANT ALL ON public.team_invitations TO service_role;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage invitations" ON public.team_invitations FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, email text, subject text NOT NULL,
 body text NOT NULL, status text NOT NULL DEFAULT 'ouvert', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON public.support_messages TO authenticated; GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own support messages" ON public.support_messages FOR INSERT TO authenticated WITH CHECK(auth.uid()=user_id);
CREATE POLICY "Users view own support messages" ON public.support_messages FOR SELECT TO authenticated USING(auth.uid()=user_id);
CREATE POLICY "Staff view support messages" ON public.support_messages FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));
CREATE POLICY "Staff update support messages" ON public.support_messages FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support')) WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));
CREATE TRIGGER update_support_messages_updated_at BEFORE UPDATE ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.support_replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, is_staff boolean NOT NULL DEFAULT false, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT ON public.support_replies TO authenticated; GRANT ALL ON public.support_replies TO service_role;
ALTER TABLE public.support_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view replies" ON public.support_replies FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support') OR EXISTS(SELECT 1 FROM public.support_messages m WHERE m.id=support_replies.message_id AND m.user_id=auth.uid()));
CREATE POLICY "Participants insert replies" ON public.support_replies FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support') OR EXISTS(SELECT 1 FROM public.support_messages m WHERE m.id=support_replies.message_id AND m.user_id=auth.uid())));

CREATE POLICY "Users read own generation files" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='generations' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "Users upload own generation files" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='generations' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "Users delete own generation files" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='generations' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "Users view own avatar" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text) WITH CHECK(bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.profiles(id,email,full_name,avatar_url) VALUES(NEW.id,NEW.email,COALESCE(NEW.raw_user_meta_data->>'full_name',NEW.raw_user_meta_data->>'name'),NEW.raw_user_meta_data->>'avatar_url') ON CONFLICT(id) DO NOTHING;
 IF lower(COALESCE(NEW.email,''))='bonjoceflash@gmail.com' THEN INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'admin') ON CONFLICT(user_id,role) DO NOTHING; END IF;
 INSERT INTO public.user_roles(user_id,role) SELECT NEW.id,ti.role FROM public.team_invitations ti WHERE lower(ti.email)=lower(COALESCE(NEW.email,'')) AND ti.accepted_at IS NULL ON CONFLICT(user_id,role) DO NOTHING;
 UPDATE public.team_invitations SET accepted_at=now() WHERE lower(email)=lower(COALESCE(NEW.email,'')) AND accepted_at IS NULL;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();