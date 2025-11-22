import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookOpen, Users, FileText, ClipboardCheck, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModuleDialog } from "@/components/courses/ModuleDialog";
import { AssessmentDialog } from "@/components/courses/AssessmentDialog";
import { SubmissionReview } from "@/components/courses/SubmissionReview";
import ResourceUpload from "@/components/courses/ResourceUpload";
import AssessmentTaking from "@/components/courses/AssessmentTaking";
import { BulkActionsDialog } from "@/components/courses/BulkActionsDialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableModule({ module, onAssessmentCreated }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: module.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </div>
            </div>
            <AssessmentDialog moduleId={module.id} onAssessmentCreated={onAssessmentCreated} />
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [takingAssessment, setTakingAssessment] = useState<any | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!id) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(profileData);

        const { data: enrollmentData } = await supabase
          .from("enrollments")
          .select("*")
          .eq("student_id", user.id)
          .eq("course_id", id)
          .maybeSingle();
        setIsEnrolled(!!enrollmentData);
      }

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

  const handleEnroll = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("enrollments")
        .insert([{ student_id: user.id, course_id: id }]);

      if (error) throw error;

      toast({ title: "Success", description: "Enrolled successfully" });
      setIsEnrolled(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);

    const newModules = arrayMove(modules, oldIndex, newIndex);
    setModules(newModules);

    try {
      const updates = newModules.map((module, index) => 
        supabase.from("modules").update({ order_index: index }).eq("id", module.id)
      );
      await Promise.all(updates);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to reorder modules", variant: "destructive" });
    }
  };

  const refetchData = async () => {
    if (!id) return;
    
    const { data: modulesData } = await supabase
      .from("modules")
      .select("*")
      .eq("course_id", id)
      .order("order_index");
    setModules(modulesData || []);

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

    const { data: resourceData } = await supabase
      .from("resources")
      .select("*")
      .eq("course_id", id)
      .order("created_at", { ascending: false });
    setResources(resourceData || []);
  };

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
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{course.title}</h1>
              <p className="text-muted-foreground">{course.description}</p>
            </div>
            {profile?.role === "student" && !isEnrolled && (
              <Button onClick={handleEnroll}>Enroll in Course</Button>
            )}
          </div>
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
            {profile?.role === "facilitator" && (
              <TabsTrigger value="students">
                <Users className="h-4 w-4 mr-2" />
                Students
              </TabsTrigger>
            )}
            {profile?.role === "facilitator" && (
              <TabsTrigger value="submissions">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Submissions
              </TabsTrigger>
            )}
            <TabsTrigger value="resources">
              <FileText className="h-4 w-4 mr-2" />
              Resources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="space-y-4">
            {profile?.role === "facilitator" && course.facilitator_id === profile.id && (
              <div className="flex justify-end mb-4">
                <ModuleDialog 
                  courseId={id!} 
                  onModuleCreated={refetchData}
                  existingModulesCount={modules.length}
                />
              </div>
            )}
            
            {modules.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No modules yet. Modules will organize your course content into structured sections.
                </CardContent>
              </Card>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {modules.map((module) => (
                      <SortableModule 
                        key={module.id} 
                        module={module}
                        onAssessmentCreated={refetchData}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent value="assessments" className="space-y-4">
            {takingAssessment ? (
              <div>
                <Button
                  variant="outline"
                  className="mb-4"
                  onClick={() => setTakingAssessment(null)}
                >
                  ← Back to Assessments
                </Button>
                <AssessmentTaking
                  assessment={takingAssessment}
                  onSubmit={() => {
                    setTakingAssessment(null);
                    refetchData();
                  }}
                />
              </div>
            ) : assessments.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No assessments yet. Assessments help track student progress.
                </CardContent>
              </Card>
            ) : (
              assessments.map((assessment) => (
                <Card key={assessment.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{assessment.title}</CardTitle>
                        <CardDescription>{assessment.description}</CardDescription>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {assessment.assessment_type}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      {assessment.due_date && (
                        <div>Due: {new Date(assessment.due_date).toLocaleDateString()}</div>
                      )}
                      <div>Total Points: {assessment.total_points}</div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {profile?.role === "student" && isEnrolled && (
                      <Button onClick={() => setTakingAssessment(assessment)}>
                        Take Assessment
                      </Button>
                    )}
                    {profile?.role === "facilitator" && course.facilitator_id === profile.id && (
                      <SubmissionReview 
                        assessmentId={assessment.id}
                        totalPoints={assessment.total_points}
                        questions={assessment.questions as any}
                      />
                    )}
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
              <>
                <div className="flex justify-end">
                  <BulkActionsDialog
                    students={students}
                    courseId={id}
                    assessments={assessments.map(a => ({ id: a.id, title: a.title }))}
                    onActionComplete={refetchData}
                  />
                </div>
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
              </>
            )}
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Student Submissions</CardTitle>
                <CardDescription>Review and grade student work</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {assessments.map((assessment) => (
                    <div key={assessment.id}>
                      <h3 className="font-semibold mb-4 text-lg">{assessment.title}</h3>
                      <SubmissionReview
                        assessmentId={assessment.id}
                        totalPoints={assessment.total_points || 100}
                        questions={assessment.questions as any}
                      />
                    </div>
                  ))}
                  {assessments.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No assessments available yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            {profile?.role === "facilitator" && course.facilitator_id === profile.id && (
              <div className="flex justify-end mb-4">
                <ResourceUpload courseId={id!} onResourceAdded={refetchData} />
              </div>
            )}
            {resources.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No course materials yet. {profile?.role === "facilitator" ? "Upload resources for your students." : "Resources will appear here once added."}
                </CardContent>
              </Card>
            ) : (
              resources.map((resource) => (
                <Card key={resource.id} className="border-border bg-card">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle>{resource.title}</CardTitle>
                        {resource.description && (
                          <CardDescription>{resource.description}</CardDescription>
                        )}
                      </div>
                      <Badge variant="outline">
                        {resource.file_type?.split("/")[1] || "file"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(resource.file_url, "_blank")}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      View/Download
                    </Button>
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
