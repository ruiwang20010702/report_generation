import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { videoAnalysisAPI, type VideoAnalysisResponse, type SpeechContent } from "@/services/api";
import { ArrowLeft, Loader2, Printer, AlertCircle, RefreshCw, Pencil, Save, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

const InterpretationPage = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<SpeechContent | null>(null);
  const [editedInterpretation, setEditedInterpretation] = useState<SpeechContent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [reportData, setReportData] = useState<VideoAnalysisResponse | null>(null);

  const fetchInterpretation = useCallback(async (forceRegenerate = false) => {
    try {
      if (forceRegenerate) {
        setRegenerating(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let data: VideoAnalysisResponse | null = reportData || location.state?.reportData;

      // 如果没有通过 state 传递 reportData，且有 reportId，则尝试获取
      if (!data && reportId) {
        try {
          data = await videoAnalysisAPI.getReport(reportId);
          setReportData(data);
        } catch (err) {
          console.error("Failed to fetch report:", err);
          throw new Error("无法获取报告数据，请重试");
        }
      }

      if (!data) {
        throw new Error("缺少报告数据，无法生成解读");
      }

      // 保存 reportData 供后续重新生成使用
      if (!reportData) {
        setReportData(data);
      }

      // 调用生成解读接口，传入 reportId 用于缓存
      const result = await videoAnalysisAPI.generateInterpretation(data, {
        reportId,
        forceRegenerate,
      });
      setInterpretation(result.interpretation);
      setFromCache(result.fromCache);

      if (forceRegenerate) {
        toast({
          title: "重新生成成功",
          description: "解读报告已更新",
        });
      }
    } catch (err) {
      console.error("Error generating interpretation:", err);
      setError(err instanceof Error ? err.message : "生成解读报告失败");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }, [reportId, location.state, reportData]);

  useEffect(() => {
    fetchInterpretation(false);
  }, []);

  const handleRegenerate = () => {
    fetchInterpretation(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStartEdit = () => {
    if (interpretation) {
      setEditedInterpretation(JSON.parse(JSON.stringify(interpretation)));
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setEditedInterpretation(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editedInterpretation || !reportId) return;
    
    try {
      setSaving(true);
      await videoAnalysisAPI.saveInterpretation(reportId, editedInterpretation);
      setInterpretation(editedInterpretation);
      setIsEditing(false);
      setEditedInterpretation(null);
      toast({
        title: "保存成功",
        description: "解读报告已更新",
      });
    } catch (err) {
      console.error("Error saving interpretation:", err);
      toast({
        title: "保存失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (index: number, field: 'title' | 'content' | 'notes', value: string) => {
    if (!editedInterpretation) return;
    const newSections = [...editedInterpretation.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setEditedInterpretation({ ...editedInterpretation, sections: newSections });
  };

  const updateRecommendation = (index: number, value: string) => {
    if (!editedInterpretation || !editedInterpretation.learningRecommendations) return;
    const newRecs = [...editedInterpretation.learningRecommendations];
    newRecs[index] = { content: value };
    setEditedInterpretation({ ...editedInterpretation, learningRecommendations: newRecs });
  };

  const updateKeyPoint = (index: number, value: string) => {
    if (!editedInterpretation) return;
    const newPoints = [...editedInterpretation.keyPoints];
    newPoints[index] = value;
    setEditedInterpretation({ ...editedInterpretation, keyPoints: newPoints });
  };

  const updateCaution = (index: number, value: string) => {
    if (!editedInterpretation) return;
    const newCautions = [...editedInterpretation.cautions];
    newCautions[index] = value;
    setEditedInterpretation({ ...editedInterpretation, cautions: newCautions });
  };

  // 当前显示的数据（编辑模式使用编辑中的数据，否则使用原始数据）
  const displayData = isEditing ? editedInterpretation : interpretation;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">正在加载解读报告，请稍候...</p>
        <p className="text-sm text-muted-foreground mt-2">正在检查缓存或生成新内容</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>出错了</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!interpretation || !displayData) return null;

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="container max-w-4xl mx-auto py-8 px-4 print:py-0 print:px-0">
        {/* 顶部导航 - 打印时隐藏 */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> 返回报告
          </Button>
          <div className="space-x-2">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  <X className="mr-2 h-4 w-4" />
                  取消
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  保存
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleRegenerate}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  重新生成
                </Button>
                {reportId && (
                  <Button variant="outline" onClick={handleStartEdit}>
                    <Pencil className="mr-2 h-4 w-4" /> 编辑
                  </Button>
                )}
                <Button onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" /> 打印/保存PDF
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 缓存提示 */}
        {fromCache && (
          <div className="mb-4 text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 print:hidden">
            💡 此解读报告来自缓存。如需更新内容，请点击"重新生成"按钮。
          </div>
        )}

        {/* 报告主体 */}
        <div className="bg-white shadow-sm border rounded-xl p-8 md:p-12 print:shadow-none print:border-none print:p-0">
          {isEditing && (
            <div className="mb-6 text-sm text-amber-700 bg-amber-50 px-4 py-3 rounded-lg border border-amber-200">
              ✏️ 编辑模式：点击任意文本区域进行编辑，完成后点击"保存"按钮。
            </div>
          )}
          
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{displayData.title}</h1>
            <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">预计时长: {displayData.estimatedDuration}分钟</span>
              <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full">共 {displayData.sections.length} 个部分</span>
            </div>
          </div>

          {/* 关键要点 */}
          <div className="mb-10 p-6 bg-blue-50/50 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
              <span className="w-1 h-6 bg-blue-600 rounded-full mr-3"></span>
              核心沟通要点
            </h3>
            <ul className="space-y-2">
              {displayData.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start text-blue-800">
                  <span className="mr-2 mt-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span>
                  {isEditing ? (
                    <Textarea
                      value={point}
                      onChange={(e) => updateKeyPoint(i, e.target.value)}
                      className="flex-1 min-h-[40px] resize-none bg-white/80"
                      rows={1}
                    />
                  ) : (
                    point
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* 演讲内容 */}
          <div className="space-y-8">
            {displayData.sections.map((section, index) => (
              <div key={index} className="relative pl-8 border-l-2 border-gray-100 last:border-0 pb-8 last:pb-0">
                <div className="absolute -left-[9px] top-0 w-4 h-4 bg-white border-2 border-primary rounded-full"></div>
                
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-xl font-semibold text-gray-900">{section.title}</h3>
                  <span className="text-sm text-muted-foreground flex-shrink-0 ml-2">约 {section.duration} 分钟</span>
                </div>

                {/* 提示卡片 */}
                {(section.notes || isEditing) && (
                  <div className="mb-4">
                    {isEditing ? (
                      <div className="text-sm">
                        <span className="text-amber-700">💡 提示: </span>
                        <Textarea
                          value={section.notes || ''}
                          onChange={(e) => updateSection(index, 'notes', e.target.value)}
                          placeholder="输入提示内容（可选）"
                          className="mt-1 min-h-[40px] resize-none bg-amber-50/50 border-amber-200"
                          rows={1}
                        />
                      </div>
                    ) : section.notes ? (
                      <div className="text-sm text-amber-700 bg-amber-50 px-4 py-2 rounded border border-amber-100 inline-block">
                        💡 提示: {section.notes}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="prose prose-stone max-w-none">
                  {isEditing ? (
                    <Textarea
                      value={section.content}
                      onChange={(e) => updateSection(index, 'content', e.target.value)}
                      className="w-full text-lg leading-relaxed text-gray-700 min-h-[150px] resize-y"
                      rows={6}
                    />
                  ) : (
                    <p className="text-lg leading-relaxed text-gray-700 whitespace-pre-wrap">
                      {section.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 学习建议 - 独立模块，不计入演讲时长 */}
          {displayData.learningRecommendations && displayData.learningRecommendations.length > 0 && (
            <div className="mt-12 pt-8 border-t border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="w-1.5 h-8 bg-emerald-500 rounded-full mr-4"></span>
                整体学习建议（最后发给家长）
              </h2>
              <div className="space-y-6">
                {displayData.learningRecommendations.map((rec, index) => (
                  <div key={index} className="prose prose-stone max-w-none">
                    {isEditing ? (
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-emerald-700 mt-2">{index + 1}. </span>
                        <Textarea
                          value={rec.content}
                          onChange={(e) => updateRecommendation(index, e.target.value)}
                          className="flex-1 text-lg leading-relaxed text-gray-700 min-h-[100px] resize-y"
                          rows={3}
                        />
                      </div>
                    ) : (
                      <p className="text-lg leading-relaxed text-gray-700">
                        <span className="font-semibold text-emerald-700">{index + 1}. </span>
                        {rec.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 注意事项 */}
          <div className="mt-12 pt-8 border-t border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">⚠️ 注意事项</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayData.cautions.map((caution, i) => (
                <li key={i} className="flex items-start text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  {isEditing ? (
                    <Textarea
                      value={caution}
                      onChange={(e) => updateCaution(i, e.target.value)}
                      className="w-full min-h-[60px] resize-none text-sm"
                      rows={2}
                    />
                  ) : (
                    caution
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterpretationPage;

