import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompletionCheckRequest {
  student_id: string;
  module_id: string;
  course_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { student_id, module_id, course_id }: CompletionCheckRequest = await req.json();

    console.log(`Checking completion for student ${student_id}, module ${module_id}`);

    // Get module completion percentage
    const { data: moduleCompletion, error: moduleError } = await supabase
      .rpc('get_module_completion', {
        p_module_id: module_id,
        p_student_id: student_id
      });

    if (moduleError) {
      console.error('Error getting module completion:', moduleError);
      throw moduleError;
    }

    console.log(`Module completion: ${moduleCompletion}%`);

    // Get module title
    const { data: module } = await supabase
      .from('modules')
      .select('title')
      .eq('id', module_id)
      .single();

    // Check if module is 100% complete and create notification
    if (moduleCompletion === 100) {
      // Check if notification already exists
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', student_id)
        .eq('type', 'module_complete')
        .eq('related_id', module_id)
        .maybeSingle();

      if (!existingNotification) {
        await supabase.from('notifications').insert({
          user_id: student_id,
          type: 'module_complete',
          title: '🎉 Module Complete!',
          message: `Congratulations! You've completed the module "${module?.title || 'Untitled'}"`,
          related_id: module_id,
          is_read: false
        });

        console.log('Created module completion notification');
      }
    }

    // Calculate overall course completion
    const { data: allModules } = await supabase
      .from('modules')
      .select('id')
      .eq('course_id', course_id);

    if (allModules && allModules.length > 0) {
      let totalCompletion = 0;
      
      for (const mod of allModules) {
        const { data: completion } = await supabase
          .rpc('get_module_completion', {
            p_module_id: mod.id,
            p_student_id: student_id
          });
        totalCompletion += (completion || 0);
      }

      const averageCompletion = Math.round(totalCompletion / allModules.length);
      console.log(`Course completion: ${averageCompletion}%`);

      // Get course title
      const { data: course } = await supabase
        .from('courses')
        .select('title')
        .eq('id', course_id)
        .single();

      // Check for milestone achievements (50%, 75%, 100%)
      const milestones = [
        { percentage: 50, emoji: '🚀', title: 'Halfway There!' },
        { percentage: 75, emoji: '⭐', title: 'Almost Done!' },
        { percentage: 100, emoji: '🎓', title: 'Course Complete!' }
      ];

      for (const milestone of milestones) {
        if (averageCompletion >= milestone.percentage) {
          // Check if milestone notification already exists
          const { data: existingMilestone } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', student_id)
            .eq('type', 'course_milestone')
            .eq('related_id', course_id)
            .ilike('title', `%${milestone.percentage}%`)
            .maybeSingle();

          if (!existingMilestone) {
            await supabase.from('notifications').insert({
              user_id: student_id,
              type: 'course_milestone',
              title: `${milestone.emoji} ${milestone.title}`,
              message: `You've reached ${milestone.percentage}% completion in "${course?.title || 'Untitled Course'}"`,
              related_id: course_id,
              is_read: false
            });

            console.log(`Created ${milestone.percentage}% milestone notification`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        moduleCompletion,
        message: 'Completion check completed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in check-completion-milestones:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
