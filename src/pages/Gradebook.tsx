import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Download, BookOpen, Award, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Course {
  id: string;
  title: string;
}

interface GradeEntry {
  id: string;
  assessment_title: string;
  grade: number | null;
  total_points: number;
  submitted_at: string;
  feedback: string | null;
}

export default function Gradebook() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchUserAndCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchGrades();
    }
  }, [selectedCourse]);

  const fetchUserAndCourses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(profileData);

    // Fetch enrolled courses for students
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("course_id, courses(id, title)")
      .eq("student_id", user.id);

    if (enrollments) {
      const courseList = enrollments
        .filter(e => e.courses)
        .map(e => e.courses as Course);
      setCourses(courseList);
      if (courseList.length > 0) {
        setSelectedCourse(courseList[0].id);
      }
    }
    setLoading(false);
  };

  const fetchGrades = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selectedCourse) return;

    const { data: submissions } = await supabase
      .from("submissions")
      .select(`
        id,
        grade,
        submitted_at,
        feedback,
        assessments(id, title, total_points, module_id, modules(course_id))
      `)
      .eq("student_id", user.id);

    if (submissions) {
      const filteredGrades = submissions
        .filter(s => s.assessments?.modules?.course_id === selectedCourse)
        .map(s => ({
          id: s.id,
          assessment_title: s.assessments?.title || "Unknown",
          grade: s.grade,
          total_points: s.assessments?.total_points || 100,
          submitted_at: s.submitted_at || "",
          feedback: s.feedback
        }));
      setGrades(filteredGrades);
    }
  };

  const calculateOverallGrade = () => {
    const gradedEntries = grades.filter(g => g.grade !== null);
    if (gradedEntries.length === 0) return null;

    const totalEarned = gradedEntries.reduce((sum, g) => sum + (g.grade || 0), 0);
    const totalPossible = gradedEntries.reduce((sum, g) => sum + g.total_points, 0);
    return Math.round((totalEarned / totalPossible) * 100);
  };

  const getLetterGrade = (percentage: number) => {
    if (percentage >= 90) return { letter: "A", color: "bg-green-500" };
    if (percentage >= 80) return { letter: "B", color: "bg-blue-500" };
    if (percentage >= 70) return { letter: "C", color: "bg-yellow-500" };
    if (percentage >= 60) return { letter: "D", color: "bg-orange-500" };
    return { letter: "F", color: "bg-destructive" };
  };

  const downloadTranscript = () => {
    const doc = new jsPDF();
    const courseName = courses.find(c => c.id === selectedCourse)?.title || "Course";
    const overallGrade = calculateOverallGrade();

    // Header
    doc.setFontSize(20);
    doc.text("Academic Transcript", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`Student: ${profile?.full_name || profile?.email}`, 20, 40);
    doc.text(`Course: ${courseName}`, 20, 50);
    doc.text(`Date Generated: ${format(new Date(), "MMMM d, yyyy")}`, 20, 60);
    
    if (overallGrade !== null) {
      const { letter } = getLetterGrade(overallGrade);
      doc.text(`Overall Grade: ${overallGrade}% (${letter})`, 20, 70);
    }

    // Grades table
    const tableData = grades.map(g => [
      g.assessment_title,
      g.grade !== null ? `${g.grade}/${g.total_points}` : "Pending",
      g.grade !== null ? `${Math.round((g.grade / g.total_points) * 100)}%` : "-",
      g.submitted_at ? format(new Date(g.submitted_at), "MMM d, yyyy") : "-"
    ]);

    autoTable(doc, {
      startY: 85,
      head: [["Assessment", "Score", "Percentage", "Submitted"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [139, 0, 0] }
    });

    doc.save(`transcript-${courseName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  const overallGrade = calculateOverallGrade();
  const gradeInfo = overallGrade !== null ? getLetterGrade(overallGrade) : null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gradebook</h1>
            <p className="text-muted-foreground">View your grades and download transcripts</p>
          </div>
          {selectedCourse && grades.length > 0 && (
            <Button onClick={downloadTranscript}>
              <Download className="h-4 w-4 mr-2" />
              Download Transcript
            </Button>
          )}
        </div>

        {courses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">You are not enrolled in any courses yet</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Overall Grade</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {gradeInfo ? (
                    <div className="flex items-center gap-3">
                      <Badge className={`${gradeInfo.color} text-white text-xl px-3 py-1`}>
                        {gradeInfo.letter}
                      </Badge>
                      <span className="text-2xl font-bold">{overallGrade}%</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No grades yet</span>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Assessments Completed</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {grades.filter(g => g.grade !== null).length} / {grades.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {overallGrade !== null ? `${overallGrade}%` : "-"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Grade Details</CardTitle>
              </CardHeader>
              <CardContent>
                {grades.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No assessments submitted yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assessment</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Feedback</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grades.map(grade => (
                        <TableRow key={grade.id}>
                          <TableCell className="font-medium">{grade.assessment_title}</TableCell>
                          <TableCell>
                            {grade.grade !== null ? (
                              `${grade.grade}/${grade.total_points}`
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {grade.grade !== null ? (
                              <Badge className={getLetterGrade(Math.round((grade.grade / grade.total_points) * 100)).color}>
                                {Math.round((grade.grade / grade.total_points) * 100)}%
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {grade.submitted_at
                              ? format(new Date(grade.submitted_at), "MMM d, yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {grade.feedback || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
