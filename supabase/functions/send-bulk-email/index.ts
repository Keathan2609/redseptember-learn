import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  studentIds: string[];
  subject: string;
  message: string;
  courseId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { studentIds, subject, message, courseId }: BulkEmailRequest = await req.json();

    console.log(`Sending bulk email to ${studentIds.length} students`);

    // Fetch student profiles
    const { data: students, error: studentsError } = await supabaseClient
      .from("profiles")
      .select("id, email, full_name")
      .in("id", studentIds);

    if (studentsError) {
      console.error("Error fetching students:", studentsError);
      throw studentsError;
    }

    // Fetch course details if courseId provided
    let courseName = "Course";
    if (courseId) {
      const { data: course } = await supabaseClient
        .from("courses")
        .select("title")
        .eq("id", courseId)
        .single();
      
      if (course) courseName = course.title;
    }

    // Send emails to all students
    const emailPromises = students.map(async (student) => {
      try {
        const emailResponse = await resend.emails.send({
          from: "RedSeptember LMS <onboarding@resend.dev>",
          to: [student.email],
          subject: `${courseName}: ${subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #DC2626;">Course Announcement</h2>
              <p>Hello ${student.full_name || "Student"},</p>
              <div style="background-color: #f5f5f5; padding: 20px; border-left: 4px solid #DC2626; margin: 20px 0;">
                ${message.split('\n').map(line => `<p>${line}</p>`).join('')}
              </div>
              <p style="color: #666; font-size: 14px;">
                This message was sent from ${courseName} via RedSeptember LMS.
              </p>
            </div>
          `,
        });

        console.log(`Email sent to ${student.email}:`, emailResponse);
        return { success: true, email: student.email };
      } catch (error) {
        console.error(`Failed to send email to ${student.email}:`, error);
        return { success: false, email: student.email, error };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`Successfully sent ${successCount}/${students.length} emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        total: students.length,
        results 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
