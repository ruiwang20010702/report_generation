import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Login from "./pages/Login";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary, { PageErrorBoundary } from "./components/ErrorBoundary";

// 配置 QueryClient 的错误处理
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 查询失败时的重试配置
      retry: (failureCount, error) => {
        // 对于 4xx 错误不重试
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        // 最多重试 2 次
        return failureCount < 2;
      },
      // 重试延迟
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // 错误时不自动重新获取
      refetchOnWindowFocus: false,
    },
    mutations: {
      // mutation 失败时的重试配置
      retry: 1,
      retryDelay: 1000,
    },
  },
});

const App = () => (
  // 应用级 Error Boundary - 捕获整个应用的未处理错误
  <ErrorBoundary level="app">
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* 登录页面单独包装 Error Boundary */}
                <Route 
                  path="/login" 
                  element={
                    <PageErrorBoundary>
                      <Login />
                    </PageErrorBoundary>
                  } 
                />
                {/* 主页面包装 Error Boundary */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <PageErrorBoundary>
                        <Index />
                      </PageErrorBoundary>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
