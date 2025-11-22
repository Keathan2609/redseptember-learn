import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { ArrowLeft, Award, BookOpen, MessageSquare, TrendingUp, Calendar, CheckCircle, Clock, Download, FileText, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Student {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  enrollmentCount: number;
  averageGrade: number;
  completionRate: number;
  forumPosts: number;
}

interface StudentDetail {
  profile: Student;
  enrollments: Array<{
    course_id: string;
    course_title: string;
    progress: number;
    enrolled_at: string;
  }>;
  submissions: Array<{
    id: string;
    assessment_title: string;
    course_title: string;
    grade: number | null;
    submitted_at: string;
    graded_at: string | null;
  }>;
  forumActivity: Array<{
    type: string;
    content: string;
    created_at: string;
    course_title: string;
  }>;
  performanceTrend: Array<{
    date: string;
    grade: number;
  }>;
}

interface ClassAverages {
  averageGrade: number;
  averageCompletion: number;
  averageSubmissions: number;
  averageForumPosts: number;
}

interface ExportOptions {
  startDate: string;
  endDate: string;
  includeGrades: boolean;
  includeProgress: boolean;
  includeForumActivity: boolean;
}

const StudentProgress = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [classAverages, setClassAverages] = useState<ClassAverages | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    includeGrades: true,
    includeProgress: true,
    includeForumActivity: true,
  });

  useEffect(() => {
    checkFacilitatorAccess();
  }, []);

  const checkFacilitatorAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "facilitator") {
      navigate("/dashboard");
      return;
    }

    await fetchStudents();
  };

  const fetchStudents = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get all courses by this facilitator
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .eq("facilitator_id", user.id);

    if (!courses || courses.length === 0) {
      setLoading(false);
      return;
    }

    const courseIds = courses.map(c => c.id);

    // Get all enrollments for these courses
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select(`
        student_id,
        progress,
        profiles!enrollments_student_id_fkey(id, full_name, email, avatar_url)
      `)
      .in("course_id", courseIds);

    if (!enrollments) {
      setLoading(false);
      return;
    }

    // Group by student
    const studentMap = new Map<string, any>();
    enrollments.forEach((enrollment: any) => {
      const studentId = enrollment.student_id;
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          ...enrollment.profiles,
          enrollmentCount: 0,
          totalProgress: 0,
          submissions: [],
          forumPosts: 0,
        });
      }
      const student = studentMap.get(studentId);
      student.enrollmentCount++;
      student.totalProgress += enrollment.progress || 0;
    });

    // Fetch submissions for grade calculations
    const { data: modules } = await supabase
      .from("modules")
      .select("id")
      .in("course_id", courseIds);

    const moduleIds = modules?.map(m => m.id) || [];

    if (moduleIds.length > 0) {
      const { data: assessments } = await supabase
        .from("assessments")
        .select("id")
        .in("module_id", moduleIds);

      const assessmentIds = assessments?.map(a => a.id) || [];

      if (assessmentIds.length > 0) {
        const { data: submissions } = await supabase
          .from("submissions")
          .select("student_id, grade")
          .in("assessment_id", assessmentIds)
          .not("grade", "is", null);

        submissions?.forEach((sub: any) => {
          const student = studentMap.get(sub.student_id);
          if (student) {
            student.submissions.push(sub);
          }
        });
      }
    }

    // Fetch forum activity
    const { data: forumPosts } = await supabase
      .from("forum_posts")
      .select("author_id")
      .in("course_id", courseIds);

    forumPosts?.forEach((post: any) => {
      const student = studentMap.get(post.author_id);
      if (student) {
        student.forumPosts++;
      }
    });

    // Calculate final metrics
    const studentsArray = Array.from(studentMap.values()).map(student => ({
      id: student.id,
      full_name: student.full_name,
      email: student.email,
      avatar_url: student.avatar_url,
      enrollmentCount: student.enrollmentCount,
      averageGrade: student.submissions.length > 0
        ? Math.round(student.submissions.reduce((sum: number, s: any) => sum + s.grade, 0) / student.submissions.length)
        : 0,
      completionRate: student.enrollmentCount > 0
        ? Math.round(student.totalProgress / student.enrollmentCount)
        : 0,
      forumPosts: student.forumPosts,
    }));

    setStudents(studentsArray);
    
    // Calculate class averages
    if (studentsArray.length > 0) {
      const avgGrade = Math.round(
        studentsArray.reduce((sum, s) => sum + s.averageGrade, 0) / studentsArray.length
      );
      const avgCompletion = Math.round(
        studentsArray.reduce((sum, s) => sum + s.completionRate, 0) / studentsArray.length
      );
      const avgSubmissions = Math.round(
        studentsArray.reduce((sum, s) => sum + (students.find(st => st.id === s.id) as any)?.submissions?.length || 0, 0) / studentsArray.length
      );
      const avgForumPosts = Math.round(
        studentsArray.reduce((sum, s) => sum + s.forumPosts, 0) / studentsArray.length
      );
      
      setClassAverages({
        averageGrade: avgGrade,
        averageCompletion: avgCompletion,
        averageSubmissions: avgSubmissions,
        averageForumPosts: avgForumPosts,
      });
    }
    
    setLoading(false);
  };

  const fetchStudentDetails = async (studentId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get student profile
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Get facilitator's courses
    const { data: courses } = await supabase
      .from("courses")
      .select("id, title")
      .eq("facilitator_id", user.id);

    const courseIds = courses?.map(c => c.id) || [];

    // Get enrollments with course details
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select(`
        course_id,
        progress,
        enrolled_at,
        courses!enrollments_course_id_fkey(title)
      `)
      .eq("student_id", studentId)
      .in("course_id", courseIds);

    const enrollmentsFormatted = enrollments?.map((e: any) => ({
      course_id: e.course_id,
      course_title: e.courses.title,
      progress: e.progress || 0,
      enrolled_at: e.enrolled_at,
    })) || [];

    // Get submissions
    const { data: modules } = await supabase
      .from("modules")
      .select("id, course_id, courses!modules_course_id_fkey(title)")
      .in("course_id", courseIds);

    const moduleIds = modules?.map(m => m.id) || [];
    let submissionsFormatted: any[] = [];
    let performanceTrend: any[] = [];

    if (moduleIds.length > 0) {
      const { data: assessments } = await supabase
        .from("assessments")
        .select("id, title, module_id")
        .in("module_id", moduleIds);

      const assessmentIds = assessments?.map(a => a.id) || [];

      if (assessmentIds.length > 0) {
        const { data: submissions } = await supabase
          .from("submissions")
          .select("*")
          .eq("student_id", studentId)
          .in("assessment_id", assessmentIds)
          .order("submitted_at", { ascending: true });

        submissionsFormatted = submissions?.map(s => {
          const assessment = assessments?.find(a => a.id === s.assessment_id);
          const module = modules?.find(m => m.id === assessment?.module_id);
          return {
            id: s.id,
            assessment_title: assessment?.title || "Unknown",
            course_title: module?.courses?.title || "Unknown",
            grade: s.grade,
            submitted_at: s.submitted_at,
            graded_at: s.graded_at,
          };
        }) || [];

        // Calculate performance trend
        const gradedSubmissions = submissionsFormatted.filter(s => s.grade !== null);
        performanceTrend = gradedSubmissions.map(s => ({
          date: new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          grade: s.grade,
        }));
      }
    }

    // Get forum activity
    const { data: forumPosts } = await supabase
      .from("forum_posts")
      .select(`
        content,
        created_at,
        courses!forum_posts_course_id_fkey(title)
      `)
      .eq("author_id", studentId)
      .in("course_id", courseIds)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: forumReplies } = await supabase
      .from("forum_replies")
      .select(`
        content,
        created_at,
        forum_posts!forum_replies_post_id_fkey(
          courses!forum_posts_course_id_fkey(title)
        )
      `)
      .eq("author_id", studentId)
      .order("created_at", { ascending: false })
      .limit(10);

    const forumActivity = [
      ...(forumPosts?.map(p => ({
        type: "post",
        content: p.content,
        created_at: p.created_at,
        course_title: p.courses?.title || "Unknown",
      })) || []),
      ...(forumReplies?.map((r: any) => ({
        type: "reply",
        content: r.content,
        created_at: r.created_at,
        course_title: r.forum_posts?.courses?.title || "Unknown",
      })) || []),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setSelectedStudent({
      profile: student,
      enrollments: enrollmentsFormatted,
      submissions: submissionsFormatted,
      forumActivity,
      performanceTrend,
    });
  };

  const exportToPDF = () => {
    if (!selectedStudent) return;

    const doc = new jsPDF();
    const { profile, submissions, enrollments, forumActivity } = selectedStudent;
    
    // Filter data by date range
    const filteredSubmissions = submissions.filter(s => {
      const date = new Date(s.submitted_at);
      return date >= new Date(exportOptions.startDate) && date <= new Date(exportOptions.endDate);
    });

    // Title
    doc.setFontSize(20);
    doc.text("Student Progress Report", 14, 20);
    
    // Student Info
    doc.setFontSize(12);
    doc.text(`Name: ${profile.full_name}`, 14, 35);
    doc.text(`Email: ${profile.email}`, 14, 42);
    doc.text(`Report Period: ${exportOptions.startDate} to ${exportOptions.endDate}`, 14, 49);
    
    let yPosition = 60;

    // Grades Section
    if (exportOptions.includeGrades && filteredSubmissions.length > 0) {
      doc.setFontSize(14);
      doc.text("Grades", 14, yPosition);
      yPosition += 7;
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Assessment', 'Course', 'Grade', 'Date']],
        body: filteredSubmissions.map(s => [
          s.assessment_title,
          s.course_title,
          s.grade !== null ? s.grade.toString() : 'Pending',
          new Date(s.submitted_at).toLocaleDateString()
        ]),
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Progress Section
    if (exportOptions.includeProgress) {
      doc.setFontSize(14);
      doc.text("Course Progress", 14, yPosition);
      yPosition += 7;
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Course', 'Progress', 'Enrolled']],
        body: enrollments.map(e => [
          e.course_title,
          `${e.progress}%`,
          new Date(e.enrolled_at).toLocaleDateString()
        ]),
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Forum Activity Section
    if (exportOptions.includeForumActivity && forumActivity.length > 0) {
      const filteredActivity = forumActivity.filter(a => {
        const date = new Date(a.created_at);
        return date >= new Date(exportOptions.startDate) && date <= new Date(exportOptions.endDate);
      });

      if (filteredActivity.length > 0) {
        doc.setFontSize(14);
        doc.text("Forum Activity", 14, yPosition);
        yPosition += 7;
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Type', 'Course', 'Date', 'Content']],
          body: filteredActivity.slice(0, 10).map(a => [
            a.type,
            a.course_title,
            new Date(a.created_at).toLocaleDateString(),
            a.content.substring(0, 50) + '...'
          ]),
        });
      }
    }

    doc.save(`${profile.full_name}_progress_report.pdf`);
    toast({
      title: "Report Downloaded",
      description: "PDF report has been downloaded successfully.",
    });
  };

  const exportToCSV = () => {
    if (!selectedStudent) return;

    const { profile, submissions, enrollments } = selectedStudent;
    
    // Filter data by date range
    const filteredSubmissions = submissions.filter(s => {
      const date = new Date(s.submitted_at);
      return date >= new Date(exportOptions.startDate) && date <= new Date(exportOptions.endDate);
    });

    let csvContent = "Student Progress Report\n\n";
    csvContent += `Name,${profile.full_name}\n`;
    csvContent += `Email,${profile.email}\n`;
    csvContent += `Report Period,${exportOptions.startDate} to ${exportOptions.endDate}\n\n`;

    if (exportOptions.includeGrades && filteredSubmissions.length > 0) {
      csvContent += "Grades\n";
      csvContent += "Assessment,Course,Grade,Submitted Date\n";
      filteredSubmissions.forEach(s => {
        csvContent += `"${s.assessment_title}","${s.course_title}",${s.grade !== null ? s.grade : 'Pending'},${new Date(s.submitted_at).toLocaleDateString()}\n`;
      });
      csvContent += "\n";
    }

    if (exportOptions.includeProgress) {
      csvContent += "Course Progress\n";
      csvContent += "Course,Progress,Enrolled Date\n";
      enrollments.forEach(e => {
        csvContent += `"${e.course_title}",${e.progress}%,${new Date(e.enrolled_at).toLocaleDateString()}\n`;
      });
      csvContent += "\n";
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${profile.full_name}_progress_report.csv`;
    link.click();
    
    toast({
      title: "Report Downloaded",
      description: "CSV report has been downloaded successfully.",
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-muted-foreground">Loading students...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (selectedStudent) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={() => setSelectedStudent(null)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Students
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export Progress Report</DialogTitle>
                  <DialogDescription>
                    Customize and download student progress report
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={exportOptions.startDate}
                        onChange={(e) => setExportOptions({ ...exportOptions, startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={exportOptions.endDate}
                        onChange={(e) => setExportOptions({ ...exportOptions, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Include in Report</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="grades"
                        checked={exportOptions.includeGrades}
                        onCheckedChange={(checked) => 
                          setExportOptions({ ...exportOptions, includeGrades: checked as boolean })
                        }
                      />
                      <label htmlFor="grades" className="text-sm cursor-pointer">
                        Grades and Submissions
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="progress"
                        checked={exportOptions.includeProgress}
                        onCheckedChange={(checked) => 
                          setExportOptions({ ...exportOptions, includeProgress: checked as boolean })
                        }
                      />
                      <label htmlFor="progress" className="text-sm cursor-pointer">
                        Course Progress
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="forum"
                        checked={exportOptions.includeForumActivity}
                        onCheckedChange={(checked) => 
                          setExportOptions({ ...exportOptions, includeForumActivity: checked as boolean })
                        }
                      />
                      <label htmlFor="forum" className="text-sm cursor-pointer">
                        Forum Activity
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={exportToPDF} className="flex-1">
                      <FileText className="mr-2 h-4 w-4" />
                      Export as PDF
                    </Button>
                    <Button onClick={exportToCSV} variant="outline" className="flex-1">
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Export as CSV
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Student Header */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={selectedStudent.profile.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">
                    {selectedStudent.profile.full_name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold">{selectedStudent.profile.full_name}</h1>
                  <p className="text-muted-foreground">{selectedStudent.profile.email}</p>
                </div>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-2xl font-bold">{selectedStudent.profile.enrollmentCount}</div>
                    <div className="text-sm text-muted-foreground">Courses</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{selectedStudent.profile.averageGrade}</div>
                    <div className="text-sm text-muted-foreground">Avg Grade</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{selectedStudent.profile.completionRate}%</div>
                    <div className="text-sm text-muted-foreground">Progress</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="comparison">Comparison</TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
              <TabsTrigger value="activity">Forum Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Performance Trend */}
              {selectedStudent.performanceTrend.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Grade Trend</CardTitle>
                    <CardDescription>Performance over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={selectedStudent.performanceTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--foreground))" />
                        <YAxis stroke="hsl(var(--foreground))" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="grade"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          name="Grade"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Course Progress */}
              <Card>
                <CardHeader>
                  <CardTitle>Course Progress</CardTitle>
                  <CardDescription>Enrollment and completion status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedStudent.enrollments.map((enrollment) => (
                      <div key={enrollment.course_id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{enrollment.course_title}</p>
                            <p className="text-sm text-muted-foreground">
                              Enrolled {new Date(enrollment.enrolled_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="text-sm font-medium">{enrollment.progress}%</span>
                        </div>
                        <Progress value={enrollment.progress} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedStudent.submissions.length}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Graded</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedStudent.submissions.filter(s => s.grade !== null).length}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedStudent.submissions.filter(s => s.grade === null).length}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Forum Posts</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedStudent.profile.forumPosts}</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="comparison" className="space-y-4">
              {classAverages && (
                <>
                  {/* Performance Comparison Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance vs Class Average</CardTitle>
                      <CardDescription>Compare student metrics with class benchmarks</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={[
                            {
                              metric: 'Avg Grade',
                              Student: selectedStudent.profile.averageGrade,
                              'Class Average': classAverages.averageGrade,
                            },
                            {
                              metric: 'Completion',
                              Student: selectedStudent.profile.completionRate,
                              'Class Average': classAverages.averageCompletion,
                            },
                            {
                              metric: 'Forum Posts',
                              Student: selectedStudent.profile.forumPosts,
                              'Class Average': classAverages.averageForumPosts,
                            },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="metric" stroke="hsl(var(--foreground))" />
                          <YAxis stroke="hsl(var(--foreground))" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))'
                            }}
                          />
                          <Legend />
                          <Bar dataKey="Student" fill="hsl(var(--primary))" />
                          <Bar dataKey="Class Average" fill="hsl(var(--muted-foreground))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Performance Indicators */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Grade Performance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Student Grade</span>
                            <Badge variant={selectedStudent.profile.averageGrade >= classAverages.averageGrade ? "default" : "secondary"}>
                              {selectedStudent.profile.averageGrade}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Class Average</span>
                            <Badge variant="outline">{classAverages.averageGrade}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedStudent.profile.averageGrade >= classAverages.averageGrade ? (
                              <>
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <span className="text-sm text-primary">
                                  {selectedStudent.profile.averageGrade - classAverages.averageGrade} points above average
                                </span>
                              </>
                            ) : (
                              <>
                                <TrendingUp className="h-4 w-4 text-destructive rotate-180" />
                                <span className="text-sm text-destructive">
                                  {classAverages.averageGrade - selectedStudent.profile.averageGrade} points below average
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Completion Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Student Progress</span>
                            <Badge variant={selectedStudent.profile.completionRate >= classAverages.averageCompletion ? "default" : "secondary"}>
                              {selectedStudent.profile.completionRate}%
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Class Average</span>
                            <Badge variant="outline">{classAverages.averageCompletion}%</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedStudent.profile.completionRate >= classAverages.averageCompletion ? (
                              <>
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <span className="text-sm text-primary">
                                  {selectedStudent.profile.completionRate - classAverages.averageCompletion}% above average
                                </span>
                              </>
                            ) : (
                              <>
                                <TrendingUp className="h-4 w-4 text-destructive rotate-180" />
                                <span className="text-sm text-destructive">
                                  {classAverages.averageCompletion - selectedStudent.profile.completionRate}% below average
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Forum Engagement</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Student Posts</span>
                            <Badge variant={selectedStudent.profile.forumPosts >= classAverages.averageForumPosts ? "default" : "secondary"}>
                              {selectedStudent.profile.forumPosts}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Class Average</span>
                            <Badge variant="outline">{classAverages.averageForumPosts}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedStudent.profile.forumPosts >= classAverages.averageForumPosts ? (
                              <>
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <span className="text-sm text-primary">
                                  {selectedStudent.profile.forumPosts - classAverages.averageForumPosts} posts above average
                                </span>
                              </>
                            ) : (
                              <>
                                <TrendingUp className="h-4 w-4 text-destructive rotate-180" />
                                <span className="text-sm text-destructive">
                                  {classAverages.averageForumPosts - selectedStudent.profile.forumPosts} posts below average
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Overall Standing</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {selectedStudent.profile.averageGrade >= classAverages.averageGrade &&
                           selectedStudent.profile.completionRate >= classAverages.averageCompletion ? (
                            <>
                              <div className="text-2xl font-bold text-primary">Excellent</div>
                              <p className="text-sm text-muted-foreground">
                                Performing above average in multiple areas
                              </p>
                            </>
                          ) : selectedStudent.profile.averageGrade < classAverages.averageGrade - 10 ||
                                     selectedStudent.profile.completionRate < classAverages.averageCompletion - 20 ? (
                            <>
                              <div className="text-2xl font-bold text-destructive">Needs Attention</div>
                              <p className="text-sm text-muted-foreground">
                                Consider reaching out to provide additional support
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="text-2xl font-bold text-yellow-500">Average</div>
                              <p className="text-sm text-muted-foreground">
                                Meeting class expectations
                              </p>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="submissions">
              <Card>
                <CardHeader>
                  <CardTitle>All Submissions</CardTitle>
                  <CardDescription>Complete submission history</CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedStudent.submissions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No submissions yet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Assessment</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedStudent.submissions.map((submission) => (
                          <TableRow key={submission.id}>
                            <TableCell className="font-medium">{submission.assessment_title}</TableCell>
                            <TableCell>{submission.course_title}</TableCell>
                            <TableCell>
                              {new Date(submission.submitted_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {submission.grade !== null ? (
                                <span className="font-bold">{submission.grade}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {submission.grade !== null ? (
                                <Badge variant="default">Graded</Badge>
                              ) : (
                                <Badge variant="secondary">Pending</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>Forum Activity</CardTitle>
                  <CardDescription>Recent posts and replies</CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedStudent.forumActivity.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No forum activity yet</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedStudent.forumActivity.map((activity, index) => (
                        <div key={index} className="border-l-2 border-primary pl-4 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={activity.type === "post" ? "default" : "secondary"}>
                              {activity.type}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {activity.course_title}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(activity.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-2">{activity.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Student Progress Tracking</h1>
          <p className="text-muted-foreground">View detailed performance for individual students</p>
        </div>

        {students.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">No students enrolled in your courses yet</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>All Students</CardTitle>
              <CardDescription>Click on a student to view detailed progress</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Enrollments</TableHead>
                    <TableHead>Avg Grade</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Forum Posts</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={student.avatar_url || undefined} />
                            <AvatarFallback>{student.full_name?.charAt(0) || "?"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{student.full_name}</p>
                            <p className="text-sm text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          {student.enrollmentCount}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-muted-foreground" />
                          {student.averageGrade > 0 ? student.averageGrade : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.completionRate} className="w-20" />
                          <span className="text-sm">{student.completionRate}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          {student.forumPosts}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => fetchStudentDetails(student.id)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentProgress;
