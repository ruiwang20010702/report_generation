import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, TrendingDown, Minus, ArrowLeft, Volume2, Code2, Music, Lightbulb, X, Check, Hand, MessageSquare, CheckCircle, BookMarked, BarChart3, Target, Trophy } from "lucide-react";
import logo51Talk from "@/assets/51talk-logo-new.jpg";
import mascotHighFive from "@/assets/mascot-highfive-card.png";
import mascotLearn from "@/assets/mascot-learn-card.png";
import mascotGoodJob from "@/assets/mascot-goodjob-card.png";
import mascotYouDidIt from "@/assets/mascot-youdidit-card.png";
import microphoneIcon from "@/assets/microphone-icon.png";
import iconFluency from "@/assets/icon-fluency.png";
import iconConfidence from "@/assets/icon-confidence.png";
import iconLanguage from "@/assets/icon-language.png";
import iconComplexity from "@/assets/icon-complexity.png";

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
      examples: Array<{
        category: string;
        incorrect: string;
        correct: string;
        explanation: string;
      }>;
      suggestions: Array<{
        point: string;
      }>;
    };
    intonation?: {
      observation: string;
      suggestions: Array<{
        point: string;
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
  const handleDownloadPDF = () => {
    // PDF download functionality will be implemented
    console.log("Downloading PDF...");
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--report-background))] p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6 bg-white rounded-3xl shadow-elevated p-6 md:p-8 border-4 border-primary/50">
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
                          <TrendIcon trend={value.trend} />
                          <div className="text-5xl font-extrabold text-secondary drop-shadow-sm">{value.percentage}</div>
                          <TrendBadge trend={value.trend} />
                        </div>
                        <p className="text-base text-muted-foreground leading-relaxed">{value.analysis}</p>
                      </div>
                      
                      {/* Right side - Mascot Image */}
                      <div className="w-2/5 flex items-center justify-center p-2">
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
                  fluency: { title: "流利度", iconImage: iconFluency },
                  confidence: { title: "自信度", iconImage: iconConfidence },
                  languageApplication: { title: "语言应用", iconImage: iconLanguage },
                  sentenceComplexity: { title: "句型复杂度", iconImage: iconComplexity }
                };

                const { title, iconImage } = config[key as keyof typeof config];

                return (
                  <div key={key} className="p-6 rounded-2xl border-none shadow-md bg-gradient-to-br from-white to-muted/30 hover:shadow-lg transition-all h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                        <img src={iconImage} alt={title} className="w-full h-full object-cover" />
                      </div>
                      <h4 className="font-bold text-xl text-secondary">
                        {title}
                      </h4>
                    </div>
                    <p className="text-foreground mb-4 text-base flex-grow leading-relaxed">{value.analysis}</p>
                    <div className="bg-gradient-to-r from-accent/30 to-accent/50 p-4 rounded-xl border-l-4 border-secondary mt-auto shadow-sm">
                      <p className="text-base font-medium text-accent-foreground">
                        <span className="font-bold text-secondary">💡 示例：</span> {value.example}
                      </p>
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
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center shadow-sm">
                    <img src={microphoneIcon} alt="Microphone" className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-destructive">1. 发音准确性</h3>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-r from-destructive/5 to-destructive/10 border-l-4 border-destructive shadow-sm">
                  <p className="font-bold text-destructive mb-2 text-lg">{data.improvementAreas.pronunciation.overview}</p>
                  <p className="text-base text-muted-foreground leading-relaxed">{data.improvementAreas.pronunciation.details}</p>
                </div>

                {/* Specific Pronunciation Examples */}
                <div className="space-y-4">
                  <h4 className="font-bold text-foreground flex items-center gap-2 text-xl">
                    <span className="text-3xl">📝</span> 特定单词发音问题单
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {data.improvementAreas.pronunciation.examples.map((example, idx) => (
                      <div key={idx} className="p-5 rounded-2xl border-none shadow-md bg-gradient-to-br from-white to-muted/20 hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <span className="font-bold text-2xl text-foreground">{example.word}</span>
                          <Badge variant="destructive" className="text-sm rounded-lg">{example.type}</Badge>
                        </div>
                        <div className="space-y-1 text-base">
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
                <div className="p-6 rounded-2xl bg-gradient-to-br from-secondary/10 to-secondary/5 border-none shadow-md">
                  <h4 className="font-bold text-secondary mb-5 flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                      <Lightbulb className="w-6 h-6 text-secondary" />
                    </div>
                    提升建议
                  </h4>
                  <div className="space-y-4">
                    {data.improvementAreas.pronunciation.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex gap-4 p-4 rounded-xl bg-white/50 hover:bg-white/80 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground flex items-center justify-center flex-shrink-0 font-bold text-base shadow-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <h5 className="font-bold text-foreground text-base mb-1">{suggestion.title}</h5>
                          <p className="text-base text-muted-foreground leading-relaxed">{suggestion.description}</p>
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
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm">
                    <Code2 className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-primary">2. 语法细节</h3>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-r from-muted/30 to-muted/50 border-l-4 border-primary shadow-sm">
                  <p className="text-base text-muted-foreground leading-relaxed">{data.improvementAreas.grammar.overview}</p>
                </div>

                {/* Grammar Examples */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {data.improvementAreas.grammar.examples.map((example, idx) => (
                    <div key={idx} className="p-5 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/10 border-none shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">📖</span>
                        <h4 className="font-bold text-accent-foreground text-base">{example.category}</h4>
                      </div>
                      <div className="space-y-2 text-base">
                        <div className="flex items-start gap-2">
                          <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                          <span className="text-destructive line-through">"{example.incorrect}"</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                          <span className="text-success font-medium">"{example.correct}"</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{example.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grammar Suggestions */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-secondary/10 to-secondary/5 border-none shadow-md">
                  <h4 className="font-bold text-secondary mb-5 flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                      <Lightbulb className="w-6 h-6 text-secondary" />
                    </div>
                    提升建议
                  </h4>
                  <ul className="space-y-2">
                    {data.improvementAreas.grammar.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="flex gap-2 text-base text-foreground">
                        <span className="text-secondary">•</span>
                        <span>{suggestion.point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Intonation & Rhythm */}
            {data.improvementAreas.intonation && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center shadow-sm">
                    <Music className="w-7 h-7 text-secondary" />
                  </div>
                  <h3 className="text-2xl font-bold text-secondary">3. 语调与节奏</h3>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-r from-muted/30 to-muted/50 border-l-4 border-secondary shadow-sm">
                  <p className="text-base text-muted-foreground leading-relaxed">{data.improvementAreas.intonation.observation}</p>
                </div>

                {/* Intonation Suggestions */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-secondary/10 to-secondary/5 border-none shadow-md">
                  <h4 className="font-bold text-secondary mb-5 flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                      <Lightbulb className="w-6 h-6 text-secondary" />
                    </div>
                    提升建议
                  </h4>
                  <p className="text-base text-muted-foreground">
                    {data.improvementAreas.intonation.suggestions.map((s, idx) => s.point).join(' ')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between mt-8">
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
            size="lg"
            onClick={handleDownloadPDF}
            className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary text-secondary-foreground shadow-md hover:shadow-xl rounded-xl font-semibold transition-all"
          >
            <Download className="w-5 h-5 mr-2" />
            下载PDF报告
          </Button>
        </div>
      </div>
    </div>
  );
};
