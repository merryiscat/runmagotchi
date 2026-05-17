-- eggs 스토리지 버킷 생성 (공개 읽기)
INSERT INTO storage.buckets (id, name, public)
VALUES ('eggs', 'eggs', true)
ON CONFLICT (id) DO NOTHING;
