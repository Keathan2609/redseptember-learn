import { Home, BookOpen, Calendar, MessageSquare, FileText, BarChart3, Users, Settings, GraduationCap, Video } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
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

  const studentItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Courses", url: "/courses", icon: BookOpen },
    { title: "Gradebook", url: "/gradebook", icon: GraduationCap },
    { title: "Calendar", url: "/calendar", icon: Calendar },
    { title: "Forum", url: "/forum", icon: MessageSquare },
    { title: "Resources", url: "/resources", icon: FileText },
  ];

  const facilitatorItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Courses", url: "/courses", icon: BookOpen },
    { title: "Analytics", url: "/analytics", icon: BarChart3 },
    { title: "Student Progress", url: "/student-progress", icon: Users },
    { title: "Calendar", url: "/calendar", icon: Calendar },
    { title: "Forum", url: "/forum", icon: MessageSquare },
    { title: "Resources", url: "/resources", icon: FileText },
  ];

  const items = role === "facilitator" ? facilitatorItems : studentItems;
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <NavLink 
                      to={item.url} 
                      end 
                      className="flex items-center gap-3"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
