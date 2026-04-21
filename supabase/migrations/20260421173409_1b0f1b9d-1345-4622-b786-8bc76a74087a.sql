
INSERT INTO storage.buckets (id, name, public)
VALUES ('artworks', 'artworks', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Artworks are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'artworks');

CREATE POLICY "Users can upload their own artworks"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'artworks'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own artworks"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'artworks'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own artworks"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'artworks'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
