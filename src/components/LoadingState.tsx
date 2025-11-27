import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Brain, Video, BarChart3, FileText, Clock, ActivitySquare } from "lucide-react";
import monkeyMascot from "@/assets/mascot-goodjob-new.png";
import { AnalysisJobState } from "@/services/api";

const ANALYSIS_STEPS = [
  { icon: Video, label: "下载并分析视频内容", duration: 30000 }, // 30秒
  { icon: Brain, label: "AI深度学习分析", duration: 30000 },      // 30秒
  { icon: BarChart3, label: "生成数据报告", duration: 30000 },    // 35秒
  { icon: FileText, label: "准备最终报告", duration: 300000 }      // 30秒
]; // 总时长：60秒

interface LoadingStateProps {
  jobState?: AnalysisJobState | null;
  logs?: { id: string; timestamp: string; message: string }[];
  nextPollSeconds?: number | null;
}

const statusLabels: Record<string, { label: string; badgeClass: string }> = {
  queued: { label: "排队中", badgeClass: "bg-amber-100 text-amber-700" },
  processing: { label: "处理中", badgeClass: "bg-blue-100 text-blue-700" },
  completed: { label: "已完成", badgeClass: "bg-emerald-100 text-emerald-700" },
  failed: { label: "失败", badgeClass: "bg-red-100 text-red-700" }
};

export const LoadingState = ({
  jobState = null,
  logs = [],
  nextPollSeconds = null
}: LoadingStateProps = {}) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const statusMeta = jobState ? statusLabels[jobState.status] : null;

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

  const formattedJobState = useMemo(() => {
    if (!jobState) {
      return null;
    }

    return [
      {
        label: "任务状态",
        value: statusMeta?.label || jobState.status,
        icon: ActivitySquare,
        extraClass: statusMeta?.badgeClass
      },
      {
        label: "队列序号",
        value: jobState.position,
        icon: Clock
      },
      {
        label: "预计等待",
        value:
          jobState.estimatedWaitSeconds > 0
            ? `${jobState.estimatedWaitSeconds} 秒`
            : "计算中",
        icon: Clock
      },
      {
        label: "累计用时",
        value: jobState.durationSeconds ? `${jobState.durationSeconds} 秒` : "待定",
        icon: FileText
      }
    ];
  }, [jobState, statusMeta]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/20 via-background to-secondary/20">
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
                <p className="text-sm text-muted-foreground">
                  系统已切换为异步模式，您可以保持页面打开观看实时进度
                </p>
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

              {formattedJobState && (
                <div className="space-y-3 pt-4 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-muted-foreground">实时指标</h4>
                    {nextPollSeconds && (
                      <span className="text-xs text-muted-foreground">
                        下次轮询：约 {nextPollSeconds} 秒
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {formattedJobState.map((metric) => {
                      const Icon = metric.icon;
                      return (
                        <div
                          key={metric.label}
                          className="p-3 rounded-lg border border-border bg-background/80 shadow-sm"
                        >
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Icon className="w-4 h-4" />
                            {metric.label}
                          </div>
                          <div
                            className={`mt-2 text-lg font-semibold ${
                              metric.extraClass
                                ? `${metric.extraClass} inline-flex px-2 py-0.5 rounded-full`
                                : "text-foreground"
                            }`}
                          >
                            {metric.value}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {logs.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-border/60">
                  <h4 className="text-sm font-semibold text-muted-foreground">监控日志</h4>
                  <div className="bg-muted/60 rounded-lg max-h-48 overflow-y-auto w-full text-left font-mono text-xs border border-border/60">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="px-3 py-2 border-b border-border/40 last:border-b-0 flex gap-2"
                      >
                        <span className="text-muted-foreground min-w-[70px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-foreground">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
