import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, CheckCircle } from "lucide-react";
import { CourseDialog } from "@/components/courses/CourseDialog";
import { toast } from "sonner";

const Courses = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<any>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(profileData);

        if (profileData?.role === "student") {
          const { data } = await supabase
            .from("enrollments")
            .select("*, courses(*)")
            .eq("student_id", user.id);
          setCourses(data?.map((e) => e.courses) || []);
          
          const enrolledCourseIds = new Set(data?.map((e) => e.courses.id) || []);
          setEnrolledIds(enrolledCourseIds);

          // Fetch all available courses
          const { data: allCoursesData } = await supabase
            .from("courses")
            .select("*, profiles(full_name)");
          setAllCourses(allCoursesData || []);
        } else if (profileData?.role === "facilitator") {
          const { data } = await supabase
            .from("courses")
            .select("*")
            .eq("facilitator_id", user.id);
          setCourses(data || []);
        }
      }
    };

    fetchData();
  }, []);

  const handleCourseCreated = () => {
    // Refresh courses list
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(profileData);

        if (profileData?.role === "student") {
          const { data } = await supabase
            .from("enrollments")
            .select("*, courses(*)")
            .eq("student_id", user.id);
          setCourses(data?.map((e) => e.courses) || []);
          
          const enrolledCourseIds = new Set(data?.map((e) => e.courses.id) || []);
          setEnrolledIds(enrolledCourseIds);

          const { data: allCoursesData } = await supabase
            .from("courses")
            .select("*, profiles(full_name)");
          setAllCourses(allCoursesData || []);
        } else if (profileData?.role === "facilitator") {
          const { data } = await supabase
            .from("courses")
            .select("*")
            .eq("facilitator_id", user.id);
          setCourses(data || []);
        }
      }
    };
    fetchData();
  };

  const handleEnroll = async (courseId: string) => {
    setEnrolling(courseId);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("Please log in to enroll");
      setEnrolling(null);
      return;
    }

    const { error } = await supabase
      .from("enrollments")
      .insert({ student_id: user.id, course_id: courseId });

    if (error) {
      toast.error("Failed to enroll in course");
    } else {
      toast.success("Successfully enrolled!");
      handleCourseCreated();
    }
    setEnrolling(null);
  };

  const renderCourseCard = (course: any, showEnrollButton = false) => (
    <Card key={course.id} className="border-border bg-card hover:shadow-glow transition-smooth">
      <CardHeader>
        {course.thumbnail_url ? (
          <div className="aspect-video rounded-lg mb-4 overflow-hidden">
            <img 
              src={course.thumbnail_url} 
              alt={course.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-video bg-gradient-primary rounded-lg mb-4 flex items-center justify-center">
            <BookOpen className="h-16 w-16 text-primary-foreground/50" />
          </div>
        )}
        <CardTitle>{course.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {course.description || "No description available"}
        </CardDescription>
        {course.profiles?.full_name && (
          <p className="text-sm text-muted-foreground mt-2">
            By {course.profiles.full_name}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {showEnrollButton ? (
          enrolledIds.has(course.id) ? (
            <Button variant="secondary" className="w-full" disabled>
              <CheckCircle className="mr-2 h-4 w-4" />
              Enrolled
            </Button>
          ) : (
            <Button 
              className="w-full"
              onClick={() => handleEnroll(course.id)}
              disabled={enrolling === course.id}
            >
              {enrolling === course.id ? "Enrolling..." : "Enroll Now"}
            </Button>
          )
        ) : null}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigate(`/courses/${course.id}`)}
        >
          View Course
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Courses</h1>
            <p className="text-muted-foreground">
              {profile?.role === "student" ? "Browse and enroll in courses" : "Courses you manage"}
            </p>
          </div>
          {profile?.role === "facilitator" && (
            <CourseDialog onCourseCreated={handleCourseCreated} />
          )}
        </div>

        {profile?.role === "student" ? (
          <Tabs defaultValue="enrolled" className="w-full">
            <TabsList className="mb-8">
              <TabsTrigger value="enrolled">My Courses</TabsTrigger>
              <TabsTrigger value="browse">Browse All</TabsTrigger>
            </TabsList>
            
            <TabsContent value="enrolled">
              {courses.length === 0 ? (
                <Card className="border-border bg-card">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No enrolled courses</h3>
                    <p className="text-muted-foreground text-center max-w-sm">
                      Browse available courses to get started.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {courses.map((course) => renderCourseCard(course, false))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="browse">
              {allCourses.length === 0 ? (
                <Card className="border-border bg-card">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No courses available</h3>
                    <p className="text-muted-foreground text-center max-w-sm">
                      Check back later for new courses.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {allCourses.map((course) => renderCourseCard(course, true))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {courses.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No courses yet</h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    Create your first course to start teaching.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => renderCourseCard(course, false))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Courses;
