import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only trigger if Ctrl (or Cmd on Mac) + key is pressed
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        switch (event.key.toLowerCase()) {
          case "k":
            event.preventDefault();
            toast({
              title: "Coming Soon",
              description: "Quick search feature is under development",
            });
            break;
          case "h":
            event.preventDefault();
            navigate("/dashboard");
            toast({ description: "Navigated to Dashboard" });
            break;
          case "c":
            event.preventDefault();
            navigate("/courses");
            toast({ description: "Navigated to Courses" });
            break;
          case "n":
            event.preventDefault();
            toast({
              title: "Notifications",
              description: "Click the bell icon to view notifications",
            });
            break;
          case "f":
            event.preventDefault();
            navigate("/forum");
            toast({ description: "Navigated to Forum" });
            break;
          case "r":
            event.preventDefault();
            navigate("/resources");
            toast({ description: "Navigated to Resources" });
            break;
          case "l":
            event.preventDefault();
            navigate("/calendar");
            toast({ description: "Navigated to Calendar" });
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [navigate]);
}
