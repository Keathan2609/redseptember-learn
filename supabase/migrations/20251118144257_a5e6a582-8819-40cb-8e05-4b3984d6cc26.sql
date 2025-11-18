-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('student', 'facilitator')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  facilitator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create course modules table
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create course enrollments table
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  progress INTEGER DEFAULT 0,
  UNIQUE(course_id, student_id)
);

-- Create assessments table
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  total_points INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create submissions table
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  grade INTEGER,
  feedback TEXT,
  graded_at TIMESTAMPTZ,
  UNIQUE(assessment_id, student_id)
);

-- Create resources table
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create calendar events table
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create discussion forum table
CREATE TABLE public.forum_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create forum replies table
CREATE TABLE public.forum_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for courses
CREATE POLICY "Anyone can view courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Facilitators can create courses" ON public.courses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'facilitator')
);
CREATE POLICY "Facilitators can update own courses" ON public.courses FOR UPDATE USING (facilitator_id = auth.uid());
CREATE POLICY "Facilitators can delete own courses" ON public.courses FOR DELETE USING (facilitator_id = auth.uid());

-- RLS Policies for modules
CREATE POLICY "Anyone can view modules" ON public.modules FOR SELECT USING (true);
CREATE POLICY "Facilitators can manage modules" ON public.modules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = modules.course_id AND courses.facilitator_id = auth.uid())
);

-- RLS Policies for enrollments
CREATE POLICY "Users can view own enrollments" ON public.enrollments FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students can enroll themselves" ON public.enrollments FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students can update own enrollment progress" ON public.enrollments FOR UPDATE USING (student_id = auth.uid());

-- RLS Policies for assessments
CREATE POLICY "Enrolled students can view assessments" ON public.assessments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.enrollments e ON e.course_id = m.course_id
    WHERE m.id = assessments.module_id AND e.student_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = assessments.module_id AND c.facilitator_id = auth.uid()
  )
);
CREATE POLICY "Facilitators can manage assessments" ON public.assessments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = assessments.module_id AND c.facilitator_id = auth.uid()
  )
);

-- RLS Policies for submissions
CREATE POLICY "Students can view own submissions" ON public.submissions FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Facilitators can view all submissions" ON public.submissions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.assessments a
    JOIN public.modules m ON m.id = a.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE a.id = submissions.assessment_id AND c.facilitator_id = auth.uid()
  )
);
CREATE POLICY "Students can submit" ON public.submissions FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students can update own submissions" ON public.submissions FOR UPDATE USING (student_id = auth.uid() AND grade IS NULL);
CREATE POLICY "Facilitators can grade submissions" ON public.submissions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.assessments a
    JOIN public.modules m ON m.id = a.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE a.id = submissions.assessment_id AND c.facilitator_id = auth.uid()
  )
);

-- RLS Policies for resources
CREATE POLICY "Enrolled users can view resources" ON public.resources FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = resources.course_id AND student_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.courses WHERE id = resources.course_id AND facilitator_id = auth.uid())
);
CREATE POLICY "Facilitators can manage resources" ON public.resources FOR ALL USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = resources.course_id AND facilitator_id = auth.uid())
);

-- RLS Policies for calendar events
CREATE POLICY "Enrolled users can view events" ON public.calendar_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = calendar_events.course_id AND student_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.courses WHERE id = calendar_events.course_id AND facilitator_id = auth.uid())
);
CREATE POLICY "Facilitators can manage events" ON public.calendar_events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = calendar_events.course_id AND facilitator_id = auth.uid())
);

-- RLS Policies for forum posts
CREATE POLICY "Enrolled users can view posts" ON public.forum_posts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = forum_posts.course_id AND student_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.courses WHERE id = forum_posts.course_id AND facilitator_id = auth.uid())
);
CREATE POLICY "Enrolled users can create posts" ON public.forum_posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = forum_posts.course_id AND student_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.courses WHERE id = forum_posts.course_id AND facilitator_id = auth.uid())
);
CREATE POLICY "Authors can update own posts" ON public.forum_posts FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Authors can delete own posts" ON public.forum_posts FOR DELETE USING (author_id = auth.uid());

-- RLS Policies for forum replies
CREATE POLICY "Users can view replies to visible posts" ON public.forum_replies FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.forum_posts p
    WHERE p.id = forum_replies.post_id AND (
      EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = p.course_id AND student_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.courses WHERE id = p.course_id AND facilitator_id = auth.uid())
    )
  )
);
CREATE POLICY "Enrolled users can reply" ON public.forum_replies FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forum_posts p
    WHERE p.id = forum_replies.post_id AND (
      EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = p.course_id AND student_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.courses WHERE id = p.course_id AND facilitator_id = auth.uid())
    )
  )
);
CREATE POLICY "Authors can update own replies" ON public.forum_replies FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Authors can delete own replies" ON public.forum_replies FOR DELETE USING (author_id = auth.uid());

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_forum_posts_updated_at BEFORE UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();