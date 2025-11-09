import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Film, User, GraduationCap, TrendingUp, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface FormData {
  video1: string;
  video2: string;
  studentName: string;
  grade: string;
  level: string;
  unit: string;
  date: string;
  date2: string;
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
  const [formData, setFormData] = useState<FormData>({
    video1: "",
    video2: "",
    studentName: "",
    grade: "",
    level: "",
    unit: "",
    date: "",
    date2: ""
  });

  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedDate2, setSelectedDate2] = useState<Date>();

  const [errors, setErrors] = useState<Partial<FormData>>({});

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
        <CardTitle className="text-3xl font-bold text-primary">英语学习视频分析</CardTitle>
        <CardDescription className="text-base text-muted-foreground">
          上传两个学习视频，让AI为您生成专业的学习分析报告
        </CardDescription>
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

          {/* Video Links */}
          <div className="space-y-4 pt-4 border-t border-border">
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
                      setFormData({ ...formData, date: date ? format(date, "yyyy-MM-dd") : "" });
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
            </div>

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
                onChange={(e) => setFormData({ ...formData, video1: e.target.value })}
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
                      setFormData({ ...formData, date2: date ? format(date, "yyyy-MM-dd") : "" });
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {errors.date2 && <p className="text-sm text-destructive">{errors.date2}</p>}
            </div>

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
                onChange={(e) => setFormData({ ...formData, video2: e.target.value })}
                className={`h-12 ${errors.video2 ? 'border-destructive' : ''}`}
              />
              {errors.video2 && <p className="text-sm text-destructive">{errors.video2}</p>}
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
