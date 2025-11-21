import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, Award, BookOpen, MessageSquare, TrendingUp, Calendar, CheckCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

const StudentProgress = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

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
          <Button
            variant="ghost"
            onClick={() => setSelectedStudent(null)}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Button>

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
