# 提示词适配总结

## 📋 任务概述

将两个新的英语教学分析提示词适配到现有的1对1师生对话视频分析系统中。

---

## ✅ 完成的修改

### 1. **扩展 TranscriptionResult 类型（支持说话人识别）**

**文件修改：**
- `server/services/assemblyAIService.ts`
- `server/services/whisperService.ts`

**新增字段：**
```typescript
interface TranscriptionResult {
  text: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: string;  // ✨ 新增：说话人标识
  }>;
  utterances?: Array<{  // ✨ 新增：按说话人分段的对话
    text: string;
    start: number;
    end: number;
    speaker: string;
  }>;
  duration?: number;
  language?: string;
}
```

**作用：** 支持区分老师和学生的发言，便于GPT进行精准分析。

---

### 2. **启用 AssemblyAI 说话人识别功能**

**文件修改：**
- `server/services/videoAnalysisService.ts` (第155-158行)

**修改内容：**
```typescript
const result = await assemblyAIService.transcribeFromURL(videoUrl, {
  language: 'en',
  speakerLabels: true  // ✨ 启用说话人识别
});
```

**作用：** 
- 自动识别对话中的不同说话人（Speaker A, Speaker B）
- 为每段对话打上说话人标签
- 提高分析准确性（区分师生发言）

---

### 3. **扩展 VideoAnalysisRequest 类型（支持时间字段）**

**文件修改：**
- `server/types/index.ts`

**新增字段：**
```typescript
export interface VideoAnalysisRequest {
  video1: string;
  video2: string;
  video1Time?: string;  // ✨ 新增：第一个视频的上课时间
  video2Time?: string;  // ✨ 新增：第二个视频的上课时间
  studentName: string;
  grade: string;
  level: string;
  unit: string;
  apiKey?: string;
  useMockData?: boolean;
}
```

**字段映射（路由层）：**
```typescript
// server/routes/analysis.ts
const requestData: VideoAnalysisRequest = {
  ...rawData,
  video1Time: rawData.video1Time || rawData.date,  // 兼容前端的 date 字段
  video2Time: rawData.video2Time || rawData.date2  // 兼容前端的 date2 字段
};
```

**作用：** 在分析报告中显示两次课堂的具体时间。

---

### 4. **重写提示词1（单视频分析）**

**文件修改：**
- `server/services/videoAnalysisService.ts` (analyzeTranscriptionWithGPT 方法)

**核心改进：**

#### 4.1 增加说话人对话记录
```typescript
if (transcription.utterances && transcription.utterances.length > 0) {
  speakerInfo = '\n【说话人对话记录】\n';
  transcription.utterances.forEach((utterance, index) => {
    speakerInfo += `[${utterance.speaker}] ${utterance.text}\n`;
  });
}
```

#### 4.2 新增分析维度
- **量化指标分析：**
  - 主动回答次数（不包括简单的"Yes/No"或跟读）
  - 平均回答长度（词数）
  - 完整句输出次数（有主谓宾结构）
  - 语言准确率（百分比）
  - 参与度（学生发言占比）

- **能力维度分析：**
  - 口语流利度（语速、停顿、连贯性）
  - 词汇运用（词汇量、分类、复杂度）
  - 语法和句型（句型复杂度统计）
  - 自信心和互动（主动性评估）

#### 4.3 新增输出字段
```json
{
  "wordCount": 学生发言的总词数,
  "sentenceCount": 学生发言的句子数,
  "fluency": "融入量化数据和具体案例的详细分析（至少80词）",
  "vocabulary": "融入统计数据的详细分析（至少60词）",
  "grammar": "融入句型统计的详细分析（至少60词）",
  "participation": "融入量化指标的详细分析（至少80词）",
  "strengths": ["具体且有数据支持的优点"],
  "weaknesses": ["具体且有案例的待改进点"],
  "dialogueExamples": [  // ✨ 新增：对话案例
    {
      "teacher": "老师的问题或引导",
      "student": "学生的回答",
      "analysis": "这段对话体现的能力或问题"
    }
  ]
}
```

