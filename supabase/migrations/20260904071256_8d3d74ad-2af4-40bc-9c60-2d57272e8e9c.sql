CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Prevent regular users from posting replies that look like official staff answers.
DROP POLICY IF EXISTS "Participants insert replies" ON public.support_replies;

CREATE POLICY "Participants insert replies"
ON public.support_replies
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    is_staff = false
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support')
    OR public.has_role(auth.uid(), 'moderator')
  )
  AND EXISTS (
    SELECT 1 FROM public.support_messages m
    WHERE m.id = support_replies.message_id
      AND (
        m.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'support')
        OR public.has_role(auth.uid(), 'moderator')
      )
  )
);