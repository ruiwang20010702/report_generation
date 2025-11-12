import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Brain, Video, BarChart3, FileText } from "lucide-react";
import monkeyMascot from "@/assets/mascot-goodjob-new.png";

const ANALYSIS_STEPS = [
  { icon: Video, label: "下载并分析视频内容", duration: 15000 }, // 15秒
  { icon: Brain, label: "AI深度学习分析", duration: 20000 },      // 20秒
  { icon: BarChart3, label: "生成数据报告", duration: 15000 },    // 15秒
  { icon: FileText, label: "准备最终报告", duration: 10000 }      // 10秒
]; // 总时长：60秒

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

    // 进度条平滑更新，但永远不会达到100%（最多到95%）
    // 这样可以避免进度条完成了但分析还在进行的尴尬情况
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95; // 保持在95%，等待真实API返回后才完成
        }
        return prev + (95 / totalDuration) * 100; // 每100ms增加一点
      });
    }, 100);

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
                className="w-32 h-32 animate-bounce"
                style={{ 
                  imageRendering: 'crisp-edges',
                  WebkitFontSmoothing: 'antialiased',
                  filter: 'drop-shadow(0 0 0 transparent)'
                }}
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-3 bg-primary/20 rounded-full blur-sm"></div>
            </div>

            {/* Progress Section */}
            <div className="w-full space-y-4">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-primary">AI正在分析中...</h3>
                <p className="text-sm text-muted-foreground">预计需要 2-3 分钟，请耐心等待</p>
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
