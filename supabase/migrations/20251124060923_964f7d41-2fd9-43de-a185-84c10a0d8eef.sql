-- Add RLS policy for facilitators to view enrollments in their courses
CREATE POLICY "Facilitators can view course enrollments"
ON public.enrollments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = enrollments.course_id
    AND courses.facilitator_id = auth.uid()
  )
);