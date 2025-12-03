-- Create live sessions table for video conferencing
CREATE TABLE public.live_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  meeting_url TEXT,
  meeting_provider TEXT DEFAULT 'zoom',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled'))
);

-- Create session attendance table
CREATE TABLE public.session_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(session_id, student_id)
);

-- Create gradebook entries table for comprehensive grade tracking
CREATE TABLE public.gradebook_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
  grade NUMERIC(5,2),
  weight NUMERIC(3,2) DEFAULT 1.0,
  notes TEXT,
  graded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id, assessment_id)
);

-- Enable RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_entries ENABLE ROW LEVEL SECURITY;

-- Live sessions policies
CREATE POLICY "Enrolled users can view sessions" ON public.live_sessions
FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments WHERE enrollments.course_id = live_sessions.course_id AND enrollments.student_id = auth.uid())
  OR EXISTS (SELECT 1 FROM courses WHERE courses.id = live_sessions.course_id AND courses.facilitator_id = auth.uid())
);

CREATE POLICY "Facilitators can manage sessions" ON public.live_sessions
FOR ALL USING (
  EXISTS (SELECT 1 FROM courses WHERE courses.id = live_sessions.course_id AND courses.facilitator_id = auth.uid())
);

-- Session attendance policies
CREATE POLICY "Students can mark own attendance" ON public.session_attendance
FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Users can view own attendance" ON public.session_attendance
FOR SELECT USING (
  student_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM live_sessions ls 
    JOIN courses c ON c.id = ls.course_id 
    WHERE ls.id = session_attendance.session_id AND c.facilitator_id = auth.uid()
  )
);

CREATE POLICY "Students can update own attendance" ON public.session_attendance
FOR UPDATE USING (student_id = auth.uid());

-- Gradebook policies
CREATE POLICY "Students can view own grades" ON public.gradebook_entries
FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Facilitators can manage gradebook" ON public.gradebook_entries
FOR ALL USING (
  EXISTS (SELECT 1 FROM courses WHERE courses.id = gradebook_entries.course_id AND courses.facilitator_id = auth.uid())
);

CREATE POLICY "Facilitators can view course grades" ON public.gradebook_entries
FOR SELECT USING (
  EXISTS (SELECT 1 FROM courses WHERE courses.id = gradebook_entries.course_id AND courses.facilitator_id = auth.uid())
);