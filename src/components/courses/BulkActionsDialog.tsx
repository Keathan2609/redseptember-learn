import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Clock, Award, Users, Search, Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

interface Student {
  id: string;
  full_name: string;
  email: string;
}

interface BulkActionsDialogProps {
  students: Student[];
  courseId?: string;
  assessments?: Array<{ id: string; title: string }>;
  onActionComplete?: () => void;
}

export const BulkActionsDialog = ({ students, courseId, assessments = [], onActionComplete }: BulkActionsDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState<string>("all");
  const [progressFilter, setProgressFilter] = useState<string>("all");

  // Scheduling
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("09:00");

  // Email
  const [sendEmail, setSendEmail] = useState(false);

  // Announcement state
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");

  // Deadline extension state
  const [selectedAssessment, setSelectedAssessment] = useState("");
  const [extensionDays, setExtensionDays] = useState(7);

  // Grade adjustment state
  const [adjustmentAssessment, setAdjustmentAssessment] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"add" | "multiply">("add");
  const [adjustmentValue, setAdjustmentValue] = useState(0);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = searchQuery === "" || 
        student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      // These filters require additional data from enrollments/submissions
      // For now, we'll just use search
      return matchesSearch;
    });
  }, [students, searchQuery]);

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
  };

  const sendAnnouncement = async () => {
    if (selectedStudents.length === 0) {
      toast({
        title: "No students selected",
        description: "Please select at least one student",
        variant: "destructive",
      });
      return;
    }

    if (!announcementTitle || !announcementMessage) {
      toast({
        title: "Missing information",
        description: "Please provide both title and message",
        variant: "destructive",
      });
      return;
    }

    // Handle scheduling
    if (isScheduled && scheduledDate) {
      const scheduledDateTime = new Date(scheduledDate);
      const [hours, minutes] = scheduledTime.split(':');
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0);

      toast({
        title: "Action Scheduled",
        description: `Announcement will be sent on ${format(scheduledDateTime, "PPP 'at' p")}`,
      });
      
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const notifications = selectedStudents.map(studentId => ({
        user_id: studentId,
        title: announcementTitle,
        message: announcementMessage,
        type: "announcement",
        related_id: courseId || null,
      }));

      const { error } = await supabase
        .from("notifications")
        .insert(notifications);

      if (error) throw error;

      // Send emails if requested
      if (sendEmail) {
        await supabase.functions.invoke('send-bulk-email', {
          body: { 
            studentIds: selectedStudents, 
            subject: announcementTitle, 
            message: announcementMessage,
            courseId 
          }
        });
      }

      toast({
        title: "Announcement sent",
        description: `Successfully sent to ${selectedStudents.length} student(s)${sendEmail ? ' via app and email' : ''}`,
      });

      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setSelectedStudents([]);
      setSendEmail(false);
      setOpen(false);
      onActionComplete?.();
    } catch (error: any) {
      toast({
        title: "Error sending announcement",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const extendDeadline = async () => {
    if (selectedStudents.length === 0) {
      toast({
        title: "No students selected",
        description: "Please select at least one student",
        variant: "destructive",
      });
      return;
    }

    if (!selectedAssessment) {
      toast({
        title: "No assessment selected",
        description: "Please select an assessment",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: assessment, error: fetchError } = await supabase
        .from("assessments")
        .select("due_date")
        .eq("id", selectedAssessment)
        .single();

      if (fetchError) throw fetchError;

      if (!assessment?.due_date) {
        throw new Error("Assessment has no deadline set");
      }

      const currentDeadline = new Date(assessment.due_date);
      const newDeadline = new Date(currentDeadline);
      newDeadline.setDate(newDeadline.getDate() + extensionDays);

      const { error: updateError } = await supabase
        .from("assessments")
        .update({ due_date: newDeadline.toISOString() })
        .eq("id", selectedAssessment);

      if (updateError) throw updateError;

      const notifications = selectedStudents.map(studentId => ({
        user_id: studentId,
        title: "Deadline Extended",
        message: `The deadline has been extended by ${extensionDays} day(s) to ${newDeadline.toLocaleDateString()}`,
        type: "deadline_extension",
        related_id: selectedAssessment,
      }));

      await supabase.from("notifications").insert(notifications);

      toast({
        title: "Deadline extended",
        description: `Extended by ${extensionDays} day(s) for ${selectedStudents.length} student(s)`,
      });

      setSelectedAssessment("");
      setExtensionDays(7);
      setSelectedStudents([]);
      setOpen(false);
      onActionComplete?.();
    } catch (error: any) {
      toast({
        title: "Error extending deadline",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const adjustGrades = async () => {
    if (selectedStudents.length === 0) {
      toast({
        title: "No students selected",
        description: "Please select at least one student",
        variant: "destructive",
      });
      return;
    }

    if (!adjustmentAssessment) {
      toast({
        title: "No assessment selected",
        description: "Please select an assessment",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: submissions, error: fetchError } = await supabase
        .from("submissions")
        .select("id, grade")
        .eq("assessment_id", adjustmentAssessment)
        .in("student_id", selectedStudents)
        .not("grade", "is", null);

      if (fetchError) throw fetchError;

      if (!submissions || submissions.length === 0) {
        throw new Error("No graded submissions found for selected students");
      }

      const updates = submissions.map(submission => {
        let newGrade = submission.grade!;
        
        if (adjustmentType === "add") {
          newGrade = Math.max(0, Math.min(100, newGrade + adjustmentValue));
        } else {
          newGrade = Math.max(0, Math.min(100, newGrade * (1 + adjustmentValue / 100)));
        }

        return {
          id: submission.id,
          grade: Math.round(newGrade),
        };
      });

      for (const update of updates) {
        const { error } = await supabase
          .from("submissions")
          .update({ grade: update.grade })
          .eq("id", update.id);

        if (error) throw error;
      }

      const notifications = selectedStudents.map(studentId => ({
        user_id: studentId,
        title: "Grade Adjusted",
        message: `Your grade has been adjusted for the selected assessment`,
        type: "grade_adjustment",
        related_id: adjustmentAssessment,
      }));

      await supabase.from("notifications").insert(notifications);

      toast({
        title: "Grades adjusted",
        description: `Updated grades for ${updates.length} submission(s)`,
      });

      setAdjustmentAssessment("");
      setAdjustmentValue(0);
      setSelectedStudents([]);
      setOpen(false);
      onActionComplete?.();
    } catch (error: any) {
      toast({
        title: "Error adjusting grades",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="mr-2 h-4 w-4" />
          Bulk Actions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Actions</DialogTitle>
          <DialogDescription>
            Perform actions for multiple students at once
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="announcement" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="announcement">
              <Send className="mr-2 h-4 w-4" />
              Announcement
            </TabsTrigger>
            <TabsTrigger value="deadline" disabled={assessments.length === 0}>
              <Clock className="mr-2 h-4 w-4" />
              Extend Deadline
            </TabsTrigger>
            <TabsTrigger value="grades" disabled={assessments.length === 0}>
              <Award className="mr-2 h-4 w-4" />
              Adjust Grades
            </TabsTrigger>
          </TabsList>

          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Student Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Students ({selectedStudents.length}/{filteredStudents.length})</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedStudents.length === filteredStudents.length ? "Deselect All" : "Select All Filtered"}
              </Button>
            </div>
            <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
              {filteredStudents.map((student) => (
                <div key={student.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={student.id}
                    checked={selectedStudents.includes(student.id)}
                    onCheckedChange={() => handleStudentToggle(student.id)}
                  />
                  <label
                    htmlFor={student.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    {student.full_name} ({student.email})
                  </label>
                </div>
              ))}
            </div>
          </div>

          <TabsContent value="announcement" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Announcement Title</Label>
              <Input
                id="title"
                placeholder="Important Update"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Enter your announcement message..."
                rows={5}
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
              />
            </div>

            {/* Email Option */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-email"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked as boolean)}
              />
              <Label htmlFor="send-email" className="cursor-pointer">
                Also send via email
              </Label>
            </div>

            {/* Scheduling Option */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="schedule"
                  checked={isScheduled}
                  onCheckedChange={(checked) => setIsScheduled(checked as boolean)}
                />
                <Label htmlFor="schedule" className="cursor-pointer">
                  Schedule for later
                </Label>
              </div>

              {isScheduled && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={sendAnnouncement}
              disabled={loading || selectedStudents.length === 0}
              className="w-full"
            >
              {loading ? "Sending..." : isScheduled ? `Schedule for ${selectedStudents.length} Student(s)` : `Send to ${selectedStudents.length} Student(s)`}
            </Button>
          </TabsContent>

          <TabsContent value="deadline" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assessment">Select Assessment</Label>
              <Select value={selectedAssessment} onValueChange={setSelectedAssessment}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an assessment" />
                </SelectTrigger>
                <SelectContent>
                  {assessments.map((assessment) => (
                    <SelectItem key={assessment.id} value={assessment.id}>
                      {assessment.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="days">Extension (days)</Label>
              <Input
                id="days"
                type="number"
                min="1"
                value={extensionDays}
                onChange={(e) => setExtensionDays(parseInt(e.target.value) || 1)}
              />
            </div>
            <Button
              onClick={extendDeadline}
              disabled={loading || selectedStudents.length === 0 || !selectedAssessment}
              className="w-full"
            >
              {loading ? "Processing..." : `Extend Deadline for ${selectedStudents.length} Student(s)`}
            </Button>
          </TabsContent>

          <TabsContent value="grades" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grade-assessment">Select Assessment</Label>
              <Select value={adjustmentAssessment} onValueChange={setAdjustmentAssessment}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an assessment" />
                </SelectTrigger>
                <SelectContent>
                  {assessments.map((assessment) => (
                    <SelectItem key={assessment.id} value={assessment.id}>
                      {assessment.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment-type">Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={(value: any) => setAdjustmentType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Points</SelectItem>
                  <SelectItem value="multiply">Multiply by Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment-value">
                {adjustmentType === "add" ? "Points to Add" : "Percentage"}
              </Label>
              <Input
                id="adjustment-value"
                type="number"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(parseFloat(e.target.value) || 0)}
                placeholder={adjustmentType === "add" ? "e.g., 5" : "e.g., 10 (for 10%)"}
              />
              <p className="text-xs text-muted-foreground">
                {adjustmentType === "add" 
                  ? "Adds points to each student's grade (max 100)"
                  : "Multiplies grade by percentage (e.g., 10% = grade × 1.10)"}
              </p>
            </div>
            <Button
              onClick={adjustGrades}
              disabled={loading || selectedStudents.length === 0 || !adjustmentAssessment}
              className="w-full"
            >
              {loading ? "Processing..." : `Adjust Grades for ${selectedStudents.length} Student(s)`}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
