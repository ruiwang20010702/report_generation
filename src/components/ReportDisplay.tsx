import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, TrendingDown, Minus, ArrowLeft, Volume2, Code2, Music, Lightbulb, X, Check, Zap, Smile, BookOpen, Layers, Hand, MessageSquare, CheckCircle, BookMarked, BarChart3, Target, Trophy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo51Talk from "@/assets/51talk-logo-new.jpg";
import monkeyMascot from "@/assets/monkey-mascot-new.png";
import html2canvas from "html2canvas";

interface ReportData {
  studentName: string;
  grade: string;
  level: string;
  unit: string;
  learningData: {
    handRaising: { trend: string; percentage: string; analysis: string };
    answerLength: { trend: string; percentage: string; analysis: string };
    completeSentences: { trend: string; percentage: string; analysis: string };
    readingAccuracy: { trend: string; percentage: string; analysis: string };
  };
  progressDimensions: {
    fluency: { analysis: string; example: string };
    confidence: { analysis: string; example: string };
    languageApplication: { analysis: string; example: string };
    sentenceComplexity: { analysis: string; example: string };
  };
  improvementAreas: {
    pronunciation?: {
      overview: string;
      details: string;
      examples: Array<{
        word: string;
        incorrect: string;
        correct: string;
        type: string;
      }>;
      persistentIssues?: {
        title: string;
        items: string[];
      };
      suggestions: Array<{
        title: string;
        description: string;
      }>;
    };
    grammar?: {
      overview: string;
      details: string;
      examples: Array<{
        sentence: string;
        error: string;
        correction: string;
        rule: string;
      }>;
      suggestions: Array<{
        title: string;
        description: string;
      }>;
    };
    intonation?: {
      overview: string;
      details: string;
      examples: Array<{
        sentence: string;
        issue: string;
        improvement: string;
      }>;
      suggestions: Array<{
        title: string;
        description: string;
      }>;
    };
  };
}

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
    <Badge variant={variants[trend as keyof typeof variants] || "secondary"} className="ml-2">
      {trend}
    </Badge>
  );
};