---

### 5. **重写提示词2（对比分析）** ⭐ 核心修改

**文件修改：**
- `server/services/videoAnalysisService.ts` (compareVideos 方法)

**核心改进：**

#### 5.1 4项关键提升率
融入到 `learningData` 字段中：

| 指标 | 字段名 | 分析内容 |
|------|--------|---------|
| 主动回答次数提升率 | `handRaising` | 学习积极性和课堂参与意愿 |
| 平均回答长度提升率 | `answerLength` | 表达能力和语言组织能力 |
| 完整句输出提升率 | `completeSentences` | 语法结构和句子完整性 |
| 语言准确率变化 | `readingAccuracy` | 发音、语法、词汇使用精准度 |

每个指标包含：
- `trend`: "提升/下降/持平"
- `percentage`: 提升率（如 "+30%"，基于实际数据计算）
- `analysis`: 详细分析（融入具体数据、原文案例对比、专业解读），至少100-150词

#### 5.2 4大维度深度进步分析
融入到 `progressDimensions` 字段中：

| 维度 | 字段名 | 分析内容 |
|------|--------|---------|
| 口语流利度 | `fluency` | 语速、停顿、连贯性变化 |
| 自信心与互动 | `confidence` | 主动发言、声音大小、表达犹豫 |
| 语言主动应用能力 | `languageApplication` | 词汇灵活性、新词运用、语法多样性 |
| 句子复杂度及组织能力 | `sentenceComplexity` | 句型结构、从句使用、逻辑表达 |

每个维度包含：
- `analysis`: 深度分析（至少150词），包含：
  1. 具体数据对比
  2. 能力变化分析
  3. 专业解读
  
- `example`: 两次课堂的原文对话对比案例（至少2组），格式：
  ```
  【早期课堂】
  老师：...
  学生：...
  
  【最近课堂】
  老师：...
  学生：...
  
  【对比分析】
  ...
  ```

#### 5.3 基于阈值的建议触发机制
融入到 `improvementAreas.*.suggestions` 字段中：

| 规则 | 触发条件 | 建议内容 |
|------|----------|---------|
| 规则1 | 参与度 ≤ 60% | 家长伴学：角色互换法 |
| 规则2 | 准确率下降 ≥ 10% | 提高准确率：三步审题法 |
| 规则3 | 主动回答次数 < 5次/课堂 | 提升主动性：互动激励法 |
| 规则4 | 平均回答长度 < 5词 | 培养完整表达：扩展句子练习 |
| 规则5 | 完整句输出 < 50% | 提升句子完整性：3-2-1结构练习 |

每条建议包含：
- `title`: 建议标题
- `description`/`point`: 详细方法（至少50词）

#### 5.4 原文对话对比
- 提取两次课堂的对话记录（最多30条）
- 在每个分析维度的 `example` 字段中展示对比案例
- 确保案例来自实际转录文本

---

## 🔄 架构变化

### 数据流程

```
前端表单
  ↓
  date, date2 (时间字段)
  ↓
路由层 (analysis.ts)
  ↓
  字段映射: date → video1Time, date2 → video2Time
  ↓
VideoAnalysisService
  ↓
  ┌─────────────────────────────────┐
  │  1. 转录视频（启用说话人识别）     │
  │     - AssemblyAI (speaker_labels) │
  │     - Whisper (降级方案)           │
  └─────────────────────────────────┘
  ↓
  ┌─────────────────────────────────┐
  │  2. 单视频分析（提示词1）         │
  │     - 分析说话人对话              │
  │     - 提取量化指标                │
  │     - 生成对话案例                │
  └─────────────────────────────────┘
  ↓
  ┌─────────────────────────────────┐
  │  3. 对比分析（提示词2）           │
  │     - 计算4项提升率               │
  │     - 分析4大维度进步             │
  │     - 提取原文对话对比            │
  │     - 触发阈值建议                │
  └─────────────────────────────────┘
  ↓
返回JSON报告给前端
```

---

## 📊 JSON输出结构（保持不变）

