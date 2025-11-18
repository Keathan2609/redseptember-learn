-- Create storage bucket for course thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-thumbnails', 'course-thumbnails', true);

-- Create policy for viewing thumbnails (public)
CREATE POLICY "Course thumbnails are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'course-thumbnails');

-- Create policy for uploading thumbnails (facilitators only)
CREATE POLICY "Facilitators can upload course thumbnails"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'course-thumbnails' 
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'facilitator'
);

-- Create policy for updating thumbnails (facilitators only, own courses)
CREATE POLICY "Facilitators can update their course thumbnails"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'course-thumbnails'
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'facilitator'
);

-- Create policy for deleting thumbnails (facilitators only, own courses)
CREATE POLICY "Facilitators can delete their course thumbnails"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'course-thumbnails'
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'facilitator'
);