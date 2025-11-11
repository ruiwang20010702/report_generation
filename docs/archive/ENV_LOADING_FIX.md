# 环境变量加载问题修复说明

## 问题描述
服务启动时显示 "Default mode: MOCK"，即使 `.env` 文件中已经配置了 `OPENAI_API_KEY` 和 `ASSEMBLYAI_API_KEY`。

## 根本原因
ES6 模块的导入机制导致 `VideoAnalysisService` 在 `dotenv.config()` **之前**就被实例化了：

```
server/index.ts (第 7 行)
  ├── dotenv.config()  ← 这里加载环境变量
  ├── import analysisRouter (第 9 行)
      └── server/routes/analysis.ts
          └── const analysisService = new VideoAnalysisService()  ← 这里环境变量还没加载！
```

虽然 `dotenv.config()` 在代码中看起来在 `import` 之前，但 ES6 的 `import` 语句会在运行时之前被提升（hoisting），导致模块在 `dotenv.config()` 执行前就开始加载。

## 解决方案
使用**懒加载模式**（Lazy Initialization），延迟服务的实例化，确保环境变量已经加载：

### 修改前 (`server/routes/analysis.ts`)
```typescript
const analysisService = new VideoAnalysisService();  // ❌ 立即实例化

router.post('/analyze', async (req, res) => {
  const result = await analysisService.analyzeVideos(requestData);
});
```

### 修改后 (`server/routes/analysis.ts`)
```typescript
// ✅ 懒加载：延迟到第一次使用时才实例化
let analysisService: VideoAnalysisService | null = null;
const getAnalysisService = () => {
  if (!analysisService) {
    analysisService = new VideoAnalysisService();
  }
  return analysisService;
};

router.post('/analyze', async (req, res) => {
  const service = getAnalysisService();  // 这时环境变量已加载
  const result = await service.analyzeVideos(requestData);
});
```

## 验证
启动后端后，日志应显示：
```
🚀 Server is running on port 3001
🔧 Mock mode: OFF
🔑 OpenAI API Key: SET (length: 164)
🔑 AssemblyAI API Key: SET
```

发送第一个请求时，才会看到服务初始化：
```
✅ Default mode: REAL - using server OpenAI API
✅ AssemblyAI service initialized successfully
```

## 其他服务
`AssemblyAIService` 已经采用了懒加载模式（使用 getter 代理），因此不受此问题影响。

## 相关文件
- `server/routes/analysis.ts` - 修改了服务实例化方式
- `server/services/videoAnalysisService.ts` - 服务类本身
- `server/services/assemblyAIService.ts` - 已使用懒加载模式
- `.env` - 环境变量配置文件

---
**修复日期**: 2025-11-06  
**问题关键词**: dotenv, ES6 module hoisting, lazy initialization, environment variables

