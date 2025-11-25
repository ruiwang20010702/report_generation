import { useCallback, useEffect, useRef, useState } from "react";
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
import { ReportHistoryPanel } from "@/components/ReportHistoryPanel";
import type { SavedReportSummary, ReportListResponse } from "@/services/api";

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

const STORAGE_KEYS = {
  appState: "video-analysis-app-state",
  reportData: "video-analysis-report-data",
};

const isBrowser = typeof window !== "undefined";

const Index = () => {
  const [appState, setAppState] = useState<AppState>(() => {
    if (!isBrowser) {
      return "form";
    }

    try {
      const storedReport = window.sessionStorage.getItem(STORAGE_KEYS.reportData);
      const storedState = window.sessionStorage.getItem(STORAGE_KEYS.appState) as AppState | null;

      if (storedState === "report" && storedReport) {
        return "report";
      }
    } catch (error) {
      console.warn("Failed to restore app state from session storage:", error);
    }

    return "form";
  });
  const [reportData, setReportData] = useState<VideoAnalysisResponse | null>(() => {
    if (!isBrowser) {
      return null;
    }

    try {
      const storedReport = window.sessionStorage.getItem(STORAGE_KEYS.reportData);
      return storedReport ? (JSON.parse(storedReport) as VideoAnalysisResponse) : null;
    } catch (error) {
      console.warn("Failed to parse stored report data:", error);
      return null;
    }
  });
  const [jobState, setJobState] = useState<AnalysisJobState | null>(null);
  const [jobLogs, setJobLogs] = useState<JobProgressLog[]>([]);
  const [nextPollSeconds, setNextPollSeconds] = useState<number | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const pollTokenRef = useRef(0);
  const [reportHistory, setReportHistory] = useState<SavedReportSummary[]>([]);
  const [historyPagination, setHistoryPagination] = useState<ReportListResponse["pagination"] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoadingReportId, setHistoryLoadingReportId] = useState<string | null>(null);

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

  const waitForJobCompletion = useCallback(
    async (jobId: string, sessionToken: number, initialJob?: AnalysisJobState) => {
      let attempt = 0;
      let previousStatus: string | null = initialJob?.status || null;
      // 记录在 processing 状态下，除了第一次轮询之外的轮询次数
      // 例如：如果第一次轮询后状态是 processing，那么下一次轮询是第1次，再下一次是第2次，以此类推
      let processingPollCount = 0;

      while (pollTokenRef.current === sessionToken) {
        // 计算下一次轮询的延迟时间
        let delayMs: number;
        
        if (attempt === 0) {
          // 第一次轮询：1秒后
          delayMs = 1000;
        } else if (previousStatus === "queued") {
          // 排队中：每10秒轮询一次
          delayMs = 10000;
        } else if (previousStatus === "processing") {
          // 进行中：前6次用30秒，之后用15秒
          // processingPollCount 记录的是在 processing 状态下，除了第一次轮询之外的轮询次数
          if (processingPollCount < 6) {
            delayMs = 30000;
          } else {
            delayMs = 15000;
          }
        } else {
          // 其他状态：默认10秒
          delayMs = 10000;
        }

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

        // 更新状态跟踪
        // processingPollCount 表示：下一次轮询时，如果状态还是 processing，这将是第几次在 processing 状态下的轮询（不包括第一次轮询）
        // 例如：
        // - 第一次轮询后状态是 processing，下一次轮询是第1次，所以 processingPollCount = 0（因为 0 < 4，用30秒）
        // - 第二次轮询后状态还是 processing，下一次轮询是第2次，所以 processingPollCount = 1（因为 1 < 4，用30秒）
        // - 以此类推，直到 processingPollCount = 4，下一次轮询用10秒
        
        if (latestJob.status === "processing") {
          // 如果之前不是 processing，说明刚进入 processing 状态，重置计数为 0
          if (previousStatus !== "processing") {
            processingPollCount = 0;
          } else {
            // 如果之前就是 processing，说明状态没有变化
            // 第一次轮询（attempt === 1）后如果状态是 processing，下一次轮询是第1次，所以 processingPollCount 应该是 0
            // 但是，如果初始状态就是 processing，第一次轮询后 attempt = 1，且 previousStatus = "processing"
            // 这种情况下，下一次轮询是第1次，所以 processingPollCount 应该是 0
            // 所以，只有当 attempt > 1 时，才增加计数
            if (attempt > 1) {
              processingPollCount += 1;
            }
          }
        }
        
        previousStatus = latestJob.status;
        
        // 计算并显示下一次轮询的间隔
        let nextDelayMs: number;
        if (latestJob.status === "queued") {
          nextDelayMs = 10000;
        } else if (latestJob.status === "processing") {
          // 下一次轮询时，如果状态还是 processing，且 processingPollCount < 6，用30秒
          if (processingPollCount < 6) {
            nextDelayMs = 30000;
          } else {
            nextDelayMs = 15000;
          }
        } else {
          nextDelayMs = 10000;
        }
        setNextPollSeconds(Math.round(nextDelayMs / 1000));
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
          enqueueResult.job
        );
        setReportData(result);
      }
        
        setAppState("report");
        
        toast({
          title: "分析完成！",
          description: "已成功生成学习报告",
        });

        await fetchReportHistory();
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

  const fetchReportHistory = useCallback(async () => {
    if (!user?.id) {
      setReportHistory([]);
      setHistoryPagination(null);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await videoAnalysisAPI.listReports({ page: 1, limit: 20 });
      setReportHistory(response.data || []);
      setHistoryPagination(response.pagination);
    } catch (error) {
      console.error("Failed to fetch report history:", error);
      setHistoryError(error instanceof Error ? error.message : "无法获取历史报告");
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchReportHistory();
    } else {
      setReportHistory([]);
      setHistoryPagination(null);
      setHistoryError(null);
    }
  }, [fetchReportHistory, user?.id]);

  const handleLoadSavedReport = async (reportId: string) => {
    if (!reportId) {
      return;
    }

    setHistoryLoadingReportId(reportId);
    cancelPolling();
    resetJobTracking();

    try {
      const savedReport = await videoAnalysisAPI.getReport(reportId);
      setReportData(savedReport);
      setAppState("report");
      toast({
        title: "已载入历史报告",
        description: `${savedReport.studentName} 的学习报告`,
      });
    } catch (error) {
      console.error("Failed to load saved report:", error);
      toast({
        title: "加载报告失败",
        description: error instanceof Error ? error.message : "无法获取历史报告，请稍后再试",
        variant: "destructive",
      });
    } finally {
      setHistoryLoadingReportId(null);
    }
  };

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    try {
      window.sessionStorage.setItem(STORAGE_KEYS.appState, appState);
    } catch (error) {
      console.warn("Failed to persist app state:", error);
    }
  }, [appState]);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    try {
      if (reportData) {
        window.sessionStorage.setItem(STORAGE_KEYS.reportData, JSON.stringify(reportData));
      } else {
        window.sessionStorage.removeItem(STORAGE_KEYS.reportData);
      }
    } catch (error) {
      console.warn("Failed to persist report data:", error);
    }
  }, [reportData]);

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

    if (isBrowser) {
      try {
        window.sessionStorage.removeItem(STORAGE_KEYS.appState);
        window.sessionStorage.removeItem(STORAGE_KEYS.reportData);
      } catch (storageError) {
        console.warn("Failed to clear stored state on logout:", storageError);
      }
    }

    setReportHistory([]);
    setHistoryPagination(null);
    setHistoryError(null);
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
          {user && (
            <ReportHistoryPanel
              reports={reportHistory}
              loading={historyLoading}
              pagination={historyPagination || undefined}
              error={historyError}
              onRefresh={() => fetchReportHistory()}
              onSelect={handleLoadSavedReport}
              loadingReportId={historyLoadingReportId}
            />
          )}
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
