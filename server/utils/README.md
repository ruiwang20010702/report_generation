# 错误处理系统

## 概述

统一的错误处理系统提供了标准化的错误处理机制，包括：
- 统一的错误类型定义
- 用户友好的错误消息
- 详细的错误上下文记录
- 自动错误日志记录

## 使用方法

### 1. 抛出错误

```typescript
import { AppError, ErrorType } from '../utils/errors.js';

// 基本用法
throw new AppError(
  ErrorType.VALIDATION_ERROR,
  'Missing required field: video1',
  {
    userMessage: '请提供第一个视频链接',
    context: { studentName: 'John' },
  }
);
```

### 2. 在路由中使用

```typescript
import { asyncHandler, AppError, ErrorType } from '../utils/errors.js';

router.post('/api/endpoint', asyncHandler(async (req, res) => {
  // 路由逻辑
  // 错误会自动被捕获并转换为用户友好的响应
}));
```

### 3. 错误类型

- `VALIDATION_ERROR` - 请求参数验证失败
- `AUTHENTICATION_ERROR` - 身份验证失败
- `AUTHORIZATION_ERROR` - 权限不足
- `NOT_FOUND` - 资源不存在
- `RATE_LIMIT_EXCEEDED` - 请求过于频繁
- `INTERNAL_ERROR` - 服务器内部错误
- `SERVICE_UNAVAILABLE` - 服务不可用
- `TIMEOUT_ERROR` - 请求超时
- `TRANSCRIPTION_ERROR` - 视频转录失败
- `AI_ANALYSIS_ERROR` - AI分析失败
- `VIDEO_PROCESSING_ERROR` - 视频处理失败
- `API_KEY_ERROR` - API密钥错误
- `QUOTA_EXCEEDED` - 服务额度已用完

## 特性

### 自动错误转换

系统会自动将普通错误转换为 `AppError`，并提供用户友好的错误消息。

### 错误上下文

每个错误都包含详细的上下文信息：
- `requestId` - 请求唯一标识
- `timestamp` - 错误发生时间
- `path` - 请求路径
- `method` - HTTP方法
- `userAgent` - 用户代理
- `ip` - 客户端IP
- 自定义上下文信息

### 错误日志

所有错误都会自动记录到日志，包括：
- 错误类型和严重程度
- 技术性错误消息
- 用户友好消息
- 完整的堆栈跟踪
- 原始错误信息

## 响应格式

### 生产环境

```json
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "请提供第一个视频链接",
    "requestId": "uuid",
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

### 开发环境

开发环境会包含额外的调试信息：
- `technicalMessage` - 技术性错误消息
- `stack` - 堆栈跟踪
- `context` - 完整上下文信息

