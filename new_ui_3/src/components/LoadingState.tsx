import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Brain, Video, BarChart3, FileText } from "lucide-react";
import monkeyMascot from "@/assets/monkey-mascot-loading.png";

const ANALYSIS_STEPS = [
  { icon: Video, label: "分析视频内容", duration: 2000 },
  { icon: Brain, label: "AI深度学习分析", duration: 3000 },
  { icon: BarChart3, label: "生成数据报告", duration: 2000 },
  { icon: FileText, label: "准备最终报告", duration: 1000 }
];

export const LoadingState = () => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    let accumulatedTime = 0;
    const totalDuration = ANALYSIS_STEPS.reduce((acc, step) => acc + step.duration, 0);

    ANALYSIS_STEPS.forEach((step, index) => {
      setTimeout(() => {
        setCurrentStep(index);
      }, accumulatedTime);
      accumulatedTime += step.duration;
    });

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (100 / totalDuration) * 50;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero">
      <Card className="w-full max-w-lg shadow-elevated border-2 border-primary/20">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center space-y-8">
            {/* Mascot Animation */}
            <div className="relative">
              <img 
                src={monkeyMascot} 
                alt="51Talk Mascot" 
                className="w-48 h-48 animate-bounce"
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-3 bg-primary/20 rounded-full blur-sm"></div>
            </div>

            {/* Progress Section */}
            <div className="w-full space-y-4">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-primary">AI正在分析中...</h3>
                <p className="text-muted-foreground">预计需要 30-60 秒</p>
              </div>

              <Progress value={progress} className="h-3 bg-muted" />

              {/* Steps */}
              <div className="space-y-3 pt-4">
                {ANALYSIS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = index === currentStep;
                  const isCompleted = index < currentStep;

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                        isActive
                          ? "bg-primary/10 border-2 border-primary"
                          : isCompleted
                          ? "bg-success/10 border border-success/30"
                          : "bg-muted/50 border border-transparent"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : isCompleted
                            ? "bg-success text-success-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span
                        className={`font-medium ${
                          isActive ? "text-primary" : isCompleted ? "text-success" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                      {isCompleted && <span className="ml-auto text-success">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
