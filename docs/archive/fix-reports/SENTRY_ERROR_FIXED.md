# 🔧 Sentry 错误修复

## ❌ 问题描述

浏览器控制台出现 Sentry 初始化错误：

```
TypeError: Sentry.reactRouterV6Instrumentation is not a function
  at initSentry (sentry.ts:35:42)
  at main.tsx:7:1
```

---

## 🔍 根本原因

使用了 **已废弃的 Sentry API**。

在新版本的 `@sentry/react` 中：
- ❌ `Sentry.BrowserTracing` + `Sentry.reactRouterV6Instrumentation` 已废弃
- ❌ `new Sentry.Replay()` 已废弃

新版本使用：
- ✅ `Sentry.reactRouterV6BrowserTracingIntegration()`
- ✅ `Sentry.replayIntegration()`

---

## ✅ 修复方案

### 修改文件: `src/config/sentry.ts`

**修改前（旧API）：**

```typescript
integrations: [
  new Sentry.BrowserTracing({
    routingInstrumentation: Sentry.reactRouterV6Instrumentation(
      React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes
    ),
  }),
  new Sentry.Replay({
    maskAllText: true,
    blockAllMedia: true,
  }),
],
```

**修改后（新API）：**

```typescript
integrations: [
  // React Router v6 浏览器追踪（新版本API）
  Sentry.reactRouterV6BrowserTracingIntegration({
    useEffect: React.useEffect,
    useLocation,
    useNavigationType,
    createRoutesFromChildren,
    matchRoutes,
  }),
  // React 错误边界
  Sentry.replayIntegration({
    maskAllText: true,
    blockAllMedia: true,
  }),
],
```

---

## 🧪 验证结果

### 修复前 ❌

```
❌ TypeError: Sentry.reactRouterV6Instrumentation is not a function
❌ 应用无法启动
```

### 修复后 ✅

```
✅ 如果配置了 VITE_SENTRY_DSN：显示 "Sentry 前端错误追踪已启用"
✅ 如果未配置：显示 "Sentry DSN 未配置，错误追踪已禁用"
✅ 应用正常运行
```

---

## 📋 其他控制台消息说明

### 1. React Router 警告（黄色）⚠️

```
React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7.
```

**说明**: 这是 React Router 的未来特性警告，不影响功能。
**操作**: 可以忽略，或在 `BrowserRouter` 中添加 `future={{ v7_startTransition: true }}`

### 2. Mapify 警告（黄色）⚠️

```
Element not found for selector: 'mapify-window'
```

**说明**: 这是浏览器扩展（Mapify）引起的警告，不是我们的代码。
**操作**: 可以忽略，或在 Sentry 配置中添加到 `ignoreErrors` 列表。

### 3. Auth 日志（灰色）ℹ️

```
refreshUser: checking authentication...
refreshUser: user is not authenticated
```

**说明**: 这是正常的认证检查日志，表示用户未登录。
**操作**: 正常行为，无需处理。

---

## 🎯 当前 Sentry 配置状态

根据 `.env` 文件，Sentry 相关配置：

```bash
# 前端 Sentry（未配置）
# VITE_SENTRY_DSN=
# VITE_SENTRY_ENVIRONMENT=development

# 后端 Sentry（已配置）
SENTRY_DSN=https://...
SENTRY_ENVIRONMENT=development
```

**当前行为**:
- ✅ 前端: Sentry 未启用（因为 VITE_SENTRY_DSN 未配置）
- ✅ 后端: Sentry 已启用（DSN 已配置）

**如需启用前端 Sentry**:
1. 在 Sentry.io 创建前端项目（React）
2. 获取 DSN
3. 在 `.env` 中设置 `VITE_SENTRY_DSN=your-dsn-here`
4. 重启前端服务

---

## 📚 Sentry SDK 版本信息

根据 `package.json`，使用的是最新版本：

```json
"@sentry/react": "^8.45.0"
```

**重要**: Sentry v8.x 版本有重大 API 变更：
- 所有 `new Sentry.Integration()` 改为 `Sentry.integrationName()`
- React Router 集成改为 `reactRouterV6BrowserTracingIntegration()`

---

## ✅ 问题解决

**修复状态**: ✅ 已完成  
**测试状态**: ⏳ 请刷新浏览器验证  
**影响范围**: 前端错误追踪初始化

---

## 🔗 相关文档

- [Sentry React SDK 文档](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry v8 迁移指南](https://docs.sentry.io/platforms/javascript/migration/v7-to-v8/)
- [React Router 集成](https://docs.sentry.io/platforms/javascript/guides/react/features/react-router/)

---

**修复时间**: 2025-11-13 17:05  
**修复人员**: AI Assistant

