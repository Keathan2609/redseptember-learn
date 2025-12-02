-- Add module_id column to resources table
ALTER TABLE public.resources 
ADD COLUMN module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_resources_module_id ON public.resources(module_id);

-- Update RLS policies to include module-based access
DROP POLICY IF EXISTS "Enrolled users can view resources" ON public.resources;
DROP POLICY IF EXISTS "Facilitators can manage resources" ON public.resources;

-- Recreate policies with module support
CREATE POLICY "Enrolled users can view resources"
ON public.resources
FOR SELECT
USING (
  -- Course-level resources (no module)
  (module_id IS NULL AND (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = resources.course_id
      AND enrollments.student_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = resources.course_id
      AND courses.facilitator_id = auth.uid()
    )
  ))
  OR
  -- Module-level resources
  (module_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN enrollments e ON e.course_id = m.course_id
      WHERE m.id = resources.module_id
      AND e.student_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM modules m
      JOIN courses c ON c.id = m.course_id
      WHERE m.id = resources.module_id
      AND c.facilitator_id = auth.uid()
    )
  ))
);

CREATE POLICY "Facilitators can manage resources"
ON public.resources
FOR ALL
USING (
  -- Course-level resources
  (module_id IS NULL AND EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = resources.course_id
    AND courses.facilitator_id = auth.uid()
  ))
  OR
  -- Module-level resources
  (module_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM modules m
    JOIN courses c ON c.id = m.course_id
    WHERE m.id = resources.module_id
    AND c.facilitator_id = auth.uid()
  ))
);