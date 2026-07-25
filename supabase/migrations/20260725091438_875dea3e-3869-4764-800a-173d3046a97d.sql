
CREATE POLICY "logos authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'logos');

CREATE POLICY "logos users upload own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "logos users update own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "logos users delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);
