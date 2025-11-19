import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VideoAnalysisForm } from "@/components/VideoAnalysisForm";
import { LoadingState } from "@/components/LoadingState";
import { ReportDisplay } from "@/components/ReportDisplay";
import logo51Talk from "@/assets/51talk-logo.jpg";
import {
  videoAnalysisAPI,
  VideoAnalysisResponse,
  AnalysisJobState,
} from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type AppState = "form" | "loading" | "report";

interface FormData {
  video1: string;
  video2: string;
  studentName: string;
  studentId: string;
  grade: string;
  level: string;
  unit: string;
  date: string;
  date2: string;
  apiKey?: string;
  useMockData?: boolean;
}

interface JobProgressLog {
  id: string;
  timestamp: string;
  message: string;
}

const Index = () => {
  const [appState, setAppState] = useState<AppState>("form");
  const [reportData, setReportData] = useState<VideoAnalysisResponse | null>(null);
  const [jobState, setJobState] = useState<AnalysisJobState | null>(null);
  const [jobLogs, setJobLogs] = useState<JobProgressLog[]>([]);
  const [nextPollSeconds, setNextPollSeconds] = useState<number | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const pollTokenRef = useRef(0);

  const cancelPolling = useCallback(() => {
    pollTokenRef.current += 1;
  }, []);

  const resetJobTracking = useCallback(() => {
    setJobState(null);
    setJobLogs([]);
    setNextPollSeconds(null);
  }, []);

  const appendJobLog = useCallback((message: string) => {
    setJobLogs((prev) => {
      const entry: JobProgressLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        message,
      };
      const merged = [...prev, entry];
      return merged.slice(-25);
    });
  }, []);

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const calculateNextDelay = (job: AnalysisJobState, previousDelay: number) => {
    if (job.status === "queued" && job.estimatedWaitSeconds > 0) {
      return Math.min(60000, Math.max(5000, Math.round((job.estimatedWaitSeconds * 1000) / 2)));
    }
    if (job.status === "processing") {
      return Math.min(60000, Math.max(7000, previousDelay * 0.9));
    }
    return Math.max(5000, Math.min(previousDelay * 1.1, 15000));
  };

  const waitForJobCompletion = useCallback(
    async (jobId: string, sessionToken: number, initialDelaySeconds?: number) => {
      let delayMs = Math.max(
        5000,
        Math.min(60000, (initialDelaySeconds ?? 10) * 1000)
      );
      let attempt = 0;

      while (pollTokenRef.current === sessionToken) {
        await wait(delayMs);
        attempt += 1;
        appendJobLog(`第 ${attempt} 次轮询任务状态（间隔 ${Math.round(delayMs / 1000)} 秒）`);

        if (pollTokenRef.current !== sessionToken) {
          break;
        }

        const latestJob = await videoAnalysisAPI.getAnalysisJob(jobId);
        if (pollTokenRef.current !== sessionToken) {
          break;
        }

        setJobState(latestJob);

        if (latestJob.status === "completed" && latestJob.result) {
          appendJobLog("任务已完成，正在载入报告数据");
          return latestJob.result;
        }

        if (latestJob.status === "failed") {
          appendJobLog(
            `任务失败：${latestJob.error?.userMessage || latestJob.error?.message || "未知原因"}`
          );
          throw new Error(
            latestJob.error?.userMessage ||
              latestJob.error?.message ||
              "分析任务失败，请稍后重试"
          );
        }

        delayMs = calculateNextDelay(latestJob, delayMs);
        setNextPollSeconds(Math.round(delayMs / 1000));
      }

      throw new Error("分析任务已被取消");
    },
    [appendJobLog]
  );

  const handleFormSubmit = async (data: FormData) => {
    console.log('🚀 Form submitted with data:', data);
    setAppState("loading");
    cancelPolling();
    resetJobTracking();
    const sessionToken = ++pollTokenRef.current;
    
    try {
      console.log('📡 Calling async analysis API...');
        const requestData = {
          ...data,
          userId: user?.id
        };

      appendJobLog('已发送分析请求，等待任务排队结果...');
      const enqueueResult = await videoAnalysisAPI.enqueueAnalysis(requestData);
      setJobState(enqueueResult.job);
      setNextPollSeconds(enqueueResult.pollAfterSeconds);

      appendJobLog(
        enqueueResult.job.status === "queued"
          ? `任务已入队，当前位置 ${enqueueResult.job.position || 0}`
          : "任务已开始处理"
      );

      if (
        enqueueResult.job.status === "completed" &&
        enqueueResult.job.result &&
        pollTokenRef.current === sessionToken
      ) {
        appendJobLog("任务已即时完成");
        setReportData(enqueueResult.job.result);
      } else {
        const result = await waitForJobCompletion(
          enqueueResult.job.jobId,
          sessionToken,
          enqueueResult.pollAfterSeconds
        );
        setReportData(result);
      }
        
        setAppState("report");
        
        toast({
          title: "分析完成！",
          description: "已成功生成学习报告",
        });
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      
      setAppState("form");
      cancelPolling();
      resetJobTracking();
      
      // 格式化错误消息，处理多行错误
      let errorMessage = error instanceof Error ? error.message : "未知错误，请稍后重试";
      
      // 将换行符替换为空格，使错误消息在 toast 中更易读
      errorMessage = errorMessage.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      
      // 提取错误标题和描述
      let errorTitle = "分析失败";
      let errorDescription = errorMessage;
      
      // 如果是阿里云相关的错误，提取更友好的标题
      if (errorMessage.includes('阿里云')) {
        if (errorMessage.includes('未配置 API Key')) {
          errorTitle = "阿里云 API Key 未配置";
          errorDescription = "请配置环境变量 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET。系统已配置为强制使用阿里云转录服务。";
        } else if (errorMessage.includes('免费额度已用完')) {
          errorTitle = "阿里云免费额度已用完";
          errorDescription = "请检查免费额度是否已用完，或等待下月重置。系统已配置为强制使用阿里云转录服务。";
        }
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
        duration: 8000, // 显示更长时间以便用户阅读
      });
    }
  };

  const handleBackToForm = () => {
    setAppState("form");
    setReportData(null);
    cancelPolling();
    resetJobTracking();
  };

  const handleBackToLogin = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error('Logout error:', error);
      // 即使登出失败，也尝试导航到登录页
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {appState === "form" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl mb-8">
            <div className="flex justify-end mb-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBackToLogin}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">回到登录页面</span>
                <span className="sm:hidden">登录</span>
              </Button>
            </div>
            <div className="text-center">
            <img 
              src={logo51Talk} 
              alt="51Talk Logo" 
              className="h-16 mx-auto mb-4 bg-white p-2 rounded shadow-md"
            />
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-2">
              51Talk 学习分析
            </h1>
            <p className="text-lg text-muted-foreground">
              AI驱动的英语学习进步追踪系统
            </p>
            </div>
          </div>
          <VideoAnalysisForm onSubmit={handleFormSubmit} />
        </div>
      )}

      {appState === "loading" && (
        <LoadingState
          jobState={jobState}
          logs={jobLogs}
          nextPollSeconds={nextPollSeconds}
        />
      )}

      {appState === "report" && reportData && (
        <ReportDisplay
          data={reportData}
          onBack={handleBackToForm}
        />
      )}
    </div>
  );
};

export default Index;
