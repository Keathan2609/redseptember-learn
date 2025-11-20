import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarIcon, Clock, BookOpen } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  type: "event" | "assessment";
  course_id: string | null;
  course_title?: string;
}

const CalendarPage = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      // Fetch courses based on role
      let coursesQuery = supabase.from("courses").select("id, title");
      
      if (profile?.role === "student") {
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("course_id")
          .eq("student_id", user.id);
        
        const courseIds = enrollments?.map(e => e.course_id) || [];
        coursesQuery = coursesQuery.in("id", courseIds);
      } else if (profile?.role === "facilitator") {
        coursesQuery = coursesQuery.eq("facilitator_id", user.id);
      }

      const { data: coursesData } = await coursesQuery;
      setCourses(coursesData || []);

      const courseIds = coursesData?.map(c => c.id) || [];

      // Fetch calendar events
      const { data: calendarEvents } = await supabase
        .from("calendar_events")
        .select(`
          id,
          title,
          description,
          event_date,
          course_id,
          courses(title)
        `)
        .in("course_id", courseIds);

      // Fetch assessments with due dates
      const { data: assessments } = await supabase
        .from("assessments")
        .select(`
          id,
          title,
          description,
          due_date,
          module_id,
          modules(course_id, courses(title))
        `)
        .not("due_date", "is", null)
        .in("modules.course_id", courseIds);

      const allEvents: CalendarEvent[] = [
        ...(calendarEvents?.map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          event_date: e.event_date,
          type: "event" as const,
          course_id: e.course_id,
          course_title: (e.courses as any)?.title,
        })) || []),
        ...(assessments?.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          event_date: a.due_date!,
          type: "assessment" as const,
          course_id: (a.modules as any)?.course_id,
          course_title: (a.modules as any)?.courses?.title,
        })) || []),
      ];

      setEvents(allEvents);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    if (selectedCourse !== "all" && event.course_id !== selectedCourse) {
      return false;
    }
    if (selectedDate) {
      const eventDate = new Date(event.event_date);
      return eventDate.toDateString() === selectedDate.toDateString();
    }
    return true;
  });

  const eventDates = events
    .filter(e => selectedCourse === "all" || e.course_id === selectedCourse)
    .map(e => new Date(e.event_date));

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Calendar</h1>
          <p className="text-muted-foreground">Course schedules and upcoming events</p>
        </div>

        <div className="mb-6">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Filter by course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map(course => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="border-border lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border border-border"
                modifiers={{
                  hasEvent: eventDates,
                }}
                modifiersClassNames={{
                  hasEvent: "bg-primary/20 font-bold",
                }}
              />
            </CardContent>
          </Card>

          <Card className="border-border lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {selectedDate
                  ? `Events on ${format(selectedDate, "MMMM d, yyyy")}`
                  : "All Events"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading events...</p>
              ) : filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No events for this date</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEvents.map(event => (
                    <Card key={event.id} className="border-border/50">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {event.type === "assessment" ? (
                                <Clock className="h-4 w-4 text-destructive" />
                              ) : (
                                <BookOpen className="h-4 w-4 text-primary" />
                              )}
                              <h4 className="font-semibold">{event.title}</h4>
                            </div>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {event.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{format(new Date(event.event_date), "h:mm a")}</span>
                              {event.course_title && (
                                <>
                                  <span>•</span>
                                  <span>{event.course_title}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant={event.type === "assessment" ? "destructive" : "default"}
                          >
                            {event.type === "assessment" ? "Due" : "Event"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CalendarPage;
