/**
 * React Error Boundary 组件
 * 捕获子组件树中的 JavaScript 错误，记录错误并显示备用 UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 错误边界 Props
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义 fallback UI */
  fallback?: ReactNode;
  /** 错误发生时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 是否显示详细错误信息（开发模式） */
  showDetails?: boolean;
  /** 错误边界级别标识 */
  level?: 'app' | 'page' | 'component';
}

/**
 * 错误边界 State
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * 错误边界组件
 * 使用 Class Component 因为 Error Boundary 必须使用生命周期方法
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  /**
   * 静态方法：从错误中派生状态
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  /**
   * 生命周期方法：捕获错误信息
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 更新状态以保存错误信息
    this.setState({ errorInfo });

    // 记录到控制台
    console.error('🚨 ErrorBoundary caught an error:', error);
    console.error('📍 Component stack:', errorInfo.componentStack);

    // 报告到 Sentry
    try {
      Sentry.captureException(error, {
        level: 'error',
        tags: {
          errorBoundary: this.props.level || 'unknown',
          errorId: this.state.errorId || 'unknown',
        },
        extra: {
          componentStack: errorInfo.componentStack,
        },
      });
    } catch (sentryError) {
      console.warn('Failed to report error to Sentry:', sentryError);
    }

    // 调用自定义错误回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * 重置错误状态
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  /**
   * 刷新页面
   */
  handleRefresh = (): void => {
    window.location.reload();
  };

  /**
   * 返回首页
   */
  handleGoHome = (): void => {
    window.location.href = '/';
  };

  /**
   * 复制错误信息
   */
  handleCopyError = (): void => {
    const { error, errorInfo, errorId } = this.state;
    const errorText = `
错误ID: ${errorId}
错误信息: ${error?.message}
错误堆栈: ${error?.stack}
组件堆栈: ${errorInfo?.componentStack}
时间: ${new Date().toISOString()}
用户代理: ${navigator.userAgent}
URL: ${window.location.href}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      alert('错误信息已复制到剪贴板');
    }).catch(() => {
      console.error('Failed to copy error info');
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children, fallback, showDetails, level } = this.props;

    // 如果没有错误，正常渲染子组件
    if (!hasError) {
      return children;
    }

    // 如果提供了自定义 fallback，使用它
    if (fallback) {
      return fallback;
    }

    // 是否显示详细信息（开发模式或明确指定）
    const shouldShowDetails = showDetails ?? import.meta.env.DEV;

    // 根据级别决定 UI 样式
    const isAppLevel = level === 'app';
    const isPageLevel = level === 'page';

    return (
      <div className={`
        flex items-center justify-center 
        ${isAppLevel ? 'min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800' : ''}
        ${isPageLevel ? 'min-h-[60vh]' : ''}
        ${!isAppLevel && !isPageLevel ? 'p-4' : ''}
      `}>
        <Card className={`
          ${isAppLevel || isPageLevel ? 'w-full max-w-lg mx-4' : 'w-full'}
          shadow-lg border-red-200 dark:border-red-800
        `}>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl text-red-700 dark:text-red-400">
              {isAppLevel ? '应用程序出错了' : isPageLevel ? '页面加载失败' : '组件加载失败'}
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {isAppLevel
                ? '抱歉，应用程序遇到了意外错误。请尝试刷新页面或返回首页。'
                : '抱歉，加载过程中出现了问题。请尝试重试或刷新页面。'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 错误摘要 */}
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-800">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                错误信息
              </p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400 break-words">
                {error?.message || '未知错误'}
              </p>
              {errorId && (
                <p className="mt-2 text-xs text-red-500 dark:text-red-500">
                  错误ID: {errorId}
                </p>
              )}
            </div>

            {/* 详细错误信息（仅开发模式） */}
            {shouldShowDetails && (
              <details className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  技术详情（开发模式）
                </summary>
                <div className="mt-3 space-y-3">
                  {/* 错误堆栈 */}
                  {error?.stack && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        错误堆栈:
                      </p>
                      <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-32 p-2 bg-gray-100 dark:bg-gray-900 rounded">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {/* 组件堆栈 */}
                  {errorInfo?.componentStack && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        组件堆栈:
                      </p>
                      <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-32 p-2 bg-gray-100 dark:bg-gray-900 rounded">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </CardContent>

          <CardFooter className="flex flex-wrap gap-2 justify-center">
            {/* 重试按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              重试
            </Button>

            {/* 刷新页面 */}
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRefresh}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              刷新页面
            </Button>

            {/* 返回首页（仅页面级别以上） */}
            {(isAppLevel || isPageLevel) && (
              <Button
                variant="default"
                size="sm"
                onClick={this.handleGoHome}
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                返回首页
              </Button>
            )}

            {/* 复制错误信息（开发模式） */}
            {shouldShowDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={this.handleCopyError}
                className="gap-2 text-gray-500"
              >
                <Bug className="h-4 w-4" />
                复制错误
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }
}

/**
 * 页面级 Error Boundary 包装器
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary level="page">
      {children}
    </ErrorBoundary>
  );
}

/**
 * 组件级 Error Boundary 包装器
 */
export function ComponentErrorBoundary({ 
  children, 
  fallback 
}: { 
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary level="component" fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * 使用 Sentry 的 Error Boundary（如果可用）
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

export default ErrorBoundary;

