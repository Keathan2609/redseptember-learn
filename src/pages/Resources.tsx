import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

const Resources = () => {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Resources</h1>
          <p className="text-muted-foreground">Course materials and learning resources</p>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No resources available</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Resources from your courses will appear here
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Resources;
