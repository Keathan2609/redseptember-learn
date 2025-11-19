import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, FileText, MessageSquare, TrendingUp } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";

const Dashboard = () => {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    courses: 0,
    upcomingEvents: 0,
    resources: 0,
    discussions: 0,
    completionRate: 0,
    averageGrade: 0,
  });
  const [upcomingAssessments, setUpcomingAssessments] = useState<any[]>([]);
  const [gradeData, setGradeData] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<any[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);

        if (data?.role === "student") {
          const { data: enrollments, count: coursesCount } = await supabase
            .from("enrollments")
            .select("*, courses(*)")
            .eq("student_id", user.id);
          
          const { data: submissions } = await supabase
            .from("submissions")
            .select("grade, auto_grade, assessment_id, assessments(total_points)")
            .eq("student_id", user.id);

          const { data: assessments } = await supabase
            .from("assessments")
            .select("*, modules!inner(course_id, courses!inner(enrollments!inner(student_id)))")
            .eq("modules.courses.enrollments.student_id", user.id)
            .gte("due_date", new Date().toISOString())
            .order("due_date", { ascending: true })
            .limit(5);

          const avgProgress = enrollments?.reduce((acc, e) => acc + (e.progress || 0), 0) / (enrollments?.length || 1);
          const avgGrade = submissions?.reduce((acc, s) => acc + (s.grade || s.auto_grade || 0), 0) / (submissions?.length || 1);

          setStats((prev) => ({ 
            ...prev, 
            courses: coursesCount || 0,
            completionRate: Math.round(avgProgress || 0),
            averageGrade: Math.round(avgGrade || 0),
          }));
          
          setUpcomingAssessments(assessments || []);

          const mockGradeData = [
            { name: "Week 1", grade: 85 },
            { name: "Week 2", grade: 78 },
            { name: "Week 3", grade: 92 },
            { name: "Week 4", grade: 88 },
          ];
          setGradeData(mockGradeData);

          const mockProgressData = enrollments?.map((e: any) => ({
            course: e.courses.title.substring(0, 15),
            progress: e.progress || 0,
          })) || [];
          setProgressData(mockProgressData);

        } else if (data?.role === "facilitator") {
          const { count: coursesCount } = await supabase
            .from("courses")
            .select("*", { count: "exact", head: true })
            .eq("facilitator_id", user.id);
          setStats((prev) => ({ ...prev, courses: coursesCount || 0 }));
        }
      }
    };

    fetchProfile();
  }, []);

  const statCards = [
    {
      title: profile?.role === "student" ? "Enrolled Courses" : "My Courses",
      value: stats.courses,
      icon: BookOpen,
      description: profile?.role === "student" ? "Active enrollments" : "Courses you teach",
    },
    {
      title: "Upcoming Events",
      value: stats.upcomingEvents,
      icon: Calendar,
      description: "Scheduled this week",
    },
    {
      title: "Resources",
      value: stats.resources,
      icon: FileText,
      description: "Learning materials",
    },
    {
      title: "Discussions",
      value: stats.discussions,
      icon: MessageSquare,
      description: "Active threads",
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Welcome back, {profile?.full_name || "User"}
          </h1>
          <p className="text-muted-foreground capitalize">
            {profile?.role} Dashboard
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.title} className="border-border bg-card hover:shadow-glow transition-smooth">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {profile?.role === "student" && (
          <>
            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Grade Trend
                  </CardTitle>
                  <CardDescription>Your performance over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      grade: {
                        label: "Grade",
                        color: "hsl(var(--primary))",
                      },
                    }}
                    className="h-[200px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={gradeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="grade" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Course Progress</CardTitle>
                  <CardDescription>Completion status by course</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      progress: {
                        label: "Progress",
                        color: "hsl(var(--primary))",
                      },
                    }}
                    className="h-[200px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="course" />
                        <YAxis domain={[0, 100]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="progress" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border bg-card mb-8">
              <CardHeader>
                <CardTitle>Upcoming Assessments</CardTitle>
                <CardDescription>Deadlines to keep in mind</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingAssessments.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingAssessments.map((assessment) => (
                      <div key={assessment.id} className="flex justify-between items-center border-b border-border pb-2">
                        <div>
                          <p className="font-medium">{assessment.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {assessment.assessment_type} • {assessment.total_points} points
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Due: {new Date(assessment.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No upcoming assessments</p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest updates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">No recent activity</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Actions will appear here</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
