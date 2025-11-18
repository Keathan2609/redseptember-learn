import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-accent">
      <div className="text-center max-w-4xl px-6">
        <div className="flex justify-center mb-8">
          <div className="p-6 bg-gradient-primary rounded-3xl shadow-glow animate-pulse">
            <GraduationCap className="h-24 w-24 text-primary-foreground" />
          </div>
        </div>
        
        <h1 className="text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
          RedSeptember LMS
        </h1>
        
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          Your comprehensive Learning Management System for modern education. 
          Courses, assessments, discussions, and resources all in one place.
        </p>
        
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            className="bg-gradient-primary hover:opacity-90 transition-smooth text-lg px-8 shadow-glow"
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
