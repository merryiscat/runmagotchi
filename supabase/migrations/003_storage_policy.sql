-- eggs 버킷 Storage 정책: 로그인 사용자 업로드 + 누구나 읽기
CREATE POLICY "eggs_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'eggs');
CREATE POLICY "eggs_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'eggs' AND auth.uid() IS NOT NULL);
CREATE POLICY "eggs_auth_update" ON storage.objects FOR UPDATE USING (bucket_id = 'eggs' AND auth.uid() IS NOT NULL);
