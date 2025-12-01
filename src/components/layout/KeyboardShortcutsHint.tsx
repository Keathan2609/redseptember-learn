import { useState } from "react";
import { Command, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function KeyboardShortcutsHint() {
  const [open, setOpen] = useState(false);

  const shortcuts = [
    { key: "Ctrl + H", description: "Go to Dashboard" },
    { key: "Ctrl + C", description: "Go to Courses" },
    { key: "Ctrl + F", description: "Go to Forum" },
    { key: "Ctrl + R", description: "Go to Resources" },
    { key: "Ctrl + L", description: "Go to Calendar" },
    { key: "Ctrl + N", description: "Open Notifications" },
    { key: "Ctrl + K", description: "Quick Search (Coming Soon)" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-6 left-6 h-10 w-10 rounded-full shadow-md z-50"
          title="Keyboard Shortcuts"
        >
          <Command className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate quickly around the platform
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <kbd className="px-3 py-1 text-xs font-semibold text-foreground bg-background border border-border rounded-md shadow-sm">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