export const ReportDisplay = ({ data, onBack }: ReportDisplayProps) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { toast } = useToast();

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    
    try {
      // 获取报告容器
      const reportElement = document.getElementById('report-container');
      if (!reportElement) {
        throw new Error('报告容器未找到');
      }

      // 临时隐藏按钮
      const buttons = document.getElementById('action-buttons');
      if (buttons) {
        buttons.style.display = 'none';
      }

      toast({
        title: "正在生成长图...",
        description: "请稍候，这可能需要几秒钟",
      });

      // 使用html2canvas将HTML转换为canvas（生成完整长图，无分页）
      const canvas = await html2canvas(reportElement, {
        scale: 2, // 提高分辨率，生成高清图片
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: reportElement.scrollWidth,
        windowHeight: reportElement.scrollHeight,
      });

      // 恢复按钮显示
      if (buttons) {
        buttons.style.display = 'flex';
      }

      // 将canvas转换为PNG图片数据
      const imgData = canvas.toDataURL('image/png', 1.0);

      // 创建下载链接
      const link = document.createElement('a');
      const fileName = `51Talk学习报告_${data.studentName}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.png`;
      link.download = fileName;
      link.href = imgData;
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "长图生成成功！",
        description: `报告已保存为 ${fileName}`,
      });
    } catch (error) {
      console.error('长图生成失败:', error);
      toast({
        title: "长图生成失败",
        description: "请稍后重试或联系技术支持",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--report-background))] p-4 md:p-8">
      <div id="report-container" className="max-w-5xl mx-auto space-y-6 bg-white rounded-2xl shadow-elevated p-6 md:p-8 border-4 border-primary">
        {/* Header with Logo and Mascot */}
        <Card className="shadow-elevated border-2 border-primary/20 overflow-hidden relative">
          <div className="bg-gradient-primary p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <img src={monkeyMascot} alt="51Talk Mascot" className="h-20 w-auto" />
                  <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground">
                    英语学习分析报告
                  </h1>
                </div>
                <div className="flex flex-wrap gap-4 text-primary-foreground/90">
                  <div>
                    <span className="font-semibold">学生：</span>
                    <span className="ml-2">{data.studentName}</span>
                  </div>
                  <div>
                    <span className="font-semibold">年级：</span>
                    <span className="ml-2">{data.grade}</span>
                  </div>
                  <div>
                    <span className="font-semibold">级别：</span>
                    <span className="ml-2">{data.level}</span>
                  </div>
                  <div>
                    <span className="font-semibold">单元：</span>
                    <span className="ml-2">{data.unit}</span>
                  </div>
                </div>
              </div>
              <img src={logo51Talk} alt="51Talk Logo" className="h-16 w-auto absolute top-4 right-4 rounded" />
            </div>
          </div>
        </Card>

        {/* Learning Data Section */}
        <Card className="shadow-elevated border-4 border-primary">
          <CardHeader className="bg-gradient-hero">
            <CardTitle className="text-3xl font-bold text-primary-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shadow-lg">
                <BarChart3 className="w-7 h-7 text-secondary-foreground" />
              </div>
              关键学习数据
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(data.learningData).map(([key, value]) => {
                const config = {
                  handRaising: { 
                    title: "举手次数", 
                    icon: Hand, 
                    bgColor: "bg-blue-50",
                    iconColor: "text-blue-500"
                  },
                  answerLength: { 
                    title: "回答长度", 
                    icon: MessageSquare, 
                    bgColor: "bg-green-50",
                    iconColor: "text-green-500"
                  },
                  completeSentences: { 
                    title: "完整句子率", 
                    icon: CheckCircle, 
                    bgColor: "bg-purple-50",
                    iconColor: "text-purple-500"
                  },
                  readingAccuracy: { 
                    title: "阅读准确率", 
                    icon: BookMarked, 
                    bgColor: "bg-orange-50",
                    iconColor: "text-orange-500"
                  }
                };

                const item = config[key as keyof typeof config];

                return (
                  <div key={key} className={`p-5 rounded-lg border-2 border-accent/50 ${item.bgColor}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                          <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                        </div>
                        <h4 className="font-semibold text-lg">
                          {item.title}
                        </h4>
                      </div>
                      <TrendBadge trend={value.trend} />
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <div className="text-3xl font-bold text-primary">{value.percentage}</div>
                      <TrendIcon trend={value.trend} />
                    </div>
                    <p className="text-sm text-muted-foreground">{value.analysis}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Progress Dimensions */}
        <Card className="shadow-elevated border-4 border-primary">
          <CardHeader className="bg-gradient-hero">
            <CardTitle className="text-3xl font-bold text-primary-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shadow-lg">
                <Trophy className="w-7 h-7 text-secondary-foreground" />
              </div>
              四大维度进步分析
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(data.progressDimensions).map(([key, value]) => {
                const config = {
                  fluency: { title: "流利度", icon: Zap, color: "text-blue-500" },
                  confidence: { title: "自信度", icon: Smile, color: "text-yellow-500" },
                  languageApplication: { title: "语言应用", icon: BookOpen, color: "text-green-500" },
                  sentenceComplexity: { title: "句型复杂度", icon: Layers, color: "text-purple-500" }
                };

                const { title, icon: Icon, color } = config[key as keyof typeof config];

                return (
                  <div key={key} className="p-5 rounded-lg border-2 border-secondary/30 bg-muted/30 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <h4 className="font-bold text-lg text-secondary">
                        {title}
                      </h4>
                    </div>
                    <p className="text-foreground mb-3 text-sm">{value.analysis}</p>
                    <div className="bg-accent/50 p-3 rounded border-l-2 border-primary">
                      <p className="text-sm font-medium text-accent-foreground">
                        <span className="font-bold">示例：</span> {value.example}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Improvement Areas Section */}
        <Card className="shadow-elevated border-4 border-primary">
          <CardHeader className="bg-gradient-hero">
            <CardTitle className="text-3xl font-bold text-primary-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shadow-lg">
                <Target className="w-7 h-7 text-secondary-foreground" />
              </div>
              待提升点详细分析 (Areas for Improvement)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              尽管进步巨大，我们依然可以从细节中找到未来努力的方向。让我们的英语水平更上一层楼。
            </p>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {/* Pronunciation Accuracy */}
            {data.improvementAreas.pronunciation && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-destructive" />
                  </div>
                  <h3 className="text-xl font-bold text-destructive">1. 发音准确性 (Pronunciation Accuracy)</h3>
                </div>

                <div className="p-4 rounded-lg bg-destructive/5 border-l-4 border-destructive">
                  <p className="font-semibold text-destructive mb-2">{data.improvementAreas.pronunciation.overview}</p>
                  <p className="text-sm text-muted-foreground">{data.improvementAreas.pronunciation.details}</p>
                </div>

                {/* Specific Pronunciation Examples */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <span className="text-secondary">📋</span> 特定单词发音问题单
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.improvementAreas.pronunciation.examples.map((example, idx) => (
                      <div key={idx} className="p-4 rounded-lg border-2 border-border bg-card">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-bold text-lg text-foreground">{example.word}</span>
                          <Badge variant="destructive" className="text-xs">{example.type}</Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <X className="w-4 h-4 text-destructive" />
                            <span className="text-muted-foreground">错误发音：</span>
                            <span className="text-destructive font-mono">{example.incorrect}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-success" />
                            <span className="text-muted-foreground">正确发音：</span>
                            <span className="text-success font-mono">{example.correct}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>


                {/* Suggestions */}
                <div className="p-5 rounded-lg bg-secondary/10 border-2 border-secondary/30">
                  <h4 className="font-bold text-secondary mb-4 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    提升建议
                  </h4>
                  <div className="space-y-3">
                    {data.improvementAreas.pronunciation.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center flex-shrink-0 font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <h5 className="font-semibold text-foreground">{suggestion.title}</h5>
                          <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Grammar Nuances */}
            {data.improvementAreas.grammar && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Code2 className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-primary">2. 语法细节 (Grammar Nuances)</h3>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border-l-4 border-primary">
                  <p className="text-sm font-medium text-foreground mb-2">{data.improvementAreas.grammar.overview}</p>
                  <p className="text-sm text-muted-foreground">{data.improvementAreas.grammar.details}</p>
                </div>

                {/* Grammar Examples */}
                {data.improvementAreas.grammar.examples && data.improvementAreas.grammar.examples.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.improvementAreas.grammar.examples.map((example, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-accent/20 border border-accent">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-destructive text-xl">👤</span>
                          <h4 className="font-semibold text-accent-foreground">例子 {idx + 1}</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                            <span className="text-destructive line-through">"{example.sentence}"</span>
                          </div>
                          <div className="text-xs text-muted-foreground px-6">
                            错误: {example.error}
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                            <span className="text-success font-medium">"{example.correction}"</span>
                        </div>
                          <p className="text-xs text-muted-foreground mt-2 px-6">
                            <strong>语法规则:</strong> {example.rule}
                          </p>
                      </div>
                    </div>
                  ))}
                </div>
                )}

                {/* Grammar Suggestions */}
                {data.improvementAreas.grammar.suggestions && data.improvementAreas.grammar.suggestions.length > 0 && (
                <div className="p-5 rounded-lg bg-secondary/10 border-2 border-secondary/30">
                  <h4 className="font-bold text-secondary mb-4 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    提升建议
                  </h4>
                    <ul className="space-y-3">
                    {data.improvementAreas.grammar.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="text-sm text-foreground">
                          <div className="flex gap-2">
                            <span className="text-secondary flex-shrink-0">•</span>
                            <div>
                              <strong className="text-secondary">{suggestion.title}:</strong>{' '}
                              <span>{suggestion.description}</span>
                            </div>
                          </div>
                      </li>
                    ))}
                  </ul>
                </div>
                )}
              </div>
            )}

            {/* Intonation & Rhythm */}
            {data.improvementAreas.intonation && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                    <Music className="w-5 h-5 text-secondary" />
                  </div>
                  <h3 className="text-xl font-bold text-secondary">3. 语调与节奏 (Intonation & Rhythm)</h3>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border-l-4 border-secondary">
                  <p className="text-sm font-medium text-foreground mb-2">{data.improvementAreas.intonation.overview}</p>
                  <p className="text-sm text-muted-foreground">{data.improvementAreas.intonation.details}</p>
                </div>

                {/* Intonation Examples */}
                {data.improvementAreas.intonation.examples && data.improvementAreas.intonation.examples.length > 0 && (
                  <div className="space-y-3">
                    {data.improvementAreas.intonation.examples.map((example, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-accent/20 border border-accent">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <Music className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                            <span className="font-medium text-foreground">"{example.sentence}"</span>
                          </div>
                          <div className="text-xs text-muted-foreground px-6">
                            <strong>问题:</strong> {example.issue}
                          </div>
                          <div className="text-xs text-success px-6">
                            <strong>改进方向:</strong> {example.improvement}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Intonation Suggestions */}
                {data.improvementAreas.intonation.suggestions && data.improvementAreas.intonation.suggestions.length > 0 && (
                <div className="p-5 rounded-lg bg-secondary/10 border-2 border-secondary/30">
                  <h4 className="font-bold text-secondary mb-4 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    提升建议
                  </h4>
                    <ul className="space-y-3">
                      {data.improvementAreas.intonation.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="text-sm text-foreground">
                          <div className="flex gap-2">
                            <span className="text-secondary flex-shrink-0">•</span>
                            <div>
                              <strong className="text-secondary">{suggestion.title}:</strong>{' '}
                              <span>{suggestion.description}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div id="action-buttons" className="flex flex-col sm:flex-row gap-4 justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={onBack}
            disabled={isGeneratingPDF}
            className="border-2 border-neutral hover:bg-neutral hover:text-neutral-foreground"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            返回
          </Button>
          <Button
            size="lg"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-md hover:shadow-lg"
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                下载长图报告
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