现有的 `VideoAnalysisResponse` 结构保持不变，但内容更加丰富：

```typescript
{
  "learningData": {
    "handRaising": {
      "trend": "提升",
      "percentage": "+30%",  // ✨ 基于实际数据计算
      "analysis": "...（融入具体案例和专业解读，150词）"
    },
    // ... 其他3项
  },
  "progressDimensions": {
    "fluency": {
      "analysis": "...（深度分析，150词）",
      "example": "【早期课堂】... 【最近课堂】... 【对比分析】..."  // ✨ 原文对话对比
    },
    // ... 其他3个维度
  },
  "improvementAreas": {
    "pronunciation": {
      "overview": "...",
      "details": "...",
      "examples": [...],
      "suggestions": [  // ✨ 包含基于阈值触发的建议
        {
          "title": "家长伴学：角色互换法",
          "description": "...（详细方法，50词）"
        }
      ]
    },
    // ... grammar, intonation
  }
}
```

---

## 🎯 关键特性

### ✅ 保持的内容
- JSON字段名完全不变（`learningData`, `progressDimensions`, `improvementAreas`）
- 前端代码无需修改（兼容现有UI组件）
- 响应格式与类型定义一致

### ✨ 新增的内容
- **说话人识别**：自动区分师生对话
- **量化指标**：主动回答次数、平均回答长度、完整句输出、语言准确率
- **原文对话对比**：两次课堂的实际对话案例
- **深度分析**：每个字段的内容更详实（100-150词）
- **阈值建议**：基于数据自动触发学习建议
- **时间信息**：显示两次课堂的上课时间

### 🚫 移除的内容
- 所有HTML/CSS/SVG相关描述
- 图表库（Chart.js/ECharts）
- 页面设计和排版
- 装饰性元素

---

## 🧪 测试检查项

### 后端
- [x] 类型定义无错误
- [x] Linter检查通过
- [x] 说话人识别功能启用
- [x] 字段映射正确（date → video1Time）
- [x] 提示词1内容完整
- [x] 提示词2内容完整

### 前端（无需修改）
- [x] 现有表单字段兼容（date, date2）
- [x] API接口类型匹配
- [x] 响应数据结构不变

---

## 📝 使用说明

### 1. 前端提交数据格式（无变化）
```typescript
{
  video1: "视频1链接",
  video2: "视频2链接",
  studentName: "张小明",
  grade: "小学三年级",
  level: "Level 3",
  unit: "Unit 5",
  date: "2024-01-15",      // 会自动映射为 video1Time
  date2: "2024-01-22",     // 会自动映射为 video2Time
  useMockData: false,
  apiKey: "sk-..."
}
```

### 2. 后端返回数据示例
```json
{
  "studentName": "张小明",
  "learningData": {
    "handRaising": {
      "trend": "提升",
      "percentage": "+30%",
      "analysis": "从早期课堂的5次主动回答提升到最近课堂的8次，提升率为60%。【早期课堂案例】老师问'What's this?'，学生犹豫后才举手回答。【最近课堂案例】老师刚提问'Can you tell me...'，学生就主动举手并积极回答'Yes, it's...'。这表明学生的课堂参与意愿显著增强，学习态度更加积极主动，对自己的英语表达能力更有信心。这种积极性的提升对语言学习至关重要，因为主动参与能创造更多练习机会，加速语言习得过程。"
    },
    // ...
  },
  "progressDimensions": {
    "fluency": {
      "analysis": "学生的口语流利度有显著提升。早期课堂中，学生回答时平均停顿3-4次，每次停顿约2-3秒，说话速度较慢（约50词/分钟）。最近课堂中，停顿减少到1-2次，停顿时长缩短至1秒以内，语速提升到约70词/分钟。连贯性方面，学生开始能够不间断地说出5-6个词的短语，而早期只能说出2-3个词就需要停顿思考。流利度的提升表明学生的语言自动化程度提高，大脑对英语的处理速度加快，这是语言能力进步的重要标志...",
      "example": "【早期课堂】\n老师：What did you do yesterday?\n学生：I... (停顿2秒) ...I go... (停顿3秒) ...to park.\n\n【最近课堂】\n老师：What did you do yesterday?\n学生：I went to the park (停顿1秒) and played with my friends.\n\n【对比分析】早期课堂中学生回答时有明显的长时间停顿，且使用错误时态'go'而非'went'，句子结构简单。最近课堂中，学生能够流畅地说出完整句子，正确使用过去时态，并用'and'连接两个动作，展现出更好的语言组织能力和流利度。"
    }
    // ...
  },
  "improvementAreas": {
    "pronunciation": {
      "overview": "...",
      "suggestions": [
        {
          "title": "家长伴学：角色互换法",
          "description": "建议在家庭作业辅导时，让孩子用3-5分钟讲解今天课堂学的内容，家长扮演学生角色，仅提2个澄清问题。这种方法的目的是提高孩子的表达能力、逻辑思维和知识掌握度。提问策略：围绕孩子讲解的内容提出'为什么'或'怎么做'类型的问题，避免批评性问题。例如，孩子讲解了一个语法点，家长可以问'为什么这里要用过去时态？''你能再举一个类似的例子吗？'通过这种方式，孩子需要组织语言、清晰表达、回应疑问，这是提升语言能力的绝佳练习。"
        }
      ]
    }
  }
}
```

