-- Create table to track resource views
CREATE TABLE public.resource_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(resource_id, student_id)
);

-- Enable RLS
ALTER TABLE public.resource_views ENABLE ROW LEVEL SECURITY;

-- Students can view their own resource views
CREATE POLICY "Students can view own resource views"
ON public.resource_views
FOR SELECT
USING (auth.uid() = student_id);

-- Students can insert their own resource views
CREATE POLICY "Students can track own resource views"
ON public.resource_views
FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Facilitators can view resource views for their courses
CREATE POLICY "Facilitators can view course resource views"
ON public.resource_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM resources r
    JOIN courses c ON c.id = r.course_id
    WHERE r.id = resource_views.resource_id
    AND c.facilitator_id = auth.uid()
  )
);

-- Create index for better query performance
CREATE INDEX idx_resource_views_student_id ON public.resource_views(student_id);
CREATE INDEX idx_resource_views_resource_id ON public.resource_views(resource_id);

-- Function to calculate module completion percentage
CREATE OR REPLACE FUNCTION get_module_completion(
  p_module_id UUID,
  p_student_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  total_assessments INT;
  completed_assessments INT;
  total_resources INT;
  viewed_resources INT;
  total_items INT;
  completed_items INT;
BEGIN
  -- Count total assessments in module
  SELECT COUNT(*) INTO total_assessments
  FROM assessments
  WHERE module_id = p_module_id;
  
  -- Count completed assessments (submissions) for student
  SELECT COUNT(DISTINCT a.id) INTO completed_assessments
  FROM assessments a
  JOIN submissions s ON s.assessment_id = a.id
  WHERE a.module_id = p_module_id
  AND s.student_id = p_student_id;
  
  -- Count total resources in module
  SELECT COUNT(*) INTO total_resources
  FROM resources
  WHERE module_id = p_module_id;
  
  -- Count viewed resources for student
  SELECT COUNT(DISTINCT r.id) INTO viewed_resources
  FROM resources r
  JOIN resource_views rv ON rv.resource_id = r.id
  WHERE r.module_id = p_module_id
  AND rv.student_id = p_student_id;
  
  -- Calculate total items and completed items
  total_items := total_assessments + total_resources;
  completed_items := completed_assessments + viewed_resources;
  
  -- Return percentage (avoid division by zero)
  IF total_items = 0 THEN
    RETURN 100;
  ELSE
    RETURN ROUND((completed_items::NUMERIC / total_items::NUMERIC) * 100, 0);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;