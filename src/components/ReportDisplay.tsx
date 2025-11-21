import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Download, TrendingUp, TrendingDown, Minus, ArrowLeft, Code2, Music, Lightbulb, X, Check, Zap, Smile, BookOpen, Layers, Hand, MessageSquare, CheckCircle, BookMarked, BarChart3, Target, Trophy, Edit3, RefreshCcw } from "lucide-react";
import logo51Talk from "@/assets/51talk-logo-new.jpg";
import mascotHighFive from "@/assets/mascot-highfive-card.png";
import mascotLearn from "@/assets/mascot-learn-card.png";
import mascotGoodJob from "@/assets/mascot-goodjob-card.png";
import mascotYouDidIt from "@/assets/mascot-youdidit-card.png";
import microphoneIcon from "@/assets/microphone-icon.png";
import html2canvas from "html2canvas";
import { toast } from "@/hooks/use-toast";
import { useCallback, useEffect, useMemo, useState } from "react";
import { videoAnalysisAPI, type VideoAnalysisResponse } from "@/services/api";

type ReportData = VideoAnalysisResponse;

interface ReportDisplayProps {
  data: ReportData;
  onBack: () => void;
}

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "提升") return <TrendingUp className="w-5 h-5 text-success" />;
  if (trend === "下降") return <TrendingDown className="w-5 h-5 text-destructive" />;
  return <Minus className="w-5 h-5 text-muted-foreground" />;
};

const TrendBadge = ({ trend }: { trend: string }) => {
  const variants = {
    提升: "default",
    下降: "destructive",
    持平: "secondary"
  } as const;

  return (
    <Badge
      variant={variants[trend as keyof typeof variants] || "secondary"}
      className="ml-2 whitespace-nowrap"
    >
      {trend}
    </Badge>
  );
};

type DataPath = Array<string | number>;

const cloneData = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const STORAGE_KEY_PREFIX = "report-display-data";
const getStorageKey = (studentId?: string) => `${STORAGE_KEY_PREFIX}:${studentId || "default"}`;

