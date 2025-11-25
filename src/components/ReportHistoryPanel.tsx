import { useMemo, useState } from "react";
import { History, RefreshCcw } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportListResponse, SavedReportSummary } from "@/services/api";

interface ReportHistoryPanelProps {
  reports: SavedReportSummary[];
  loading: boolean;
  pagination?: ReportListResponse["pagination"];
  error?: string | null;
  onRefresh: () => void | Promise<void>;
  onSelect: (reportId: string) => void;
  loadingReportId?: string | null;
}

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
};

const buildDetailLine = (report: SavedReportSummary) => {
  return [report.grade, report.level, report.unit].filter(Boolean).join(" · ");
};

export const ReportHistoryPanel = ({
  reports,
  loading,
  pagination,
  error,
  onRefresh,
  onSelect,
  loadingReportId,
}: ReportHistoryPanelProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredReports = useMemo(() => {
    if (!searchTerm) {
      return reports;
    }

    const normalized = searchTerm.trim().toLowerCase();
    return reports.filter((report) => {
      const studentName = report.studentName?.toLowerCase() || "";
      const studentId = report.studentId?.toLowerCase() || "";
      return studentName.includes(normalized) || studentId.includes(normalized);
    });
  }, [reports, searchTerm]);

  return (
    <Card className="w-full max-w-2xl mt-10">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary" />
            历史报告
          </CardTitle>
          <CardDescription>最近生成的报告会自动保存，随时可重新打开查看</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRefresh()}
          disabled={loading}
          className="ml-auto"
        >
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <Input
            placeholder="按学生姓名或ID搜索"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="sm:max-w-xs"
          />
          <Badge variant="secondary">
            共 {pagination?.total ?? reports.length} 份
          </Badge>
        </div>

        {error && (
          <div className="text-sm text-destructive mb-3">
            {error}
          </div>
        )}

        <ScrollArea className="h-[400px] pr-3 [&>div>div]:!block">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-md" />
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchTerm
                ? "没有符合条件的历史报告"
                : "暂未找到历史报告记录。生成分析后会自动保存到这里"}
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-sm sm:text-base">
                      {report.studentName || "未命名学生"}
                      {report.studentId && (
                        <span className="ml-2 text-xs text-muted-foreground">#{report.studentId}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {buildDetailLine(report) || "未提供年级/级别信息"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(report.createdAt)}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="sm:w-28"
                    onClick={() => onSelect(report.id)}
                    disabled={loadingReportId === report.id}
                  >
                    {loadingReportId === report.id ? "载入中..." : "查看报告"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

