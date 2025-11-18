import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, FileText, MessageSquare } from "lucide-react";

const Dashboard = () => {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    courses: 0,
    upcomingEvents: 0,
    resources: 0,
    discussions: 0,
  });

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
          const { count: coursesCount } = await supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .eq("student_id", user.id);
          setStats((prev) => ({ ...prev, courses: coursesCount || 0 }));
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