const parsePercentageValue = (percentage?: string): number | null => {
  if (!percentage) return null;
  const sanitized = percentage.replace(/[^\d.-]/g, "");
  if (!sanitized) return null;

  const numericValue = Number(sanitized);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const deriveTrendFromPercentage = (
  percentageValue: number | null,
  fallback?: string
): "提升" | "下降" | "持平" => {
  if (percentageValue === null || percentageValue === 0) {
    if (fallback === "提升" || fallback === "下降") {
      return fallback;
    }
    return "持平";
  }

  return percentageValue > 0 ? "提升" : "下降";
};

const getPercentageColorClass = (trend: string) => {
  switch (trend) {
    case "提升":
      return "text-secondary";
    case "下降":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
};

const EditableText = ({
  value,
  onChange,
  isEditing,
  multiline = false,
  rows,
  as: Component = "span",
  className,
  editingClassName,
  placeholder,
}: {
  value: string;
  onChange: (newValue: string) => void;
  isEditing: boolean;
  multiline?: boolean;
  rows?: number;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  editingClassName?: string;
  placeholder?: string;
}) => {
  const safeValue = value ?? "";
  const inputClassName = editingClassName ?? className;

  if (isEditing) {
    if (multiline) {
      return (
        <Textarea
          value={safeValue}
          onChange={(event) => onChange(event.target.value)}
          rows={rows ?? 3}
          className={inputClassName}
          placeholder={placeholder}
        />
      );
    }

    return (
      <Input
        value={safeValue}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
        placeholder={placeholder}
      />
    );
  }

  const DisplayComponent = Component || "span";

  return (
    <DisplayComponent className={className}>
      {safeValue || placeholder || ""}
    </DisplayComponent>
  );
};

export const ReportDisplay = ({ data: initialData, onBack }: ReportDisplayProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editableData, setEditableData] = useState<ReportData>(initialData);
  const [serverData, setServerData] = useState<ReportData>(initialData);
  const [aiBaselineData, setAiBaselineData] = useState<ReportData>(initialData);
  const storageKey = useMemo(() => getStorageKey(initialData.studentId), [initialData.studentId]);
  const reportId = useMemo(() => initialData.reportId || editableData.reportId, [initialData.reportId, editableData.reportId]);

  const loadFromLocalStorage = useCallback(() => {
    if (typeof window === "undefined") return null;
    const storedValue = localStorage.getItem(storageKey);
    if (!storedValue) return null;
    try {
      return JSON.parse(storedValue) as ReportData;
    } catch (error) {
      console.error("解析本地保存的报告数据失败:", error);
      return null;
    }
  }, [storageKey]);

  const saveToLocalStorage = useCallback((dataToSave: ReportData) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    } catch (error) {
      console.error("保存报告数据到本地失败:", error);
    }
  }, [storageKey]);

  const clearLocalStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  useEffect(() => {
    setAiBaselineData(initialData);
    setServerData(initialData);
    const stored = loadFromLocalStorage();
    if (stored) {
      setEditableData(stored);
    } else {
      setEditableData(initialData);
    }
  }, [initialData, loadFromLocalStorage]);

  const data = editableData;

  const hasChanges = useMemo(() => JSON.stringify(editableData) !== JSON.stringify(serverData), [editableData, serverData]);

  const handleFieldChange = (path: DataPath, newValue: string) => {
    setEditableData((prev) => {
      const cloned = cloneData(prev);
      let current: any = cloned;

      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }

      current[path[path.length - 1]] = newValue;
      return cloned;
    });
  };

  const handleResetChanges = () => {
    setEditableData(aiBaselineData);
    clearLocalStorage();
    toast({
      title: "已恢复AI内容",
      description: "本地保存的数据已清除。",
    });
  };

  const handleSaveChanges = async () => {
    if (!reportId) {
      toast({
        title: "无法保存更改",
        description: "缺少报告ID，无法将修改同步到数据库。",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await videoAnalysisAPI.updateReport(reportId, editableData);
      setServerData(editableData);
      saveToLocalStorage(editableData);
      setIsEditing(false);
      toast({
        title: "修改已保存",
        description: "数据库与本地内容已同步。",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败，请稍后重试。";
      toast({
        title: "保存失败",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditButtonClick = () => {
    if (isSaving) {
      return;
    }
    if (isEditing) {
      void handleSaveChanges();
    } else {
      setIsEditing(true);
    }
  };

  const handleDownloadImage = async () => {
    setIsDownloading(true);
    
    toast({
      title: "正在生成长图...",
      description: "请稍候，正在将报告转换为图片",
    });

    let reportElement: HTMLElement | null = null;
    let buttonsElement: HTMLElement | null = null;
    let originalBodyHadClass = false;
    let originalWidthStyle = '';
    let originalMaxWidthStyle = '';
    let originalExportWidthVar = '';
    let computedWidth = 0;
    let computedHeight = 0;

    try {
      // 获取要截图的元素
      reportElement = document.getElementById('report-content');
      if (!reportElement) {
        throw new Error('找不到报告内容');
      }

      originalBodyHadClass = document.body.classList.contains('report-exporting');
      originalWidthStyle = reportElement.style.width;
      originalMaxWidthStyle = reportElement.style.maxWidth;
      originalExportWidthVar = reportElement.style.getPropertyValue('--report-export-width');
      computedWidth = Math.ceil(reportElement.getBoundingClientRect().width);
      computedHeight = Math.ceil(reportElement.scrollHeight);

      // 临时隐藏按钮区域
      buttonsElement = document.getElementById('action-buttons');
      if (buttonsElement) {
        buttonsElement.style.display = 'none';
      }

      // 锁定宽度并应用导出样式，防止响应式断点发生变化
      reportElement.style.width = `${computedWidth}px`;
      reportElement.style.maxWidth = `${computedWidth}px`;
      reportElement.style.setProperty('--report-export-width', `${computedWidth}px`);
      document.body.classList.add('report-exporting');

      // 使用 html2canvas 生成高质量截图
      const canvas = await html2canvas(reportElement, {
        scale: 2, // 提高分辨率
        useCORS: true, // 允许跨域图片
        allowTaint: true,
        backgroundColor: '#f5f5f5',
        logging: false,
        width: computedWidth,
        height: computedHeight,
        windowWidth: computedWidth,
        windowHeight: computedHeight,
        onclone: (clonedDoc) => {
          // 确保克隆的文档中所有元素都渲染完成
          const clonedElement = clonedDoc.getElementById('report-content');
          if (clonedElement) {
            // 强制所有 flex 容器使用固定布局
            clonedElement.style.width = `${computedWidth}px`;
            clonedElement.style.maxWidth = `${computedWidth}px`;
            clonedElement.style.setProperty('--report-export-width', `${computedWidth}px`);
          }
          clonedDoc.body.classList.add('report-exporting');
        },
      });

      // 恢复按钮显示
      if (buttonsElement) {
        buttonsElement.style.display = '';
      }

      // 将 canvas 转换为图片并下载
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((generatedBlob) => {
          if (generatedBlob) {
            resolve(generatedBlob);
          } else {
            reject(new Error('生成图片失败'));
          }
        }, 'image/png');
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = `51Talk学习报告_${data.studentName}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.png`;
      
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "下载成功！",
        description: `报告已保存为：${fileName}`,
      });

    } catch (error) {
      console.error('生成图片失败:', error);
      toast({
        title: "生成失败",
        description: "抱歉，生成图片时出现错误，请重试",
        variant: "destructive",
      });
    } finally {
      if (reportElement) {
        reportElement.style.width = originalWidthStyle;
        reportElement.style.maxWidth = originalMaxWidthStyle;
        if (originalExportWidthVar) {
          reportElement.style.setProperty('--report-export-width', originalExportWidthVar);
        } else {
          reportElement.style.removeProperty('--report-export-width');
        }
      }
      if (!originalBodyHadClass) {
        document.body.classList.remove('report-exporting');
      }
      if (buttonsElement) {
        buttonsElement.style.display = '';
      }
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--report-background))] p-4 md:p-8">
    <div id="report-content" className="max-w-[1380px] mx-auto space-y-6 bg-white rounded-3xl shadow-elevated p-6 md:p-8 border-4 border-primary/50">
        {isEditing && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-secondary/40 bg-secondary/10 text-secondary">
            <Edit3 className="w-5 h-5" />
            <div>
              <p className="font-semibold text-base">编辑模式已开启</p>
              <p className="text-sm text-secondary/80">直接修改文本框内容，完成后点击“完成编辑”或导出长图。</p>
            </div>
          </div>
        )}
        {/* Header with Logo and Mascot */}
        <Card className="shadow-elevated border-none overflow-hidden relative rounded-3xl">
          <div className="bg-gradient-hero p-6 relative">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground drop-shadow-sm">
                    英语学习分析报告
                  </h1>
                </div>
                <div className="flex flex-wrap gap-4 text-primary-foreground/90 text-base">
                  <div>
                    <span className="font-semibold">学生：</span>
                    <EditableText
                      value={data.studentName}
                      onChange={(value) => handleFieldChange(["studentName"], value)}
                      isEditing={isEditing}
                      className="ml-2 font-semibold"
                    />
                  </div>
                  {(isEditing || data.studentId) && (
                    <div>
                      <span className="font-semibold">学生ID：</span>
                      <EditableText
                        value={data.studentId || ""}
                        onChange={(value) => handleFieldChange(["studentId"], value)}
                        isEditing={isEditing}
                        className="ml-2"
                        placeholder="未填写"
                      />
                    </div>
                  )}
                  <div>
                    <span className="font-semibold">年级：</span>
                    <EditableText
                      value={data.grade}
                      onChange={(value) => handleFieldChange(["grade"], value)}
                      isEditing={isEditing}
                      className="ml-2"
                    />
                  </div>
                  <div>
                    <span className="font-semibold">级别：</span>
                    <EditableText
                      value={data.level}
                      onChange={(value) => handleFieldChange(["level"], value)}
                      isEditing={isEditing}
                      className="ml-2"
                    />
                  </div>
                  <div>
                    <span className="font-semibold">单元：</span>
                    <EditableText
                      value={data.unit}
                      onChange={(value) => handleFieldChange(["unit"], value)}
                      isEditing={isEditing}
                      className="ml-2"
                    />
                  </div>
                </div>
              </div>
              <img src={logo51Talk} alt="51Talk Logo" className="h-16 w-auto absolute top-4 right-14 rounded-lg shadow-md" />
            </div>
          </div>
        </Card>

        {/* Learning Data Section */}
        <Card className="shadow-elevated border-none rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-hero relative">
            <CardTitle className="text-3xl font-bold text-primary-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg">
                <BarChart3 className="w-7 h-7 text-secondary" />
              </div>
              关键学习数据
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(data.learningData).map(([key, value]) => {
                const config = {
                  handRaising: { 
                    title: "主动发言次数", 
                    icon: Hand, 
                    bgColor: "bg-blue-50",
                    iconColor: "text-blue-500",
                    mascotImage: mascotHighFive
                  },
                  answerLength: { 
                    title: "回答长度", 
                    icon: MessageSquare, 
                    bgColor: "bg-green-50",
                    iconColor: "text-green-500",
                    mascotImage: mascotLearn
                  },
                  completeSentences: { 
                    title: "完整句子率", 
                    icon: CheckCircle, 
                    bgColor: "bg-purple-50",
                    iconColor: "text-purple-500",
                    mascotImage: mascotGoodJob
                  },
                  readingAccuracy: { 
                    title: "阅读准确率", 
                    icon: BookMarked, 
                    bgColor: "bg-orange-50",
                    iconColor: "text-orange-500",
                    mascotImage: mascotYouDidIt
                  }
                };

                const item = config[key as keyof typeof config];
                const percentageValue = parsePercentageValue(value.percentage);
                const derivedTrend = deriveTrendFromPercentage(percentageValue, value.trend);
                const percentageColorClass = getPercentageColorClass(derivedTrend);

                return (
                  <div key={key} className={`rounded-2xl border-none shadow-md ${item.bgColor} overflow-hidden transition-transform hover:scale-[1.02]`}>
                    <div className="flex flex-row items-stretch h-full">
                      {/* Left side - Information */}
                      <div className="flex-1 p-5 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                            <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                          </div>
                          <h4 className="font-bold text-xl">
                            {item.title}
                          </h4>
                        </div>
                        <div className="flex items-baseline gap-3 mb-3">
                          <TrendIcon trend={derivedTrend} />
                          <EditableText
                            value={value.percentage}
                            onChange={(newValue) => handleFieldChange(["learningData", key, "percentage"], newValue)}
                            isEditing={isEditing}
                            className={`text-5xl font-extrabold drop-shadow-sm w-full ${percentageColorClass}`}
                          />
                          <TrendBadge trend={derivedTrend} />
                        </div>
                        <EditableText
                          value={value.analysis}
                          onChange={(newValue) => handleFieldChange(["learningData", key, "analysis"], newValue)}
                          isEditing={isEditing}
                          multiline
                          as="p"
                          className="text-base text-muted-foreground leading-relaxed"
                        />
                      </div>
                      
                      {/* Right side - Mascot Image */}
                      <div className="w-1/3 flex items-center justify-center p-2">
                        <img 
                          src={item.mascotImage} 
                          alt="51Talk Mascot" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Progress Dimensions */}
        <Card className="shadow-elevated border-none rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-hero relative">
            <CardTitle className="text-3xl font-bold text-primary-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg">
                <Trophy className="w-7 h-7 text-secondary" />
              </div>
              四大维度进步分析
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {Object.entries(data.progressDimensions).map(([key, value]) => {
                const config = {
                  fluency: { title: "流利度", icon: Zap, color: "text-blue-500" },
                  confidence: { title: "自信度", icon: Smile, color: "text-yellow-500" },
                  languageApplication: { title: "语言应用", icon: BookOpen, color: "text-green-500" },
                  sentenceComplexity: { title: "句型复杂度", icon: Layers, color: "text-purple-500" }
                };

                const { title, icon: Icon, color } = config[key as keyof typeof config];

                return (
                  <div key={key} className="p-6 rounded-2xl border-none shadow-md bg-gradient-to-br from-white to-muted/30 hover:shadow-lg transition-all h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center shadow-sm`}>
                        <Icon className={`w-6 h-6 ${color}`} />
                      </div>
                      <h4 className="font-bold text-xl text-secondary">
                        {title}
                      </h4>
                    </div>
                    <EditableText
                      value={value.analysis}
                      onChange={(newValue) => handleFieldChange(["progressDimensions", key, "analysis"], newValue)}
                      isEditing={isEditing}
                      multiline
                      as="p"
                      className="text-foreground mb-4 text-base flex-grow leading-relaxed"
                    />
                    <div className="bg-gradient-to-r from-accent/30 to-accent/50 p-4 rounded-xl border-l-4 border-secondary mt-auto shadow-sm">
                      <EditableText
                        value={value.example}
                        onChange={(newValue) => handleFieldChange(["progressDimensions", key, "example"], newValue)}
                        isEditing={isEditing}
                        multiline
                        as="div"
                        className="text-base font-medium text-accent-foreground whitespace-pre-line"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Improvement Areas Section */}
        <Card className="shadow-elevated border-none rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-hero relative">
            <CardTitle className="text-3xl font-bold text-primary-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg">
                <Target className="w-7 h-7 text-secondary" />
              </div>
              待提升点详细分析
            </CardTitle>
            <p className="text-base text-primary-foreground/90 mt-2 font-medium">
              尽管进步巨大，我们依然可以从细节中找到未来努力的方向。让我们的英语水平更上一层楼 💪
            </p>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {/* Pronunciation Accuracy */}
            {data.improvementAreas.pronunciation && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center shadow-sm flex-shrink-0">
                    <img src={microphoneIcon} alt="Microphone" className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-destructive flex-shrink-0">1. 发音准确性</h3>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-r from-destructive/5 to-destructive/10 border-l-4 border-destructive shadow-sm">
                  <EditableText
                    value={data.improvementAreas.pronunciation.overview}
                    onChange={(newValue) => handleFieldChange(["improvementAreas", "pronunciation", "overview"], newValue)}
                    isEditing={isEditing}
                    multiline
                    as="p"
                    className="font-bold text-destructive mb-2 text-lg"
                  />
                  <EditableText
                    value={data.improvementAreas.pronunciation.details}
                    onChange={(newValue) => handleFieldChange(["improvementAreas", "pronunciation", "details"], newValue)}
                    isEditing={isEditing}
                    multiline
                    as="p"
                    className="text-base text-muted-foreground leading-relaxed"
                  />
                </div>

                {/* Specific Pronunciation Examples */}
                <div className="space-y-4">
                  <h4 className="font-bold text-foreground flex items-center gap-2 text-xl">
                    <span className="text-3xl">📝</span> 特定单词发音问题单
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {data.improvementAreas.pronunciation.examples.map((example, idx) => (
                      <div key={idx} className="p-5 rounded-2xl border-none shadow-md bg-gradient-to-br from-white to-muted/20 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <EditableText
                            value={example.word}
                            onChange={(newValue) => handleFieldChange(["improvementAreas", "pronunciation", "examples", idx, "word"], newValue)}
                            isEditing={isEditing}
                            className="font-bold text-2xl text-foreground flex-shrink-0"
                            editingClassName="font-bold text-2xl text-foreground flex-shrink-0 w-[140px]"
                          />
                          {isEditing ? (
                            <Input
                              value={example.type}
                              onChange={(event) => handleFieldChange(["improvementAreas", "pronunciation", "examples", idx, "type"], event.target.value)}
                              className="ml-2 w-[120px] text-center font-semibold"
                            />
                          ) : (
                            <Badge variant="destructive" className="text-sm rounded-lg flex-shrink-0 ml-2 whitespace-nowrap">
                              {example.type}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-2 text-base">
                          <div className="flex items-center gap-2">
                            <X className="w-4 h-4 text-destructive flex-shrink-0" />
                            <span className="text-muted-foreground flex-shrink-0">错误发音：</span>
                            <EditableText
                              value={example.incorrect}
                              onChange={(newValue) => handleFieldChange(["improvementAreas", "pronunciation", "examples", idx, "incorrect"], newValue)}
                              isEditing={isEditing}
                              className="text-destructive font-mono flex-shrink-0 whitespace-nowrap w-[140px]"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-success flex-shrink-0" />
                            <span className="text-muted-foreground flex-shrink-0">正确发音：</span>
                            <EditableText
                              value={example.correct}
                              onChange={(newValue) => handleFieldChange(["improvementAreas", "pronunciation", "examples", idx, "correct"], newValue)}
                              isEditing={isEditing}
                              className="text-success font-mono flex-shrink-0 whitespace-nowrap w-[140px]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>


                {/* Suggestions */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-secondary/10 to-secondary/5 border-none shadow-md">
                  <h4 className="font-bold text-secondary mb-5 flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-6 h-6 text-secondary flex-shrink-0" />
                    </div>
                    <span className="flex-shrink-0">提升建议</span>
                  </h4>
                  <div className="space-y-4">
                    {data.improvementAreas.pronunciation.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex gap-4 p-4 rounded-xl bg-white/50 hover:bg-white/80 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground flex items-center justify-center flex-shrink-0 font-bold text-base shadow-sm">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <EditableText
                            value={suggestion.title}
                            onChange={(newValue) => handleFieldChange(["improvementAreas", "pronunciation", "suggestions", idx, "title"], newValue)}
                            isEditing={isEditing}
                            className="font-bold text-foreground text-base mb-1"
                            as="h5"
                          />
                          <EditableText
                            value={suggestion.description}
                            onChange={(newValue) => handleFieldChange(["improvementAreas", "pronunciation", "suggestions", idx, "description"], newValue)}
                            isEditing={isEditing}
                            multiline
                            rows={6}
                            as="p"
                            className="text-base text-muted-foreground leading-relaxed w-full"
                            editingClassName="text-base text-muted-foreground leading-relaxed min-h-[160px] w-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Intonation & Rhythm */}
            {data.improvementAreas.intonation && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm flex-shrink-0">
                    <Music className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold flex-shrink-0" style={{ color: '#FFA500' }}>2. 语调与节奏</h3>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/15 to-primary/25 border-l-4 border-primary shadow-sm">
                  <EditableText
                    value={data.improvementAreas.intonation.overview}
                    onChange={(newValue) => handleFieldChange(["improvementAreas", "intonation", "overview"], newValue)}
                    isEditing={isEditing}
                    multiline
                    as="p"
                    className="font-bold mb-2 text-lg text-[#FFA500]"
                  />
                  <EditableText
                    value={data.improvementAreas.intonation.details}
                    onChange={(newValue) => handleFieldChange(["improvementAreas", "intonation", "details"], newValue)}
                    isEditing={isEditing}
                    multiline
                    as="p"
                    className="text-base text-muted-foreground leading-relaxed"
                  />
                </div>

                {/* Intonation Suggestions */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-secondary/10 to-secondary/5 border-none shadow-md">
                  <h4 className="font-bold text-secondary mb-5 flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-6 h-6 text-secondary flex-shrink-0" />
                    </div>
                    <span className="flex-shrink-0">提升建议</span>
                  </h4>
                  <div className="space-y-4">
                    {data.improvementAreas.intonation.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex gap-4 p-4 rounded-xl bg-white/50 hover:bg-white/80 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground flex items-center justify-center flex-shrink-0 font-bold text-base shadow-sm">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <EditableText
                            value={suggestion.title}
                            onChange={(newValue) => handleFieldChange(["improvementAreas", "intonation", "suggestions", idx, "title"], newValue)}
                            isEditing={isEditing}
                            as="h5"
                            className="font-bold text-foreground text-base mb-1"
                          />
                          <EditableText
                            value={suggestion.description}
                            onChange={(newValue) => handleFieldChange(["improvementAreas", "intonation", "suggestions", idx, "description"], newValue)}
                            isEditing={isEditing}
                            multiline
                            rows={6}
                            as="p"
                            className="text-base text-muted-foreground leading-relaxed w-full"
                            editingClassName="text-base text-muted-foreground leading-relaxed min-h-[160px] w-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Grammar Nuances */}
            {data.improvementAreas.grammar && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center shadow-sm flex-shrink-0">
                    <Code2 className="w-7 h-7 text-secondary" />
                  </div>
                  <h3 className="text-2xl font-bold text-secondary flex-shrink-0">3. 语法细节</h3>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-r from-secondary/5 to-secondary/10 border-l-4 border-secondary shadow-sm">
                  <EditableText
                    value={data.improvementAreas.grammar.overview}
                    onChange={(newValue) => handleFieldChange(["improvementAreas", "grammar", "overview"], newValue)}
                    isEditing={isEditing}
                    multiline
                    as="p"
                    className="font-bold text-secondary mb-2 text-lg"
                  />
                  <EditableText
                    value={data.improvementAreas.grammar.details}
                    onChange={(newValue) => handleFieldChange(["improvementAreas", "grammar", "details"], newValue)}
                    isEditing={isEditing}
                    multiline
                    as="p"
                    className="text-base text-muted-foreground leading-relaxed"
                  />
                </div>

                {/* Grammar Examples */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {data.improvementAreas.grammar.examples.map((example, idx) => (
                    <div key={idx} className="p-5 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/10 border-none shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl flex-shrink-0">📖</span>
                        <EditableText
                          value={example.category}
                          onChange={(newValue) => handleFieldChange(["improvementAreas", "grammar", "examples", idx, "category"], newValue)}
                          isEditing={isEditing}
                          as="h4"
                          className="font-bold text-accent-foreground text-base flex-shrink-0"
                        />
                      </div>
                      <div className="space-y-2 text-base">
                        <div className="flex items-start gap-2">
                          <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                          <EditableText
                            value={example.incorrect}
                            onChange={(newValue) => handleFieldChange(["improvementAreas", "grammar", "examples", idx, "incorrect"], newValue)}
                            isEditing={isEditing}
                            className="text-destructive line-through"
                          />
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                          <EditableText
                            value={example.correct}
                            onChange={(newValue) => handleFieldChange(["improvementAreas", "grammar", "examples", idx, "correct"], newValue)}
                            isEditing={isEditing}
                            className="text-success font-medium"
                          />
                        </div>
                        <EditableText
                          value={example.explanation}
                          onChange={(newValue) => handleFieldChange(["improvementAreas", "grammar", "examples", idx, "explanation"], newValue)}
                          isEditing={isEditing}
                          multiline
                          as="p"
                          className="text-sm text-muted-foreground mt-2"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grammar Suggestions */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-secondary/10 to-secondary/5 border-none shadow-md">
                  <h4 className="font-bold text-secondary mb-5 flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-6 h-6 text-secondary flex-shrink-0" />
                    </div>
                    <span className="flex-shrink-0">提升建议</span>
                  </h4>
                  <div className="space-y-4">
                    {data.improvementAreas.grammar.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex gap-4 p-4 rounded-xl bg-white/50 hover:bg-white/80 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground flex items-center justify-center flex-shrink-0 font-bold text-base shadow-sm">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <EditableText
                            value={suggestion.title}
                            onChange={(newValue) => handleFieldChange(["improvementAreas", "grammar", "suggestions", idx, "title"], newValue)}
                            isEditing={isEditing}
                            as="h5"
                            className="font-bold text-foreground text-base mb-1"
                          />
                          <EditableText
                            value={suggestion.description}
                            onChange={(newValue) => handleFieldChange(["improvementAreas", "grammar", "suggestions", idx, "description"], newValue)}
                            isEditing={isEditing}
                            multiline
                            rows={6}
                            as="p"
                            className="text-base text-muted-foreground leading-relaxed w-full"
                            editingClassName="text-base text-muted-foreground leading-relaxed min-h-[160px] w-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div id="action-buttons" className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center mt-8 flex-wrap">
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <Button
              variant="outline"
              size="lg"
              onClick={onBack}
              className="border-2 border-neutral hover:bg-neutral hover:text-neutral-foreground rounded-xl font-semibold shadow-sm hover:shadow-md transition-all"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              返回
            </Button>
            <Button
              variant={isEditing ? "default" : "secondary"}
              size="lg"
              onClick={handleEditButtonClick}
              disabled={isSaving}
              className="rounded-xl font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-60"
            >
              <Edit3 className="w-5 h-5 mr-2" />
              {isEditing ? (isSaving ? "保存中..." : "完成编辑") : "编辑报告内容"}
            </Button>
            {isEditing && (
              <Button
                variant="ghost"
                size="lg"
                onClick={handleResetChanges}
                disabled={!hasChanges}
                className="rounded-xl font-semibold border border-dashed border-secondary text-secondary hover:text-secondary hover:bg-secondary/10 disabled:opacity-50"
              >
                <RefreshCcw className="w-5 h-5 mr-2" />
                重置为AI内容
              </Button>
            )}
          </div>
          <Button
            size="lg"
            onClick={handleDownloadImage}
            disabled={isDownloading}
            className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary text-secondary-foreground shadow-md hover:shadow-xl rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5 mr-2" />
            {isDownloading ? "生成中..." : "下载长图"}
          </Button>
        </div>
      </div>
    </div>
  );
};
