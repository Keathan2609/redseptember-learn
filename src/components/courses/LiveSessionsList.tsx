import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Calendar, Clock, ExternalLink, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isFuture, isWithinInterval, addMinutes } from "date-fns";
import { toast } from "sonner";

interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  meeting_provider: string | null;
  status: string | null;
}

interface LiveSessionsListProps {
  courseId: string;
  isEnrolled: boolean;
  isFacilitator: boolean;
}

export const LiveSessionsList = ({ courseId, isEnrolled, isFacilitator }: LiveSessionsListProps) => {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, [courseId]);

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from("live_sessions")
      .select("*")
      .eq("course_id", courseId)
      .order("scheduled_at", { ascending: true });

    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  };

  const getSessionStatus = (session: LiveSession) => {
    const start = new Date(session.scheduled_at);
    const end = addMinutes(start, session.duration_minutes);
    const now = new Date();

    if (isWithinInterval(now, { start, end })) return "live";
    if (isFuture(start)) return "upcoming";
    return "completed";
  };

  const handleJoinSession = async (session: LiveSession) => {
    if (!session.meeting_url) {
      toast.error("Meeting URL not available yet");
      return;
    }

    // Track attendance
    const { data: { user } } = await supabase.auth.getUser();
    if (user && !isFacilitator) {
      await supabase.from("session_attendance").upsert({
        session_id: session.id,
        student_id: user.id,
        joined_at: new Date().toISOString()
      });
    }

    window.open(session.meeting_url, "_blank");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return <Badge className="bg-destructive animate-pulse">Live Now</Badge>;
      case "upcoming":
        return <Badge variant="secondary">Upcoming</Badge>;
      default:
        return <Badge variant="outline">Completed</Badge>;
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading sessions...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No live sessions scheduled yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => {
        const status = getSessionStatus(session);
        return (
          <Card key={session.id} className={status === "live" ? "border-destructive" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{session.title}</CardTitle>
                {getStatusBadge(status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {session.description && (
                <p className="text-sm text-muted-foreground">{session.description}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(session.scheduled_at), "MMM d, yyyy")}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(new Date(session.scheduled_at), "h:mm a")} ({session.duration_minutes} min)
                </div>
                {session.meeting_provider && (
                  <Badge variant="outline" className="capitalize">
                    {session.meeting_provider.replace("_", " ")}
                  </Badge>
                )}
              </div>
              {(isEnrolled || isFacilitator) && session.meeting_url && (status === "live" || status === "upcoming") && (
                <Button
                  onClick={() => handleJoinSession(session)}
                  className={status === "live" ? "bg-destructive hover:bg-destructive/90" : ""}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {status === "live" ? "Join Now" : "Join Session"}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
