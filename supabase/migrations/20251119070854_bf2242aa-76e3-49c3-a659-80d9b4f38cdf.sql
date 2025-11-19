-- Create storage bucket for course resources
INSERT INTO storage.buckets (id, name, public) 
VALUES ('course-resources', 'course-resources', true);

-- RLS policies for course resources bucket
CREATE POLICY "Anyone can view course resources"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-resources');

CREATE POLICY "Facilitators can upload course resources"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-resources' AND
  auth.uid() IN (
    SELECT facilitator_id FROM courses
  )
);

CREATE POLICY "Facilitators can update own course resources"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-resources' AND
  auth.uid() IN (
    SELECT facilitator_id FROM courses
  )
);

CREATE POLICY "Facilitators can delete own course resources"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-resources' AND
  auth.uid() IN (
    SELECT facilitator_id FROM courses
  )
);