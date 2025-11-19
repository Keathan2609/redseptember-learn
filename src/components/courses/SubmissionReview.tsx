import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Submission {
  id: string;
  student_id: string;
  submitted_at: string;
  file_url?: string;
  grade?: number;
  feedback?: string;
  answers?: any;
  auto_grade?: number;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface SubmissionReviewProps {
  assessmentId: string;
  totalPoints: number;
  questions?: any[];
}

export function SubmissionReview({ assessmentId, totalPoints, questions }: SubmissionReviewProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState<{ [key: string]: { grade: number; feedback: string } }>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmissions();
  }, [assessmentId]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select(`
          *,
          profiles:student_id (
            full_name,
            email
          )
        `)
        .eq("assessment_id", assessmentId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGradeSubmit = async (submissionId: string) => {
    const gradeData = grading[submissionId];
    if (!gradeData) return;

    try {
      const { error } = await supabase
        .from("submissions")
        .update({
          grade: gradeData.grade,
          feedback: gradeData.feedback,
          graded_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Submission graded successfully",
      });

      fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateAutoGrade = (submission: Submission) => {
    if (!questions || !submission.answers) return null;
    
    let score = 0;
    questions.forEach((q: any) => {
      if (q.type === "multiple-choice" && submission.answers[q.id] !== undefined) {
        if (submission.answers[q.id] === q.correctAnswer) {
          score += q.points;
        }
      }
    });
    return score;
  };

  if (loading) {
    return <div className="text-center py-8">Loading submissions...</div>;
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No submissions yet
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => {
        const autoGrade = calculateAutoGrade(submission);
        
        return (
          <Card key={submission.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{submission.profiles.full_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{submission.profiles.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted: {new Date(submission.submitted_at).toLocaleString()}
                  </p>
                </div>
                {submission.grade !== null && submission.grade !== undefined ? (
                  <Badge variant="secondary">
                    Graded: {submission.grade}/{totalPoints}
                  </Badge>
                ) : autoGrade !== null ? (
                  <Badge variant="outline">
                    Auto: {autoGrade}/{totalPoints}
                  </Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {submission.file_url && (
                <div>
                  <Label>Submission File</Label>
                  <a
                    href={submission.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline block"
                  >
                    View Submitted File
                  </a>
                </div>
              )}

              {submission.answers && questions && (
                <div className="space-y-3">
                  <Label>Answers</Label>
                  {questions.map((q: any, idx: number) => (
                    <div key={q.id} className="border rounded-lg p-3">
                      <p className="font-medium mb-2">{idx + 1}. {q.question}</p>
                      {q.type === "multiple-choice" ? (
                        <div className="space-y-1">
                          {q.options?.map((opt: string, optIdx: number) => (
                            <div
                              key={optIdx}
                              className={`p-2 rounded ${
                                submission.answers[q.id] === optIdx
                                  ? optIdx === q.correctAnswer
                                    ? "bg-green-500/20"
                                    : "bg-red-500/20"
                                  : optIdx === q.correctAnswer
                                  ? "bg-green-500/10"
                                  : ""
                              }`}
                            >
                              {opt}
                              {submission.answers[q.id] === optIdx && " ✓"}
                              {optIdx === q.correctAnswer && " (Correct)"}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">{submission.answers[q.id] || "No answer"}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {submission.feedback && (
                <div>
                  <Label>Feedback</Label>
                  <p className="text-muted-foreground">{submission.feedback}</p>
                </div>
              )}

              {(submission.grade === null || submission.grade === undefined) && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Grade (out of {totalPoints})</Label>
                      <Input
                        type="number"
                        max={totalPoints}
                        min="0"
                        placeholder={autoGrade?.toString() || "0"}
                        defaultValue={autoGrade || undefined}
                        onChange={(e) =>
                          setGrading({
                            ...grading,
                            [submission.id]: {
                              ...grading[submission.id],
                              grade: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Feedback</Label>
                    <Textarea
                      placeholder="Optional feedback for the student"
                      rows={3}
                      onChange={(e) =>
                        setGrading({
                          ...grading,
                          [submission.id]: {
                            ...grading[submission.id],
                            feedback: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <Button onClick={() => handleGradeSubmit(submission.id)}>
                    Submit Grade
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
