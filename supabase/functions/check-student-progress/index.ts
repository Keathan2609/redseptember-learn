import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.82.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StudentAlert {
  studentId: string;
  studentName: string;
  studentEmail: string;
  facilitatorEmail: string;
  courseTitle: string;
  alertType: "low_progress" | "missed_deadline" | "low_grade";
  details: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all facilitators
    const { data: facilitators } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "facilitator");

    if (!facilitators || facilitators.length === 0) {
      return new Response(JSON.stringify({ message: "No facilitators found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const alerts: StudentAlert[] = [];

    for (const facilitator of facilitators) {
      // Get facilitator's courses
      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .eq("facilitator_id", facilitator.id);

      if (!courses || courses.length === 0) continue;

      const courseIds = courses.map((c) => c.id);

      // Get enrollments for these courses
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          course_id,
          progress,
          profiles!enrollments_student_id_fkey(id, full_name, email)
        `)
        .in("course_id", courseIds);

      if (!enrollments) continue;

      // Check for low progress (below 30%)
      for (const enrollment of enrollments) {
        const student = enrollment.profiles as any;
        const course = courses.find((c) => c.id === enrollment.course_id);
        
        if (enrollment.progress < 30) {
          alerts.push({
            studentId: student.id,
            studentName: student.full_name || "Unknown",
            studentEmail: student.email,
            facilitatorEmail: facilitator.email,
            courseTitle: course?.title || "Unknown Course",
            alertType: "low_progress",
            details: `Student has only completed ${enrollment.progress}% of the course`,
          });
        }
      }

      // Check for missed deadlines
      const { data: modules } = await supabase
        .from("modules")
        .select("id")
        .in("course_id", courseIds);

      if (modules && modules.length > 0) {
        const moduleIds = modules.map((m) => m.id);
        const now = new Date().toISOString();

        const { data: overdueAssessments } = await supabase
          .from("assessments")
          .select(`
            id,
            title,
            due_date,
            modules!assessments_module_id_fkey(
              course_id,
              courses!modules_course_id_fkey(title)
            )
          `)
          .in("module_id", moduleIds)
          .lt("due_date", now);

        if (overdueAssessments) {
          for (const assessment of overdueAssessments) {
            // Get students who haven't submitted
            const { data: submissions } = await supabase
              .from("submissions")
              .select("student_id")
              .eq("assessment_id", assessment.id);

            const submittedStudentIds = submissions?.map((s) => s.student_id) || [];
            
            // Get enrolled students who haven't submitted
            const moduleData = assessment.modules as any;
            const courseId = moduleData?.course_id;
            
            if (courseId) {
              const { data: enrolledStudents } = await supabase
                .from("enrollments")
                .select(`
                  student_id,
                  profiles!enrollments_student_id_fkey(id, full_name, email)
                `)
                .eq("course_id", courseId);

              if (enrolledStudents) {
                for (const enrollment of enrolledStudents) {
                  if (!submittedStudentIds.includes(enrollment.student_id)) {
                    const student = enrollment.profiles as any;
                    alerts.push({
                      studentId: student.id,
                      studentName: student.full_name || "Unknown",
                      studentEmail: student.email,
                      facilitatorEmail: facilitator.email,
                      courseTitle: moduleData?.courses?.title || "Unknown Course",
                      alertType: "missed_deadline",
                      details: `Missed deadline for "${assessment.title}" on ${new Date(assessment.due_date).toLocaleDateString()}`,
                    });
                  }
                }
              }
            }
          }
        }

        // Check for low grades (below 60)
        const { data: assessments } = await supabase
          .from("assessments")
          .select("id")
          .in("module_id", moduleIds);

        if (assessments && assessments.length > 0) {
          const assessmentIds = assessments.map((a) => a.id);

          const { data: lowGradeSubmissions } = await supabase
            .from("submissions")
            .select(`
              student_id,
              grade,
              assessments!submissions_assessment_id_fkey(
                title,
                modules!assessments_module_id_fkey(
                  courses!modules_course_id_fkey(title)
                )
              ),
              profiles!submissions_student_id_fkey(id, full_name, email)
            `)
            .in("assessment_id", assessmentIds)
            .not("grade", "is", null)
            .lt("grade", 60);

          if (lowGradeSubmissions) {
            for (const submission of lowGradeSubmissions) {
              const student = submission.profiles as any;
              const assessment = submission.assessments as any;
              const course = assessment?.modules?.courses;

              alerts.push({
                studentId: student.id,
                studentName: student.full_name || "Unknown",
                studentEmail: student.email,
                facilitatorEmail: facilitator.email,
                courseTitle: course?.title || "Unknown Course",
                alertType: "low_grade",
                details: `Received grade of ${submission.grade} on "${assessment.title}"`,
              });
            }
          }
        }
      }
    }

    // Group alerts by facilitator
    const alertsByFacilitator = alerts.reduce((acc, alert) => {
      if (!acc[alert.facilitatorEmail]) {
        acc[alert.facilitatorEmail] = [];
      }
      acc[alert.facilitatorEmail].push(alert);
      return acc;
    }, {} as Record<string, StudentAlert[]>);

    // Send emails
    const emailPromises = Object.entries(alertsByFacilitator).map(
      async ([email, facilitorAlerts]) => {
        const alertsByType = {
          low_progress: facilitorAlerts.filter((a) => a.alertType === "low_progress"),
          missed_deadline: facilitorAlerts.filter((a) => a.alertType === "missed_deadline"),
          low_grade: facilitorAlerts.filter((a) => a.alertType === "low_grade"),
        };

        const htmlContent = `
          <h1>Student Progress Alerts</h1>
          <p>You have ${facilitorAlerts.length} student alert(s) requiring your attention.</p>
          
          ${alertsByType.low_progress.length > 0 ? `
            <h2>Students with Low Progress</h2>
            <ul>
              ${alertsByType.low_progress.map((a) => `
                <li><strong>${a.studentName}</strong> (${a.courseTitle}): ${a.details}</li>
              `).join("")}
            </ul>
          ` : ""}
          
          ${alertsByType.missed_deadline.length > 0 ? `
            <h2>Missed Assessment Deadlines</h2>
            <ul>
              ${alertsByType.missed_deadline.map((a) => `
                <li><strong>${a.studentName}</strong> (${a.courseTitle}): ${a.details}</li>
              `).join("")}
            </ul>
          ` : ""}
          
          ${alertsByType.low_grade.length > 0 ? `
            <h2>Students with Low Grades</h2>
            <ul>
              ${alertsByType.low_grade.map((a) => `
                <li><strong>${a.studentName}</strong> (${a.courseTitle}): ${a.details}</li>
              `).join("")}
            </ul>
          ` : ""}
          
          <p>Please review these students' progress and consider reaching out to provide support.</p>
        `;

        try {
          await resend.emails.send({
            from: "LMS Progress Alerts <onboarding@resend.dev>",
            to: [email],
            subject: `Student Progress Alert - ${facilitorAlerts.length} Alert(s)`,
            html: htmlContent,
          });
          console.log(`Email sent to ${email}`);
        } catch (error) {
          console.error(`Failed to send email to ${email}:`, error);
        }
      }
    );

    await Promise.all(emailPromises);

    return new Response(
      JSON.stringify({
        success: true,
        alertsProcessed: alerts.length,
        emailsSent: Object.keys(alertsByFacilitator).length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in check-student-progress:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
