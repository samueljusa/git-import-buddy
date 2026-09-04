REVOKE EXECUTE ON FUNCTION public.reserve_media_quota(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refund_media_quota(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.reserve_media_quota(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_media_quota(uuid, text) TO service_role;