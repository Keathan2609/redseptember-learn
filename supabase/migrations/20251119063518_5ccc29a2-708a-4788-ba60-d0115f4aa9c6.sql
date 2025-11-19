-- Add questions field to assessments table to store question data
ALTER TABLE public.assessments 
ADD COLUMN questions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN assessment_type TEXT DEFAULT 'assignment' CHECK (assessment_type IN ('assignment', 'quiz', 'exam'));

-- Add index for better query performance
CREATE INDEX idx_assessments_module_id ON public.assessments(module_id);
CREATE INDEX idx_enrollments_student_course ON public.enrollments(student_id, course_id);

-- Update submissions table to store answers for quizzes
ALTER TABLE public.submissions
ADD COLUMN answers JSONB DEFAULT '{}'::jsonb,
ADD COLUMN auto_grade INTEGER;