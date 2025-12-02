import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useModuleCompletion(moduleId: string, studentId: string | null) {
  const [completion, setCompletion] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    const fetchCompletion = async () => {
      try {
        const { data, error } = await supabase.rpc('get_module_completion', {
          p_module_id: moduleId,
          p_student_id: studentId
        });

        if (error) throw error;
        setCompletion(data || 0);
      } catch (error) {
        console.error('Error fetching module completion:', error);
        setCompletion(0);
      } finally {
        setLoading(false);
      }
    };

    fetchCompletion();

    // Subscribe to changes in submissions and resource views
    const submissionsChannel = supabase
      .channel('completion-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: `student_id=eq.${studentId}`
        },
        () => fetchCompletion()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'resource_views',
          filter: `student_id=eq.${studentId}`
        },
        () => fetchCompletion()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(submissionsChannel);
    };
  }, [moduleId, studentId]);

  return { completion, loading };
}
