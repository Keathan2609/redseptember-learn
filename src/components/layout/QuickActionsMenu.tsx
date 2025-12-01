import { useState, useEffect } from "react";
import { Plus, BookOpen, FileText, MessageSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function QuickActionsMenu() {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setRole(profile?.role || null);
      }
    };
    fetchRole();
  }, []);

  if (!role) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" className="rounded-full fixed bottom-6 right-6 h-14 w-14 shadow-lg z-50">
          <Plus className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {role === "facilitator" ? (
          <>
            <DropdownMenuItem onClick={() => navigate("/courses")}>
              <BookOpen className="mr-2 h-4 w-4" />
              <span>Create Course</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/resources")}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Upload Resource</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/forum")}>
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>New Discussion</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/calendar")}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Add Event</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => navigate("/courses")}>
              <BookOpen className="mr-2 h-4 w-4" />
              <span>Browse Courses</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/forum")}>
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>New Post</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/calendar")}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>View Calendar</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
