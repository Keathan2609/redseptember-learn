import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle } from "lucide-react";

interface Question {
  id: string;
  question: string;
  type: "multiple-choice" | "text";
  options?: string[];
  correctAnswer?: string;
  points: number;
}

interface AssessmentTakingProps {
  assessment: {
    id: string;
    title: string;
    description: string;
    questions: Question[];
    total_points: number;
    due_date: string;
  };
  onSubmit: () => void;
}

export default function AssessmentTaking({ assessment, onSubmit }: AssessmentTakingProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });
  };

  const validateAnswers = () => {
    const errors: Record<string, string> = {};
    assessment.questions.forEach(q => {
      if (!answers[q.id] || answers[q.id].trim() === "") {
        errors[q.id] = "This question is required";
      }
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const calculateAutoGrade = () => {
    let totalPoints = 0;
    assessment.questions.forEach(q => {
      if (q.type === "multiple-choice" && q.correctAnswer) {
        if (answers[q.id] === q.correctAnswer) {
          totalPoints += q.points;
        }
      }
    });
    return totalPoints;
  };

  const handleSubmit = async () => {
    if (!validateAnswers()) {
      toast({
        title: "Incomplete Assessment",
        description: "Please answer all questions before submitting",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const autoGrade = calculateAutoGrade();

      const { error } = await supabase.from("submissions").insert({
        assessment_id: assessment.id,
        student_id: user.id,
        answers,
        auto_grade: autoGrade,
      });

      if (error) throw error;

      toast({
        title: "Assessment Submitted",
        description: `Your answers have been submitted successfully. Auto-grade: ${autoGrade}/${assessment.total_points}`,
      });

      onSubmit();
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>{assessment.title}</CardTitle>
          <CardDescription>
            {assessment.description} | Total Points: {assessment.total_points}
            {assessment.due_date && ` | Due: ${new Date(assessment.due_date).toLocaleDateString()}`}
          </CardDescription>
        </CardHeader>
      </Card>

      {assessment.questions.map((question, index) => (
        <Card key={question.id} className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-start justify-between">
              <span>
                {index + 1}. {question.question}
              </span>
              <span className="text-sm text-muted-foreground ml-4">
                {question.points} pts
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {question.type === "multiple-choice" && question.options ? (
              <RadioGroup
                value={answers[question.id] || ""}
                onValueChange={(value) => handleAnswerChange(question.id, value)}
              >
                {question.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`${question.id}-${optIndex}`} />
                    <Label htmlFor={`${question.id}-${optIndex}`}>{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <Textarea
                value={answers[question.id] || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Type your answer here..."
                rows={4}
              />
            )}
            {validationErrors[question.id] && (
              <div className="flex items-center gap-2 text-destructive text-sm mt-2">
                <XCircle className="h-4 w-4" />
                {validationErrors[question.id]}
              </div>
            )}
            {answers[question.id] && !validationErrors[question.id] && (
              <div className="flex items-center gap-2 text-green-600 text-sm mt-2">
                <CheckCircle className="h-4 w-4" />
                Answer saved
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end gap-4">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="lg"
        >
          {isSubmitting ? "Submitting..." : "Submit Assessment"}
        </Button>
      </div>
    </div>
  );
}
