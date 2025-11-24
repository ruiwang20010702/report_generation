import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Film, User, GraduationCap, TrendingUp, Zap, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  useMockData?: boolean;
}

interface VideoAnalysisFormProps {
  onSubmit: (data: FormData) => void;
}

const GRADES = [
  "幼儿园",
  "小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级",
  "初中一年级", "初中二年级", "初中三年级",
  "高中一年级", "高中二年级", "高中三年级"
];

const LEVELS = ["LS", "Level 0", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6", "Level 7", "Level 8", "Level 9"];

export const VideoAnalysisForm = ({ onSubmit }: VideoAnalysisFormProps) => {
  const [formData, setFormData] = useState<FormData>({
    video1: "",
    video2: "",
    studentName: "",
    studentId: "",
    grade: "",
    level: "",
    unit: "",
    date: "",
    date2: "",
    useMockData: false
  });

  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedDate2, setSelectedDate2] = useState<Date>();

  const [errors, setErrors] = useState<Partial<FormData>>({});

  // 更新表单字段，如果 useMockData 为 true，则重置为 false
  const updateFormField = (updates: Partial<FormData>) => {
    setFormData((prev) => {
      // 如果用户手动修改了表单，且之前是使用 mock 数据，则重置 useMockData
      const newData = { ...prev, ...updates };
      if (prev.useMockData) {
        newData.useMockData = false;
      }
      return newData;
    });
  };

  // 快速测试功能：自动填充表单数据
  const handleQuickTest = () => {
    const date1 = new Date();
    const date2 = new Date(date1.getTime() - 7 * 24 * 60 * 60 * 1000); // 7天前
    setSelectedDate(date1);
    setSelectedDate2(date2);
    setFormData({
      video1: "https://example.com/demo-video-1.mp4",
      video2: "https://example.com/demo-video-2.mp4",
      studentName: "张小明",
      studentId: "STU001",
      grade: "小学三年级",
      level: "Level 3",
      unit: "5",
      date: format(date1, "yyyy-MM-dd"),
      date2: format(date2, "yyyy-MM-dd"),
      useMockData: true // 默认使用模拟数据进行快速测试
    });
    setErrors({});
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

    if (!formData.studentId.trim()) {
      newErrors.studentId = "请输入学生ID";
    } else if (formData.studentId.length < 3 || formData.studentId.length > 20) {
      newErrors.studentId = "学生ID长度应为3-20个字符";
    }

    if (!formData.grade) {
      newErrors.grade = "请选择年级";
    }

    if (!formData.level) {
      newErrors.level = "请选择级别";
    }

    if (!formData.unit.trim()) {
      newErrors.unit = "请输入单元";
    }

    if (!formData.date) {
      newErrors.date = "请选择日期";
    }

    if (!formData.date2) {
      newErrors.date2 = "请选择日期";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // 从URL中提取日期（格式：YYYYMMDD）
  const extractDateFromUrl = (url: string): Date | null => {
    try {
      // 匹配 URL 路径中的日期格式 YYYYMMDD（8位数字）
      const dateMatch = url.match(/\/(\d{8})\//);
      if (dateMatch) {
        const dateStr = dateMatch[1];
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; // 月份从0开始
        const day = parseInt(dateStr.substring(6, 8));
        const date = new Date(year, month, day);
        // 验证日期是否有效
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
          return date;
        }
      }
    } catch (error) {
      // 如果解析失败，返回 null
    }
    return null;
  };

  // 处理视频链接输入，自动提取日期
  const handleVideoInput = (field: 'video1' | 'video2', value: string) => {
    // 尝试从URL中提取日期
    const extractedDate = extractDateFromUrl(value);

    // 同时更新视频链接和日期（如果找到）
    const updates: Partial<FormData> = { [field]: value };
    if (extractedDate) {
      const dateStr = format(extractedDate, "yyyy-MM-dd");
      if (field === 'video1') {
        setSelectedDate(extractedDate);
        updates.date = dateStr;
      } else if (field === 'video2') {
        setSelectedDate2(extractedDate);
        updates.date2 = dateStr;
      }
    }
    updateFormField(updates);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const submitData = {
        ...formData,
        unit: formData.unit ? `Unit ${formData.unit}` : ""
      };
      onSubmit(submitData);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-elevated border-2 border-primary/20">
      <CardHeader className="space-y-2 bg-gradient-hero">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-3xl font-bold text-primary">英语学习视频分析</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              上传两个学习视频，让AI为您生成专业的学习分析报告
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleQuickTest}
            className={cn(
              "ml-4 flex items-center gap-2 font-semibold",
              formData.useMockData
                ? "bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500 text-yellow-700 dark:text-yellow-400"
                : "bg-secondary/10 hover:bg-secondary/20 border-secondary text-secondary-foreground"
            )}
          >
            <Zap className="w-4 h-4" />
            快速测试
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Student Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  onChange={(e) => updateFormField({ studentName: e.target.value })}
                  className={`h-12 ${errors.studentName ? 'border-destructive' : ''}`}
                />
                {errors.studentName && <p className="text-sm text-destructive">{errors.studentName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="studentId" className="flex items-center gap-2 text-base font-semibold">
                  <User className="w-5 h-5 text-secondary" />
                  学生ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="studentId"
                  type="text"
                  placeholder="请输入学生ID（例如：STU001）"
                  value={formData.studentId}
                  onChange={(e) => updateFormField({ studentId: e.target.value })}
                  className="h-12"
                />
                {errors.studentId && <p className="text-sm text-destructive">{errors.studentId}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grade" className="flex items-center gap-2 text-base font-semibold">
                  <GraduationCap className="w-5 h-5 text-secondary" />
                  年级
                </Label>
                <Select value={formData.grade} onValueChange={(value) => updateFormField({ grade: value })}>
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
                <Select value={formData.level} onValueChange={(value) => updateFormField({ level: value })}>
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

              <div className="space-y-2">
                <Label htmlFor="unit" className="flex items-center gap-2 text-base font-semibold">
                  <Film className="w-5 h-5 text-secondary" />
                  单元
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
                    onChange={(e) => updateFormField({ unit: e.target.value })}
                    className="h-12 flex-1"
                  />
                </div>
                {errors.unit && <p className="text-sm text-destructive">{errors.unit}</p>}
              </div>
            </div>
          </div>

          {/* Video Links */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="video1" className="flex items-center gap-2 text-base font-semibold">
                  <Film className="w-5 h-5 text-secondary" />
                  第一个视频链接
                </Label>
                <Input
                  id="video1"
                  type="url"
                  placeholder="https://example.com/video1"
                  value={formData.video1}
                  onChange={(e) => handleVideoInput('video1', e.target.value)}
                  className={`h-12 ${errors.video1 ? 'border-destructive' : ''}`}
                />
                {errors.video1 && <p className="text-sm text-destructive">{errors.video1}</p>}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <CalendarIcon className="w-5 h-5 text-secondary" />
                  筛选日期
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-12 justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground",
                        errors.date && "border-destructive"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>选择日期</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        updateFormField({ date: date ? format(date, "yyyy-MM-dd") : "" });
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="video2" className="flex items-center gap-2 text-base font-semibold">
                  <Film className="w-5 h-5 text-secondary" />
                  第二个视频链接
                </Label>
                <Input
                  id="video2"
                  type="url"
                  placeholder="https://example.com/video2"
                  value={formData.video2}
                  onChange={(e) => handleVideoInput('video2', e.target.value)}
                  className={`h-12 ${errors.video2 ? 'border-destructive' : ''}`}
                />
                {errors.video2 && <p className="text-sm text-destructive">{errors.video2}</p>}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <CalendarIcon className="w-5 h-5 text-secondary" />
                  筛选日期
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-12 justify-start text-left font-normal",
                        !selectedDate2 && "text-muted-foreground",
                        errors.date2 && "border-destructive"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate2 ? format(selectedDate2, "PPP") : <span>选择日期</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate2}
                      onSelect={(date) => {
                        setSelectedDate2(date);
                        updateFormField({ date2: date ? format(date, "yyyy-MM-dd") : "" });
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {errors.date2 && <p className="text-sm text-destructive">{errors.date2}</p>}
              </div>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all"
          >
            生成学习报告
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
