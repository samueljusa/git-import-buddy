CREATE POLICY "Utilisateurs lisent leurs medias"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'generations' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Equipe lit tous les medias"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'generations'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  );

CREATE POLICY "Utilisateurs suppriment leurs medias"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'generations' AND (storage.foldername(name))[1] = auth.uid()::text);