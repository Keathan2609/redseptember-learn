import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookOpen, Users, FileText, ClipboardCheck } from "lucide-react";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!id) return;

      const { data: courseData } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();
      setCourse(courseData);

      const { data: modulesData } = await supabase
        .from("modules")
        .select("*")
        .eq("course_id", id)
        .order("order_index");
      setModules(modulesData || []);

      const { data: enrollmentsData } = await supabase
        .from("enrollments")
        .select("*, profiles(*)")
        .eq("course_id", id);
      setStudents(enrollmentsData?.map((e) => e.profiles) || []);

      const { data: resourcesData } = await supabase
        .from("resources")
        .select("*")
        .eq("course_id", id);
      setResources(resourcesData || []);

      const { data: modulesForAssessments } = await supabase
        .from("modules")
        .select("id")
        .eq("course_id", id);
      
      if (modulesForAssessments && modulesForAssessments.length > 0) {
        const moduleIds = modulesForAssessments.map((m) => m.id);
        const { data: assessmentsData } = await supabase
          .from("assessments")
          .select("*")
          .in("module_id", moduleIds);
        setAssessments(assessmentsData || []);
      }

      setLoading(false);
    };

    fetchCourseData();
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!course) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold">Course not found</h1>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          {course.thumbnail_url && (
            <div className="aspect-video bg-gradient-primary rounded-lg mb-4 overflow-hidden max-w-2xl">
              <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="text-4xl font-bold mb-2">{course.title}</h1>
          <p className="text-muted-foreground">{course.description}</p>
        </div>

        <Tabs defaultValue="modules" className="space-y-6">
          <TabsList>
            <TabsTrigger value="modules">
              <BookOpen className="h-4 w-4 mr-2" />
              Modules
            </TabsTrigger>
            <TabsTrigger value="assessments">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Assessments
            </TabsTrigger>
            <TabsTrigger value="students">
              <Users className="h-4 w-4 mr-2" />
              Students
            </TabsTrigger>
            <TabsTrigger value="materials">
              <FileText className="h-4 w-4 mr-2" />
              Materials
            </TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="space-y-4">
            {modules.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No modules yet. Create your first module to get started.
                </CardContent>
              </Card>
            ) : (
              modules.map((module) => (
                <Card key={module.id} className="border-border bg-card hover:shadow-glow transition-smooth">
                  <CardHeader>
                    <CardTitle>{module.title}</CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="assessments" className="space-y-4">
            {assessments.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No assessments yet. Add assessments to evaluate student progress.
                </CardContent>
              </Card>
            ) : (
              assessments.map((assessment) => (
                <Card key={assessment.id} className="border-border bg-card">
                  <CardHeader>
                    <CardTitle>{assessment.title}</CardTitle>
                    <CardDescription>{assessment.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <span>Total Points: {assessment.total_points}</span>
                      {assessment.due_date && (
                        <span>Due: {new Date(assessment.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="students" className="space-y-4">
            {students.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No students enrolled yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {students.map((student: any) => (
                  <Card key={student.id} className="border-border bg-card">
                    <CardContent className="flex items-center gap-4 pt-6">
                      <Avatar>
                        <AvatarFallback>
                          {student.full_name?.charAt(0) || student.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{student.full_name || "Unnamed Student"}</p>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="materials" className="space-y-4">
            {resources.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No course materials yet. Upload resources for your students.
                </CardContent>
              </Card>
            ) : (
              resources.map((resource) => (
                <Card key={resource.id} className="border-border bg-card">
                  <CardHeader>
                    <CardTitle>{resource.title}</CardTitle>
                    <CardDescription>{resource.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={resource.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View Resource
                    </a>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
