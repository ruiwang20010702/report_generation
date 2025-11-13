# 集成测试文档

## 简介

本目录包含 51Talk 英语学习分析系统的集成测试。这些测试验证系统的核心功能、安全性、性能和数据库操作。

## 测试结构

```
tests/
├── integration/
│   ├── health.test.ts      # 健康检查端点测试
│   ├── security.test.ts    # 安全功能测试
│   ├── database.test.ts    # 数据库操作测试
│   └── api.test.ts         # API 端点测试
├── setup.ts                # 测试环境设置
└── README.md               # 本文档
```

## 运行测试

### 前提条件

1. 安装依赖：
```bash
npm install
```

2. 配置测试环境变量：
```bash
cp .env.example .env.test
# 编辑 .env.test 文件，设置测试环境变量
```

3. 启动测试服务器：
```bash
# 在一个终端中启动服务器
npm run dev
```

### 运行所有测试

```bash
npm test
```

### 运行特定测试套件

```bash
# 健康检查测试
npm test -- tests/integration/health.test.ts

# 安全测试
npm test -- tests/integration/security.test.ts

# 数据库测试
npm test -- tests/integration/database.test.ts

# API 测试
npm test -- tests/integration/api.test.ts
```

### 生成覆盖率报告

```bash
npm test -- --coverage
```

覆盖率报告将生成在 `coverage/` 目录中。

## 测试覆盖范围

### 1. 健康检查测试 (`health.test.ts`)

测试内容：
- ✅ 基础健康检查端点 (`/api/health`)
- ✅ 详细健康检查端点 (`/api/health/detailed`)
- ✅ 存活探针 (`/api/health/live`)
- ✅ 就绪探针 (`/api/health/ready`)
- ✅ 性能指标端点 (`/api/metrics`)
- ✅ Prometheus 格式指标

### 2. 安全功能测试 (`security.test.ts`)

测试内容：
- ✅ 安全响应头（X-Frame-Options, CSP, etc.）
- ✅ Request ID 追踪
- ✅ 自定义 Request ID
- ✅ 请求限流
- ✅ SQL 注入防护
- ✅ XSS 防护
- ✅ CORS 配置

### 3. 数据库测试 (`database.test.ts`)

测试内容：
- ✅ 数据库连接
- ✅ 表结构验证
- ✅ 索引验证
- ✅ 数据插入和检索
- ✅ 数据清理

### 4. API 端点测试 (`api.test.ts`)

测试内容：
- ✅ 请求验证（必填字段）
- ✅ URL 格式验证
- ✅ 学生 ID 格式验证
- ✅ 报告检索和分页
- ✅ 报告筛选
- ✅ 错误处理（404, 400, etc.）
- ✅ 格式错误的 JSON 处理
- ✅ 结构化错误响应
- ✅ 内容协商

## 环境变量

测试使用以下环境变量：

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 环境模式 | `test` |
| `API_BASE_URL` | API 基础 URL | `http://localhost:3001` |
| `USE_MOCK_ANALYSIS` | 使用模拟分析 | `true` |
| `DATABASE_URL` | 数据库连接 URL | （必需） |

## 测试最佳实践

### 1. 独立性
每个测试应该是独立的，不依赖其他测试的执行顺序或结果。

### 2. 清理
在测试后清理创建的测试数据，避免影响其他测试。

### 3. 使用 Mock
对于外部服务（OpenAI, 阿里云等），使用 Mock 数据以避免：
- 实际 API 调用产生费用
- 测试依赖外部服务可用性
- 测试执行时间过长

### 4. 断言明确
使用清晰、具体的断言，明确测试的预期结果。

### 5. 错误处理
测试不仅要验证成功路径，也要测试错误情况和边界条件。

## CI/CD 集成

### GitHub Actions

在 `.github/workflows/test.yml` 中添加测试步骤：

```yaml
name: Run Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/testdb
          USE_MOCK_ANALYSIS: true
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## 常见问题

### Q1: 测试超时怎么办？

增加测试超时时间：
```javascript
jest.setTimeout(60000); // 60秒
```

或在特定测试中：
```javascript
it('long running test', async () => {
  // ...
}, 60000);
```

### Q2: 数据库连接失败？

确保：
1. ✅ 数据库服务正在运行
2. ✅ `DATABASE_URL` 环境变量正确配置
3. ✅ 数据库用户有足够的权限
4. ✅ 数据库表已创建（运行迁移脚本）

### Q3: 端口冲突？

更改测试服务器端口：
```bash
PORT=3002 npm test
```

或在 `.env.test` 中设置：
```
PORT=3002
API_BASE_URL=http://localhost:3002
```

## 未来改进

- [ ] 添加端到端（E2E）测试
- [ ] 添加性能测试（压力测试）
- [ ] 添加前端组件测试
- [ ] 集成代码覆盖率工具
- [ ] 添加视觉回归测试
- [ ] 自动化测试数据生成

## 参考资源

- [Jest 文档](https://jestjs.io/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Node.js Testing Guide](https://nodejs.org/en/docs/guides/testing/)

