import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { Progress } from "@/components/ui/progress";
import { useModuleCompletion } from "@/hooks/use-module-completion";
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

function SortableModule({ 
  module, 
  assessments, 
  resources,
  profile, 
  isEnrolled, 
  courseId,
  isFacilitator,
  onAssessmentCreated,
  onTakeAssessment,
  onResourceAdded
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: module.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const moduleAssessments = assessments.filter((a: any) => a.module_id === module.id);
  const moduleResources = resources.filter((r: any) => r.module_id === module.id);
  const { completion, loading, checkMilestones } = useModuleCompletion(
    module.id, 
    profile?.role === "student" && isEnrolled ? profile.id : null,
    courseId
  );

  const handleResourceView = async (resourceId: string) => {
    if (profile?.role === "student" && isEnrolled) {
      try {
        await supabase.from('resource_views').upsert({
          resource_id: resourceId,
          student_id: profile.id
        }, { onConflict: 'resource_id,student_id' });
        
        // Check for completion milestones
        await checkMilestones();
      } catch (error) {
        console.error('Error tracking resource view:', error);
      }
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              {isFacilitator && (
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
                {profile?.role === "student" && isEnrolled && !loading && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{completion}%</span>
                    </div>
                    <Progress value={completion} className="h-2" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="assessments" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="assessments">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Assessments
              </TabsTrigger>
              <TabsTrigger value="resources">
                <FileText className="h-4 w-4 mr-2" />
                Resources
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assessments" className="space-y-4">
              <div className="flex justify-end">
                {isFacilitator && (
                  <AssessmentDialog moduleId={module.id} onAssessmentCreated={onAssessmentCreated} />
                )}
              </div>
              
              {moduleAssessments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No assessments in this module yet
                </p>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {moduleAssessments.map((assessment: any) => (
                    <AccordionItem key={assessment.id} value={assessment.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <span className="font-medium">{assessment.title}</span>
                          <Badge variant="outline" className="capitalize">
                            {assessment.assessment_type}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">{assessment.description}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              {assessment.due_date && (
                                <div>Due: {new Date(assessment.due_date).toLocaleDateString()}</div>
                              )}
                              <div>Total Points: {assessment.total_points}</div>
                            </div>
                          </div>
                          
                          {profile?.role === "student" && isEnrolled && (
                            <Button onClick={() => onTakeAssessment(assessment)} size="sm">
                              Take Assessment
                            </Button>
                          )}
                          
                          {isFacilitator && (
                            <div className="border-t pt-4 mt-4">
                              <h5 className="font-semibold text-sm mb-3">Submissions</h5>
                              <SubmissionReview 
                                assessmentId={assessment.id}
                                totalPoints={assessment.total_points}
                                questions={assessment.questions as any}
                              />
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </TabsContent>

            <TabsContent value="resources" className="space-y-4">
              <div className="flex justify-end">
                {isFacilitator && (
                  <ResourceUpload courseId={courseId} moduleId={module.id} onResourceAdded={onResourceAdded} />
                )}
              </div>
              
              {moduleResources.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No resources in this module yet
                </p>
              ) : (
                <div className="space-y-3">
                  {moduleResources.map((resource: any) => (
                    <Card key={resource.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <CardTitle className="text-base">{resource.title}</CardTitle>
                            {resource.description && (
                              <CardDescription className="text-sm">{resource.description}</CardDescription>
                            )}
                          </div>
                          {resource.file_type && (
                            <Badge variant="secondary" className="ml-2">
                              {resource.file_type}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleResourceView(resource.id);
                            window.open(resource.file_url, '_blank');
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Resource
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
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

  const handleResourceView = async (resourceId: string) => {
    if (profile?.role === "student" && isEnrolled) {
      try {
        await supabase.from('resource_views').upsert({
          resource_id: resourceId,
          student_id: profile.id
        }, { onConflict: 'resource_id,student_id' });
      } catch (error) {
        console.error('Error tracking resource view:', error);
      }
    }
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
            {profile?.role === "facilitator" && (
              <TabsTrigger value="students">
                <Users className="h-4 w-4 mr-2" />
                Students
              </TabsTrigger>
            )}
            <TabsTrigger value="resources">
              <FileText className="h-4 w-4 mr-2" />
              Resources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="space-y-4">
            {takingAssessment ? (
              <div>
                <Button
                  variant="outline"
                  className="mb-4"
                  onClick={() => setTakingAssessment(null)}
                >
                  ← Back to Modules
                </Button>
                <AssessmentTaking
                  assessment={takingAssessment}
                  courseId={id}
                  onSubmit={() => {
                    setTakingAssessment(null);
                    refetchData();
                  }}
                />
              </div>
            ) : (
              <>
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
                            assessments={assessments}
                            resources={resources}
                            profile={profile}
                            isEnrolled={isEnrolled}
                            courseId={id}
                            isFacilitator={profile?.role === "facilitator" && course.facilitator_id === profile.id}
                            onAssessmentCreated={refetchData}
                            onTakeAssessment={setTakingAssessment}
                            onResourceAdded={refetchData}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </>
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

          <TabsContent value="resources" className="space-y-4">
            {profile?.role === "facilitator" && course.facilitator_id === profile.id && (
              <div className="flex justify-end mb-4">
                <ResourceUpload courseId={id!} onResourceAdded={refetchData} />
              </div>
            )}
            {resources.filter((r: any) => !r.module_id).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No course-wide resources yet. {profile?.role === "facilitator" ? "Upload resources here for general course materials, or add them to specific modules." : "Course-wide resources will appear here."}
                </CardContent>
              </Card>
            ) : (
              resources.filter((r: any) => !r.module_id).map((resource) => (
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
                      onClick={() => {
                        handleResourceView(resource.id);
                        window.open(resource.file_url, "_blank");
                      }}
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
