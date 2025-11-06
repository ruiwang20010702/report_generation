import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, User, GraduationCap, TrendingUp, AlertCircle, ExternalLink, CheckCircle2, Key, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FormData {
  video1: string;
  video2: string;
  studentName: string;
  grade: string;
  level: string;
  unit: string;
  apiKey?: string;
  useMockData?: boolean;
}

interface VideoAnalysisFormProps {
  onSubmit: (data: FormData) => void;
}

const GRADES = [
  "小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级",
  "初中一年级", "初中二年级", "初中三年级",
  "高中一年级", "高中二年级", "高中三年级"
];

const LEVELS = ["Level 0", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6", "Level 7", "Level 8", "Level 9"];

export const VideoAnalysisForm = ({ onSubmit }: VideoAnalysisFormProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({
    video1: "",
    video2: "",
    studentName: "",
    grade: "",
    level: "",
    unit: "",
    apiKey: "",
    useMockData: true
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 快速填充测试数据
  const fillTestData = () => {
    setFormData({
      video1: "https://www.youtube.com/watch?v=example1",
      video2: "https://www.youtube.com/watch?v=example2",
      studentName: "小明",
      grade: "小学三年级",
      level: "Level 3",
      unit: "5",
      apiKey: "",
      useMockData: true
    });
    toast({
      title: "测试数据已填充",
      description: "您可以直接提交查看效果（使用模拟数据）",
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.video1.trim()) {
      newErrors.video1 = "请输入第一个视频链接";
    } else if (!isValidUrl(formData.video1)) {
      newErrors.video1 = "请输入有效的视频链接";
    }

    if (!formData.video2.trim()) {
      newErrors.video2 = "请输入第二个视频链接";
    } else if (!isValidUrl(formData.video2)) {
      newErrors.video2 = "请输入有效的视频链接";
    }

    if (!formData.studentName.trim()) {
      newErrors.studentName = "请输入学生姓名";
    } else if (formData.studentName.length < 2 || formData.studentName.length > 10) {
      newErrors.studentName = "姓名长度应为2-10个字符";
    }

    if (!formData.grade) {
      newErrors.grade = "请选择年级";
    }

    if (!formData.level) {
      newErrors.level = "请选择级别";
    }

    // 如果不使用模拟数据，验证 API Key
    if (!formData.useMockData && !formData.apiKey?.trim()) {
      newErrors.apiKey = "请输入 OpenAI API Key，或选择使用模拟数据";
    } else if (formData.apiKey && !formData.apiKey.startsWith('sk-')) {
      newErrors.apiKey = "API Key 格式不正确（应以 sk- 开头）";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      // 检查是否是http或https协议
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "表单验证失败",
        description: "请检查所有必填字段是否正确填写",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const submitData = {
        ...formData,
        unit: formData.unit ? `Unit ${formData.unit}` : ""
      };
      
      toast({
        title: "提交成功！",
        description: "正在开始分析您的视频...",
      });
      
      onSubmit(submitData);
    } catch (error) {
      toast({
        title: "提交失败",
        description: "请稍后重试或联系技术支持",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-elevated border-2 border-primary/20">
      <CardHeader className="space-y-2 bg-gradient-hero">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-3xl font-bold text-primary">英语学习视频分析</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              上传两个学习视频，让AI为您生成专业的学习分析报告
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fillTestData}
            className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
          >
            快速测试
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Student Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentName" className="flex items-center gap-2 text-base font-semibold">
                <User className="w-5 h-5 text-secondary" />
                学生姓名
              </Label>
              <Input
                id="studentName"
                type="text"
                placeholder="请输入学生姓名"
                value={formData.studentName}
                onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                className={`h-12 ${errors.studentName ? 'border-destructive' : ''}`}
              />
              {errors.studentName && <p className="text-sm text-destructive">{errors.studentName}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grade" className="flex items-center gap-2 text-base font-semibold">
                  <GraduationCap className="w-5 h-5 text-secondary" />
                  年级
                </Label>
                <Select value={formData.grade} onValueChange={(value) => setFormData({ ...formData, grade: value })}>
                  <SelectTrigger className={`h-12 ${errors.grade ? 'border-destructive' : ''}`}>
                    <SelectValue placeholder="选择年级" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.grade && <p className="text-sm text-destructive">{errors.grade}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="level" className="flex items-center gap-2 text-base font-semibold">
                  <TrendingUp className="w-5 h-5 text-secondary" />
                  级别
                </Label>
                <Select value={formData.level} onValueChange={(value) => setFormData({ ...formData, level: value })}>
                  <SelectTrigger className={`h-12 ${errors.level ? 'border-destructive' : ''}`}>
                    <SelectValue placeholder="选择级别" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.level && <p className="text-sm text-destructive">{errors.level}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit" className="flex items-center gap-2 text-base font-semibold">
                <Film className="w-5 h-5 text-secondary" />
                单元 <span className="text-xs text-muted-foreground font-normal">(可选)</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-medium whitespace-nowrap">Unit</span>
                <Input
                  id="unit"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="输入数字，如 5"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="h-12 flex-1"
                />
              </div>
            </div>
          </div>

          {/* AI Configuration */}
          <div className="space-y-4 pt-4 border-t border-border">
            <Alert className="bg-secondary/10 border-secondary/30">
              <Sparkles className="h-4 w-4 text-secondary" />
              <AlertDescription className="ml-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground">使用真实 AI 分析</div>
                      <div className="text-sm text-muted-foreground">
                        {formData.useMockData 
                          ? "当前使用模拟数据（免费测试）" 
                          : "当前使用 OpenAI GPT-4 进行真实分析（需要 API Key）"}
                      </div>
                    </div>
                    <Switch
                      checked={!formData.useMockData}
                      onCheckedChange={(checked) => setFormData({ ...formData, useMockData: !checked })}
                    />
                  </div>
                  
                  {!formData.useMockData && (
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Label htmlFor="apiKey" className="flex items-center gap-2 text-sm font-semibold">
                        <Key className="w-4 h-4 text-secondary" />
                        OpenAI API Key
                      </Label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="sk-..."
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        className={`h-10 font-mono text-sm ${errors.apiKey ? 'border-destructive' : ''}`}
                      />
                      {errors.apiKey && <p className="text-sm text-destructive">{errors.apiKey}</p>}
                      <p className="text-xs text-muted-foreground">
                        您的 API Key 仅用于本次分析，不会被存储。
                        <a 
                          href="https://platform.openai.com/api-keys" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-secondary hover:underline ml-1"
                        >
                          获取 API Key →
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          </div>

          {/* Video Links */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="space-y-2">
              <Label htmlFor="video1" className="flex items-center gap-2 text-base font-semibold">
                <Film className="w-5 h-5 text-secondary" />
                第一个视频链接（较早的视频）
              </Label>
              <Input
                id="video1"
                type="url"
                placeholder="https://example.com/video1"
                value={formData.video1}
                onChange={(e) => setFormData({ ...formData, video1: e.target.value })}
                className={`h-12 ${errors.video1 ? 'border-destructive' : ''}`}
              />
              {errors.video1 && <p className="text-sm text-destructive">{errors.video1}</p>}
              {formData.video1 && isValidUrl(formData.video1) && !errors.video1 && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>有效的URL</span>
                  <a 
                    href={formData.video1} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-secondary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    预览
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="video2" className="flex items-center gap-2 text-base font-semibold">
                <Film className="w-5 h-5 text-secondary" />
                第二个视频链接（较新的视频）
              </Label>
              <Input
                id="video2"
                type="url"
                placeholder="https://example.com/video2"
                value={formData.video2}
                onChange={(e) => setFormData({ ...formData, video2: e.target.value })}
                className={`h-12 ${errors.video2 ? 'border-destructive' : ''}`}
              />
              {errors.video2 && <p className="text-sm text-destructive">{errors.video2}</p>}
              {formData.video2 && isValidUrl(formData.video2) && !errors.video2 && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>有效的URL</span>
                  <a 
                    href={formData.video2} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-secondary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    预览
                  </a>
                </div>
              )}
            </div>
          </div>

          <Button 
            type="submit" 
            size="lg"
            disabled={isSubmitting}
            className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isSubmitting ? "提交中..." : "生成学习报告"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