---

## 🚀 部署建议

### 环境变量
确保设置以下环境变量：
```bash
# OpenAI API Key（用于GPT-4分析）
OPENAI_API_KEY=sk-...

# AssemblyAI API Key（用于免费转录+说话人识别）
ASSEMBLYAI_API_KEY=...

# 可选：代理设置
HTTPS_PROXY=http://proxy.example.com:8080

# 可选：Mock模式
USE_MOCK_ANALYSIS=false
```

### 成本优化
- ✅ **优先使用 AssemblyAI**（免费5小时/月，支持说话人识别）
- 🔄 **降级到 Whisper**（付费但便宜，$0.006/分钟）
- 💡 **说话人识别成本**：AssemblyAI免费提供，Whisper不支持

---

## 📌 注意事项

### 1. 说话人识别的局限性
- **AssemblyAI** 会自动识别说话人（Speaker A, Speaker B），但不会自动标记谁是老师、谁是学生
- **解决方案**：GPT会根据对话内容推测（老师通常提问、引导、纠错；学生通常回答、跟读）
- **准确性**：在1对1教学场景中，说话人识别准确率通常 >90%

### 2. 量化指标的推测性
- 由于转录文本的局限性，某些指标（如"注意力"、"主动举手"）需要GPT基于语义推测
- **建议**：在分析结果中加入"推测"或"根据对话内容判断"等措辞，保持专业性

### 3. Prompt长度
- 新的提示词2非常长（约3000 tokens）
- **影响**：可能增加API调用成本和响应时间
- **优化**：已对转录文本进行截断（最多2000字符），保留最重要的对话内容

### 4. 前后端兼容性
- 通过路由层字段映射，保证前后端字段名不同但能正常工作
- 前端可以继续使用 `date`/`date2`，后端内部使用 `video1Time`/`video2Time`

---

## 🎉 完成情况

| 任务 | 状态 |
|------|------|
| 扩展 TranscriptionResult 类型 | ✅ |
| 启用说话人识别 | ✅ |
| 扩展 VideoAnalysisRequest 类型 | ✅ |
| 修改提示词1（单视频分析） | ✅ |
| 修改提示词2（对比分析） | ✅ |
| 字段映射（date → video1Time） | ✅ |
| Linter检查 | ✅ |
| 文档编写 | ✅ |

---

## 📧 技术支持

如有问题，请检查：
1. 环境变量是否正确设置
2. AssemblyAI API Key 是否有效（免费额度是否用完）
3. 视频链接是否可访问（公开URL）
4. 查看服务器日志中的详细错误信息

---

**适配完成时间：** 2024年（根据实际日期调整）  
**适配版本：** v2.0  
**兼容性：** 完全向后兼容，前端无需修改

