import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, CheckCircle, MessageSquare, TrendingUp, Award, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BulkActionsDialog } from "@/components/courses/BulkActionsDialog";

interface Course {
  id: string;
  title: string;
}

interface AnalyticsData {
  totalStudents: number;
  totalSubmissions: number;
  averageGrade: number;
  completionRate: number;
  forumPosts: number;
  forumReplies: number;
  pendingSubmissions: number;
}

const Analytics = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalStudents: 0,
    totalSubmissions: 0,
    averageGrade: 0,
    completionRate: 0,
    forumPosts: 0,
    forumReplies: 0,
    pendingSubmissions: 0,
  });
  const [completionData, setCompletionData] = useState<any[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<any[]>([]);
  const [engagementTrend, setEngagementTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);

  useEffect(() => {
    checkFacilitatorAccess();
  }, []);

  useEffect(() => {
    if (courses.length > 0) {
      fetchAnalytics();
    }
  }, [selectedCourse, courses]);

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

    await fetchCourses();
  };

  const fetchCourses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("courses")
      .select("id, title")
      .eq("facilitator_id", user.id);

    if (error) {
      console.error("Error fetching courses:", error);
      return;
    }

    setCourses(data || []);
    setLoading(false);
  };

  const fetchAnalytics = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const courseIds = selectedCourse === "all" 
      ? courses.map(c => c.id)
      : [selectedCourse];

    if (courseIds.length === 0) return;

    // Fetch enrollments
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select(`
        *,
        profiles!enrollments_student_id_fkey(id, full_name, email)
      `)
      .in("course_id", courseIds);

    // Get unique students
    const studentsMap = new Map();
    enrollments?.forEach((enrollment: any) => {
      if (enrollment.profiles && !studentsMap.has(enrollment.profiles.id)) {
        studentsMap.set(enrollment.profiles.id, enrollment.profiles);
      }
    });
    setEnrolledStudents(Array.from(studentsMap.values()));

    // Fetch modules and assessments
    const { data: modules } = await supabase
      .from("modules")
      .select("id, course_id")
      .in("course_id", courseIds);

    const moduleIds = modules?.map(m => m.id) || [];

    let submissions: any[] = [];
    let assessments: any[] = [];
    if (moduleIds.length > 0) {
      const { data: assessmentsData } = await supabase
        .from("assessments")
        .select("id, title, module_id, total_points")
        .in("module_id", moduleIds);
      assessments = assessmentsData || [];
      setAssessments(assessments);

      const assessmentIds = assessments.map(a => a.id);
      if (assessmentIds.length > 0) {
        const { data: submissionsData } = await supabase
          .from("submissions")
          .select("*, assessments!inner(module_id)")
          .in("assessment_id", assessmentIds);
        submissions = submissionsData || [];
      }
    }

    // Fetch forum data
    const { data: forumPosts } = await supabase
      .from("forum_posts")
      .select("id, created_at")
      .in("course_id", courseIds);

    const postIds = forumPosts?.map(p => p.id) || [];
    let forumReplies: any[] = [];
    if (postIds.length > 0) {
      const { data: repliesData } = await supabase
        .from("forum_replies")
        .select("*")
        .in("post_id", postIds);
      forumReplies = repliesData || [];
    }

    // Calculate analytics
    const totalStudents = enrollments?.length || 0;
    const totalSubmissions = submissions.length;
    const gradedSubmissions = submissions.filter(s => s.grade !== null);
    const averageGrade = gradedSubmissions.length > 0
      ? gradedSubmissions.reduce((sum, s) => sum + (s.grade || 0), 0) / gradedSubmissions.length
      : 0;

    const totalAssessments = assessments.length * totalStudents;
    const completionRate = totalAssessments > 0
      ? (totalSubmissions / totalAssessments) * 100
      : 0;

    const pendingSubmissions = submissions.filter(s => s.grade === null).length;

    setAnalytics({
      totalStudents,
      totalSubmissions,
      averageGrade: Math.round(averageGrade * 10) / 10,
      completionRate: Math.round(completionRate),
      forumPosts: forumPosts?.length || 0,
      forumReplies: forumReplies.length,
      pendingSubmissions,
    });

    // Prepare completion data by course
    const completionByModule = modules?.map(module => {
      const moduleAssessments = assessments.filter(a => a.module_id === module.id);
      const moduleSubmissions = submissions.filter(s => 
        moduleAssessments.some(a => a.id === s.assessment_id)
      );
      const courseName = courses.find(c => c.id === module.course_id)?.title || "Unknown";
      return {
        name: courseName.substring(0, 20),
        completed: moduleSubmissions.length,
        pending: (moduleAssessments.length * totalStudents) - moduleSubmissions.length,
      };
    }) || [];

    setCompletionData(completionByModule);

    // Grade distribution
    const distribution = [
      { range: "90-100", count: gradedSubmissions.filter(s => s.grade >= 90).length },
      { range: "80-89", count: gradedSubmissions.filter(s => s.grade >= 80 && s.grade < 90).length },
      { range: "70-79", count: gradedSubmissions.filter(s => s.grade >= 70 && s.grade < 80).length },
      { range: "60-69", count: gradedSubmissions.filter(s => s.grade >= 60 && s.grade < 70).length },
      { range: "Below 60", count: gradedSubmissions.filter(s => s.grade < 60).length },
    ];
    setGradeDistribution(distribution);

    // Engagement trend (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const trend = last7Days.map(date => {
      const daySubmissions = submissions.filter(s => 
        s.submitted_at?.startsWith(date)
      ).length;
      const dayPosts = forumPosts?.filter(p => 
        p.created_at?.startsWith(date)
      ).length || 0;
      const dayReplies = forumReplies.filter(r => 
        r.created_at?.startsWith(date)
      ).length;

      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        submissions: daySubmissions,
        discussions: dayPosts + dayReplies,
      };
    });
    setEngagementTrend(trend);
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-muted-foreground">Loading analytics...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (courses.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
          <Card className="mt-8">
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">No courses found. Create a course to see analytics.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Track student progress and engagement</p>
          </div>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalStudents}</div>
              <p className="text-xs text-muted-foreground">Enrolled in selected course(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.completionRate}%</div>
              <p className="text-xs text-muted-foreground">{analytics.totalSubmissions} submissions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Grade</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.averageGrade}</div>
              <p className="text-xs text-muted-foreground">Out of 100 points</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Forum Activity</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.forumPosts + analytics.forumReplies}</div>
              <p className="text-xs text-muted-foreground">{analytics.forumPosts} posts, {analytics.forumReplies} replies</p>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions Section */}
        {enrolledStudents.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Bulk Actions</CardTitle>
                  <CardDescription>Manage multiple students at once</CardDescription>
                </div>
                <BulkActionsDialog
                  students={enrolledStudents}
                  courseId={selectedCourse !== "all" ? selectedCourse : undefined}
                  assessments={assessments.map(a => ({ id: a.id, title: a.title }))}
                  onActionComplete={fetchAnalytics}
                />
              </div>
            </CardHeader>
          </Card>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Assessment Completion by Module</CardTitle>
                  <CardDescription>Track submission progress across modules</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={completionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                      <YAxis stroke="hsl(var(--foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))' 
                        }} 
                      />
                      <Legend />
                      <Bar dataKey="completed" fill="hsl(var(--primary))" name="Completed" />
                      <Bar dataKey="pending" fill="hsl(var(--muted))" name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Grade Distribution</CardTitle>
                  <CardDescription>Student performance overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={gradeDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ range, count }) => count > 0 ? `${range}: ${count}` : ''}
                        outerRadius={80}
                        fill="hsl(var(--primary))"
                        dataKey="count"
                      >
                        {gradeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))' 
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pending Reviews</CardTitle>
                <CardDescription>Submissions awaiting grading</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <div className="text-3xl font-bold">{analytics.pendingSubmissions}</div>
                    <p className="text-sm text-muted-foreground">assignments need your review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>7-Day Engagement Trend</CardTitle>
                <CardDescription>Student activity over the past week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={engagementTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--foreground))" />
                    <YAxis stroke="hsl(var(--foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))' 
                      }} 
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="submissions" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Submissions"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="discussions" 
                      stroke="hsl(var(--secondary))" 
                      strokeWidth={2}
                      name="Forum Activity"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Discussion Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.forumPosts}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total posts created</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Discussion Replies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.forumReplies}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total replies posted</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Avg. Engagement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {analytics.totalStudents > 0 
                      ? Math.round((analytics.forumPosts + analytics.forumReplies) / analytics.totalStudents)
                      : 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Interactions per student</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Key indicators of student success</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Average Grade</span>
                      <span className="font-semibold">{analytics.averageGrade}/100</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${analytics.averageGrade}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Completion Rate</span>
                      <span className="font-semibold">{analytics.completionRate}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-secondary h-2 rounded-full" 
                        style={{ width: `${analytics.completionRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Forum Participation</span>
                      <span className="font-semibold">
                        {analytics.totalStudents > 0 
                          ? Math.round(((analytics.forumPosts + analytics.forumReplies) / analytics.totalStudents) * 10)
                          : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-accent h-2 rounded-full" 
                        style={{ 
                          width: `${analytics.totalStudents > 0 
                            ? Math.min(((analytics.forumPosts + analytics.forumReplies) / analytics.totalStudents) * 10, 100)
                            : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                  <CardDescription>Summary of course performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm text-muted-foreground">Total Submissions</span>
                    <span className="font-semibold">{analytics.totalSubmissions}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm text-muted-foreground">Graded Submissions</span>
                    <span className="font-semibold">{analytics.totalSubmissions - analytics.pendingSubmissions}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm text-muted-foreground">Pending Reviews</span>
                    <span className="font-semibold text-primary">{analytics.pendingSubmissions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Discussion Threads</span>
                    <span className="font-semibold">{analytics.forumPosts}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;