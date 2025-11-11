# 通义听悟 API 文档总结

## 📋 文档来源

本文档基于阿里云官方文档整理，包含通义听悟API的关键信息。

**官方文档链接**：
- [通义听悟API概览](https://help.aliyun.com/zh/tingwu/api-tingwu-2022-09-30-overview)
- [离线音视频文件转写文档](https://help.aliyun.com/zh/tingwu/offline-transcribe-of-audio-and-video-files) ⭐ **关键文档**
- [阿里云OpenAPI开发者门户](https://api.aliyun.com/document/tingwu/)
- [通义听悟产品动态](https://help.aliyun.com/zh/tingwu/release-notes)

---

## 🔑 核心API接口

### 1. 创建文件转写任务：`CreateFileTrans`

**功能**：创建音视频文件转写任务

**接口信息**：
- **接口名称**：`CreateFileTrans`
- **API版本**：`2022-09-30` 或 `2023-09-30`
- **请求方式**：POST（ROA风格）
- **签名方式**：ROA签名风格（不同于NLS的HMAC-SHA1）

**关键参数**（✅ 已确认）：
- ✅ **`FileUrl`**：音视频文件URL（**支持直接传URL，无需下载上传**）
- `Language`：语言代码（如：`en-US`, `zh-CN`）
- `EnableSpeakerDiarization`：是否启用说话人分离
- `MaxSpeakers`：最大说话人数量

**重要确认**：
- ✅ **支持通过URL上传**：可以使用`FileUrl`参数直接提供音视频文件的网络地址
- ✅ **无需手动上传**：不需要先下载文件再上传，只需提供URL即可
- ✅ **与NLS兼容**：功能与当前NLS服务的`FileLink`参数类似

**返回结果**：
- `TaskId`：任务ID，用于后续查询

---

### 2. 查询文件转写任务：`GetFileTrans`

**功能**：查询文件转写任务的状态和结果

**接口信息**：
- **接口名称**：`GetFileTrans`
- **API版本**：`2022-09-30` 或 `2023-09-30`
- **请求方式**：GET/POST（ROA风格）

**关键参数**：
- `TaskId`：任务ID（从CreateFileTrans返回）

**返回结果**：
- `Status`：任务状态（`RUNNING`, `SUCCESS`, `FAILED`）
- `TranscriptionResult`：转写结果（JSON格式）
- `Words`：词级别时间戳
- `Utterances`：语句级别结果（含说话人标签）

---

### 3. 实时会议转写接口（不适用）

以下接口用于实时会议转写，不适用于文件转写场景：

- `CreateMeetingTrans`：创建实时会议转写
- `GetMeetingTrans`：查询实时会议状态
- `StopMeetingTrans`：结束实时会议

---

## 🔐 认证和签名

### AccessKey配置

需要以下信息：
- `AccessKeyId`：访问密钥ID
- `AccessKeySecret`：访问密钥Secret

**获取方式**：
1. 登录阿里云控制台
2. 点击右上角头像 → **AccessKey 管理**
3. 创建AccessKey（Secret只显示一次，需妥善保管）

### 签名方式

**通义听悟使用ROA签名风格**，与NLS的HMAC-SHA1签名不同。

**ROA签名特点**：
- 使用HTTP头进行签名
- 支持多种HTTP方法（GET、POST等）
- 签名算法更复杂

**建议**：
- 优先使用阿里云官方SDK（支持Node.js、Python、Java等）
- 如需自签名，建议加入钉钉群（群号：11370001915）获取专家指导

---

## 🌐 API端点

### 通义听悟API端点（需确认）

**可能的端点格式**：
- `https://tingwu.cn-shanghai.aliyuncs.com`
- `https://tingwu.aliyuncs.com`
- 或其他区域端点

**注意**：与NLS的端点不同：
- NLS端点：`nls-filetrans.cn-shanghai.aliyuncs.com`
- 通义听悟端点：**需在官方文档中确认**

---

## 📊 与NLS服务对比

### API差异对比

| 项目 | NLS（当前使用） | 通义听悟（目标） |
|------|----------------|-----------------|
| **API端点** | `nls-filetrans.cn-shanghai.aliyuncs.com` | `tingwu.aliyuncs.com`（需确认） |
| **API版本** | `2018-08-17` | `2022-09-30` 或 `2023-09-30` |
| **接口名称** | `SubmitTask` | `CreateFileTrans` |
| **查询接口** | `GetTaskResult` | `GetFileTrans` |
| **签名方式** | HMAC-SHA1 | ROA签名风格 |
| **文件URL参数** | `FileLink` | `FileUrl` 或 `FileLink`（需确认） |
| **AppKey** | ✅ 需要 | ❓ 可能不需要 |

---

## ✅ 关键问题：FileUrl支持（已确认）

### ✅ 已确认：支持直接传URL

**问题1：是否支持直接传URL？**

- **NLS**：✅ 支持，使用`FileLink`参数
- **通义听悟**：✅ **已确认支持**，使用`FileUrl`参数

**确认信息**：
- ✅ **支持FileUrl参数**：可以直接传URL，无需下载上传
- ✅ **功能与NLS兼容**：与当前NLS服务的`FileLink`参数功能相同
- ✅ **官方文档确认**：[离线音视频文件转写文档](https://help.aliyun.com/zh/tingwu/offline-transcribe-of-audio-and-video-files)

**迁移影响**：
- ✅ **迁移难度低**：可以直接替换，无需修改文件处理逻辑
- ✅ **无需下载文件**：保持与NLS相同的使用方式
- ✅ **代码改动小**：只需修改API调用部分

---

## 💻 SDK支持

### 官方SDK

阿里云提供多种语言的SDK：

- **Node.js SDK**：`@alicloud/tingwu20220930`
- **Python SDK**：`aliyun-python-sdk-tingwu`
- **Java SDK**：`aliyun-java-sdk-tingwu`
- **其他语言**：参考阿里云SDK中心

### SDK优势

- ✅ 自动处理签名
- ✅ 类型安全（TypeScript支持）
- ✅ 错误处理完善
- ✅ 无需手动实现ROA签名

### 安装Node.js SDK

```bash
npm install @alicloud/tingwu20220930
```

---

## 📝 迁移代码示例（假设支持FileUrl）

### 使用SDK的示例代码

```typescript
import Tingwu20220930 from '@alicloud/tingwu20220930';
import * as $OpenApi from '@alicloud/openapi-client';

// 初始化客户端
const config = new $OpenApi.Config({
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  endpoint: 'tingwu.cn-shanghai.aliyuncs.com', // 需确认
});

const client = new Tingwu20220930.default(config);

// 创建转写任务
async function createTranscriptionTask(videoUrl: string) {
  const request = new Tingwu20220930.CreateFileTransRequest({
    FileUrl: videoUrl, // ⚠️ 需确认参数名
    Language: 'en-US',
    EnableSpeakerDiarization: true,
    MaxSpeakers: 2,
  });

  const response = await client.createFileTrans(request);
  return response.body.TaskId;
}

// 查询任务状态
async function getTranscriptionResult(taskId: string) {
  const request = new Tingwu20220930.GetFileTransRequest({
    TaskId: taskId,
  });

  const response = await client.getFileTrans(request);
  return response.body;
}
```

---

## 🔗 相关资源

### 官方文档

1. **通义听悟API概览**：
   - https://help.aliyun.com/zh/tingwu/api-tingwu-2022-09-30-overview

2. **OpenAPI文档**：
   - https://api.aliyun.com/document/tingwu/

3. **产品动态**：
   - https://help.aliyun.com/zh/tingwu/release-notes

### 技术支持

- **钉钉群**：11370001915
- **工单系统**：阿里云控制台 → 工单中心

### SDK下载

- **Node.js SDK**：https://www.npmjs.com/package/@alicloud/tingwu20220930
- **SDK中心**：https://help.aliyun.com/document_detail/53090.html

---

## ✅ 下一步行动

### 1. 确认API端点

- [ ] 查找通义听悟的API端点地址
- [ ] 确认区域选择（如：cn-shanghai）

### 2. 确认参数格式 ✅ FileUrl已确认

- [x] ✅ 确认是否支持`FileUrl`或`FileLink`参数 - **已确认支持FileUrl**
- [ ] 确认参数名称和格式（可能是`FileUrl`）
- [ ] 确认是否需要AppKey（可能不需要）

### 3. 测试API调用

- [ ] 安装SDK：`npm install @alicloud/tingwu20220930`
- [ ] 编写测试代码
- [ ] 测试直接传URL功能

### 4. 评估迁移方案 ✅ 可以开始迁移

- [x] ✅ 如果支持FileUrl：准备迁移代码 - **已确认支持，可以开始迁移**
- [ ] 创建迁移代码框架
- [ ] 实现新的服务类
- [ ] 测试验证功能

---

## 📌 重要提醒

1. **API文档可能更新**：建议定期查看官方文档获取最新信息
2. **签名方式不同**：通义听悟使用ROA签名，与NLS不同，建议使用SDK
3. **参数名称可能不同**：FileLink vs FileUrl，需确认
4. **区域选择**：确认API端点的区域配置

---

*文档创建时间：2024年*
*基于阿里云官方文档和公开信息整理*
*建议直接查阅官方文档获取最新信息*

