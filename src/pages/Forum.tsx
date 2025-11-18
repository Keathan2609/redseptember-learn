import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

const Forum = () => {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Discussion Forum</h1>
          <p className="text-muted-foreground">Connect and discuss with your peers</p>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No discussions yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Start a conversation or join existing discussions
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Forum;
