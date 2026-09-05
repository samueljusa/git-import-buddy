REVOKE ALL ON FUNCTION public.reserve_video_seconds(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_video_seconds(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_video_seconds(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_video_seconds(uuid, integer) TO service_role;