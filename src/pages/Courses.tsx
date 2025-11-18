import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { CourseDialog } from "@/components/courses/CourseDialog";

const Courses = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

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

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Courses</h1>
            <p className="text-muted-foreground">
              {profile?.role === "student" ? "Your enrolled courses" : "Courses you manage"}
            </p>
          </div>
          {profile?.role === "facilitator" && (
            <CourseDialog onCourseCreated={handleCourseCreated} />
          )}
        </div>

        {courses.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No courses yet</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {profile?.role === "student"
                  ? "You haven't enrolled in any courses yet. Browse available courses to get started."
                  : "Create your first course to start teaching."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="border-border bg-card hover:shadow-glow transition-smooth cursor-pointer">
                <CardHeader>
                  <div className="aspect-video bg-gradient-primary rounded-lg mb-4" />
                  <CardTitle>{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {course.description || "No description available"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate(`/courses/${course.id}`)}
                  >
                    View Course
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Courses;
