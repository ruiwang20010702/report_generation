import OpenAI from 'openai';
import axios from 'axios';
import { VideoAnalysisRequest, VideoAnalysisResponse } from '../types/index.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { WhisperService, TranscriptionResult } from './whisperService.js';
import { assemblyAIService } from './assemblyAIService.js';

export class VideoAnalysisService {
  private defaultOpenai: OpenAI | null;
  private defaultUseMock: boolean;
  private whisperService: WhisperService;

  constructor() {
    this.whisperService = new WhisperService();
    const apiKey = process.env.OPENAI_API_KEY;
    this.defaultUseMock = process.env.USE_MOCK_ANALYSIS === 'true' || !apiKey;
    
    if (this.defaultUseMock) {
      console.log('⚠️  Default mode: MOCK - using simulated data');
      console.log('💡 Users can provide their own API Key in the form for real AI analysis');
      this.defaultOpenai = null;
    } else {
      console.log('✅ Default mode: REAL - using server OpenAI API');
      
      // 支持代理配置
      const config: any = { apiKey: apiKey! };
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      if (proxyUrl) {
        console.log('🌐 Using proxy:', proxyUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
        config.httpAgent = new HttpsProxyAgent(proxyUrl);
      }
      
      this.defaultOpenai = new OpenAI(config);
    }
  }

  /**
   * 创建 OpenAI 客户端（支持动态 API Key 和代理）
   */
  private getOpenAIClient(apiKey?: string): OpenAI | null {
    if (apiKey) {
      console.log('🔑 Using user-provided API Key');
      
      // 支持代理配置
      const config: any = { apiKey };
      
      // 从环境变量读取代理设置
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      if (proxyUrl) {
        console.log('🌐 Using proxy:', proxyUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // 隐藏密码
        config.httpAgent = new HttpsProxyAgent(proxyUrl);
      }
      
      return new OpenAI(config);
    }
    return this.defaultOpenai;
  }

  /**
   * 使用 GPT-4 分析转录文本
   */
  private async analyzeTranscriptionWithGPT(
    transcription: TranscriptionResult,
    openai: OpenAI,
    videoLabel: string = 'video'
  ): Promise<string> {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    try {
      // 分析转录文本的基本特征
      const textAnalysis = this.whisperService.analyzeTranscription(transcription.text);
      
      // 构建说话人信息（如果有）
      let speakerInfo = '';
      if (transcription.utterances && transcription.utterances.length > 0) {
        speakerInfo = '\n【说话人对话记录】\n';
        transcription.utterances.forEach((utterance, index) => {
          speakerInfo += `[${utterance.speaker}] ${utterance.text}\n`;
        });
        speakerInfo += '\n注意：请根据对话内容判断哪位是老师（Teacher），哪位是学生（Student）。通常老师会提问、引导、纠错，学生会回答、跟读。';
      } else {
        speakerInfo = '\n【说明】转录文本中未包含说话人识别信息，请根据语义推测师生对话内容。';
      }
      
      // 使用 GPT-4 进行深度分析
      console.log(`🤖 Analyzing ${videoLabel} content with GPT-4...`);
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `你是一位专业的英语教学专家，擅长分析1对1教学场景中学生的英语学习表现。
你会收到一段英语学习课堂的语音转录文本（包含老师和学生的对话），请详细分析学生的英语能力和表现。
重点分析：学生的发言内容、主动性、语言能力等，而非老师的教学内容。`
          },
          {
            role: "user",
            content: `请分析以下英语学习课堂的转录文本：

【完整转录文本】
${transcription.text}
${speakerInfo}

【基本统计】
- 总词数: ${textAnalysis.wordCount}
- 句子数: ${textAnalysis.sentenceCount}
- 平均每句词数: ${textAnalysis.averageWordsPerSentence.toFixed(1)}
- 独特词汇数: ${textAnalysis.uniqueWords}
- 视频时长: ${transcription.duration ? `${Math.round(transcription.duration)}秒` : '未知'}

请从以下方面进行详细分析（重点关注学生的表现）：

**1. 量化指标分析**
- 主动回答次数：学生主动回答问题或发言的次数（不包括简单的"Yes/No"或跟读）
- 平均回答长度：学生每次回答的平均词数
- 完整句输出次数：学生说出完整句子（有主谓宾结构）的次数
- 语言准确率：根据转录文本推测学生的发音、语法准确程度（百分比）
- 参与度：学生发言占总对话的比例，以及主动性评估

**2. 能力维度分析**
- 口语流利度：包括语速、停顿、连贯性，以及是否有明显的卡顿或思考时间
- 词汇运用：学生使用的词汇种类、数量、复杂度，是否能灵活运用新词汇
- 语法和句型：句子结构的复杂度，是否使用复合句、从句等
- 自信心和互动：学生的表达是否自信，是否主动参与，声音是否清晰

**3. 典型对话案例**
- 请提取2-3段最能体现学生能力的对话片段（包含老师问题+学生回答）

请以JSON格式返回分析结果（保持现有字段名，在内容中融入上述分析）：
{
  "wordCount": 学生发言的总词数（数字）,
  "sentenceCount": 学生发言的句子数（数字）,
  "fluency": "口语流利度的详细分析（融入量化数据和具体案例），包括：1) 流利度评分或描述；2) 语速和停顿情况；3) 连贯性分析；4) 具体进步表现（如果有）。至少80词。",
  "vocabulary": "词汇运用能力的详细分析（融入统计数据），包括：1) 词汇量评估；2) 词汇分类统计（基础词/进阶词）；3) 词汇运用灵活性；4) 新词汇掌握情况。至少60词。",
  "grammar": "语法和句型的详细分析（融入句型统计），包括：1) 语法准确率；2) 句型复杂度统计；3) 常见语法问题；4) 句子组织能力。至少60词。",
  "participation": "参与度和互动性的详细分析（融入量化指标），包括：1) 主动回答次数（具体数字）；2) 平均回答长度（词数）；3) 完整句输出次数；4) 语言准确率（百分比）；5) 参与度评估（学生发言占比）。至少80词。",
  "strengths": ["优点1（具体且有数据支持）", "优点2", "优点3"],
  "weaknesses": ["待改进1（具体且有案例）", "待改进2"],
  "dialogueExamples": [
    {
      "teacher": "老师的问题或引导",
      "student": "学生的回答",
      "analysis": "这段对话体现了什么能力或问题"
    }
  ]
}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 3000
      });

      const analysisText = response.choices[0]?.message?.content || '{}';
      console.log(`✅ GPT analysis complete for ${videoLabel}`);
      
      return analysisText;
    } catch (error) {
      console.error(`❌ Error analyzing ${videoLabel}:`, error);
      throw new Error(`Failed to analyze transcription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 🚀 智能转录：优先使用 AssemblyAI（免费），降级到 Whisper（付费）
   * 
   * 策略：
   * 1. 优先使用 AssemblyAI（免费5小时/月，直接传URL，无需下载）
   * 2. 如果 AssemblyAI 不可用或超额 → 降级到 Whisper（付费但便宜）
   * 3. 自动追踪使用量，透明化成本
   */
  private async transcribeVideoSmart(
    videoUrl: string,
    videoLabel: string = 'video'
  ): Promise<TranscriptionResult> {
    try {
      // 🎯 策略1：优先尝试 AssemblyAI（免费）
      if (assemblyAIService.isAvailable()) {
        console.log(`🎯 [${videoLabel}] 使用 AssemblyAI（免费服务）`);
        console.log(`💰 当前剩余免费额度: ${assemblyAIService.getStats().remainingMinutes} 分钟`);
        
        try {
          const result = await assemblyAIService.transcribeFromURL(videoUrl, {
            language: 'en',
            speakerLabels: true
          });
          
          console.log(`✅ [${videoLabel}] AssemblyAI 转录成功！`);
          console.log(`💰 更新后剩余额度: ${assemblyAIService.getStats().remainingMinutes} 分钟`);
          
          return result;
        } catch (error: any) {
          console.warn(`⚠️  [${videoLabel}] AssemblyAI 转录失败，降级到 Whisper:`, error.message);
          // 继续执行降级策略
        }
      } else {
        console.log(`ℹ️  [${videoLabel}] AssemblyAI 不可用（${
          !assemblyAIService.hasRemainingQuota() ? '免费额度已用完' : '未配置 API Key'
        }），使用 Whisper`);
      }

      // 🔄 策略2：降级到 Whisper（需要 OpenAI）
      console.log(`🎙️ [${videoLabel}] 使用 OpenAI Whisper（付费服务）`);
      
      // 注意：这里需要 OpenAI 客户端，我们在调用处传入
      throw new Error('FALLBACK_TO_WHISPER');
      
    } catch (error) {
      // 如果是降级标记，抛出让调用方处理
      if (error instanceof Error && error.message === 'FALLBACK_TO_WHISPER') {
        throw error;
      }
      
      console.error(`❌ [${videoLabel}] 转录失败:`, error);
      throw error;
    }
  }

  /**
   * 使用 Whisper API 转录视频，然后用 GPT-4 分析内容
   * @deprecated 此方法已被超级并行版本替代，保留用于向后兼容
   */
  private async analyzeVideoContent(
    videoUrl: string, 
    openai: OpenAI,
    videoLabel: string = 'video'
  ): Promise<{ transcription: TranscriptionResult; analysis: string }> {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    try {
      // 1. 使用 Whisper API 转录视频
      console.log(`🎙️ Transcribing ${videoLabel}...`);
      const transcription = await this.whisperService.transcribeVideo(videoUrl, openai);
      console.log(`✅ Transcription complete for ${videoLabel}:`, transcription.text.substring(0, 100) + '...');

      // 2. 使用 GPT-4 进行分析
      const analysis = await this.analyzeTranscriptionWithGPT(transcription, openai, videoLabel);
      
      return {
        transcription,
        analysis
      };
    } catch (error) {
      console.error(`❌ Error analyzing ${videoLabel}:`, error);
      throw new Error(`Failed to analyze video content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 比较两个视频，生成进步分析
   */
  private async compareVideos(
    video1Result: { transcription: TranscriptionResult; analysis: string },
    video2Result: { transcription: TranscriptionResult; analysis: string },
    studentInfo: { studentName: string; grade: string; level: string; unit: string; video1Time?: string; video2Time?: string },
    openai: OpenAI
  ): Promise<VideoAnalysisResponse> {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    try {
      const video1Analysis = JSON.parse(video1Result.analysis);
      const video2Analysis = JSON.parse(video2Result.analysis);
      
      // 构建说话人对话信息
      let video1Dialogues = '';
      let video2Dialogues = '';
      
      if (video1Result.transcription.utterances && video1Result.transcription.utterances.length > 0) {
        video1Dialogues = '\n【早期课堂对话记录】\n';
        video1Result.transcription.utterances.slice(0, 30).forEach(utterance => {
          video1Dialogues += `[${utterance.speaker}] ${utterance.text}\n`;
        });
      }
      
      if (video2Result.transcription.utterances && video2Result.transcription.utterances.length > 0) {
        video2Dialogues = '\n【最近课堂对话记录】\n';
        video2Result.transcription.utterances.slice(0, 30).forEach(utterance => {
          video2Dialogues += `[${utterance.speaker}] ${utterance.text}\n`;
        });
      }

      const prompt = `你是一位在英语教学分析领域经验丰富的专家，专注于1对1教学场景的学生进步分析。

你将收到同一位学生在两个不同时间点的英语课堂数据，你的任务是：
1. 深度对比两次课堂的数据，量化学生的进步
2. 从多个维度分析学生的能力提升
3. 提取两次课堂的原文对话进行案例对比
4. 基于数据变化，触发相应的学习建议

**学生信息**
- 姓名：${studentInfo.studentName}
- 年级：${studentInfo.grade}
- 级别：${studentInfo.level}
- 单元：${studentInfo.unit}
${studentInfo.video1Time ? `- 早期上课时间：${studentInfo.video1Time}` : ''}
${studentInfo.video2Time ? `- 最近上课时间：${studentInfo.video2Time}` : ''}

**【早期课堂数据】**

转录文本：
${video1Result.transcription.text.substring(0, 2000)}${video1Result.transcription.text.length > 2000 ? '...(已截断)' : ''}
${video1Dialogues}

分析结果：
${JSON.stringify(video1Analysis, null, 2)}

**【最近课堂数据】**

转录文本：
${video2Result.transcription.text.substring(0, 2000)}${video2Result.transcription.text.length > 2000 ? '...(已截断)' : ''}
${video2Dialogues}

分析结果：
${JSON.stringify(video2Analysis, null, 2)}

---

**请按照以下要求进行深度对比分析：**

**一、4项关键提升率**（基于两次课堂的量化数据对比）

1. **主动回答次数提升率**：
   - 计算：（最近课堂主动回答次数 - 早期课堂主动回答次数）/ 早期课堂主动回答次数 × 100%
   - 分析：提升率反映了学生的学习积极性和课堂参与意愿的变化
   - 案例：提取两次课堂中最能体现主动性的对话片段进行对比

2. **平均回答长度提升率**：
   - 计算：（最近课堂平均回答词数 - 早期课堂平均回答词数）/ 早期课堂平均回答词数 × 100%
   - 分析：提升率体现学生表达能力和语言组织能力的发展
   - 案例：对比两次课堂中相似问题的回答长度

3. **完整句输出提升率**：
   - 计算：（最近课堂完整句次数 - 早期课堂完整句次数）/ 早期课堂完整句次数 × 100%
   - 分析：提升率反映学生语法结构和句子完整性的进步
   - 案例：提取两次课堂的典型句子进行对比

4. **语言准确率变化**：
   - 计算：最近课堂准确率 - 早期课堂准确率
   - 分析：准确率变化反映学生发音、语法、词汇使用的精准度
   - 案例：对比两次课堂中的错误类型和频率

**二、4大维度深度进步分析**

每个维度需要包含：
1. 详细的能力变化分析（至少100词）
2. 两次课堂的原文对话案例对比（只需1组最具代表性的案例）
3. 专业解读：这种进步在英语学习中的意义

**维度1：口语流利度**
- 对比：语速、停顿频率、连贯性、卡顿情况
- 原文案例：提取两次课堂中学生最流畅的一段表达进行对比
- 专业解读：流利度提升对整体英语能力的影响

**维度2：自信心与互动**
- 对比：主动发言次数、声音大小、表达犹豫程度、眼神交流（如果有）
- 原文案例：提取两次课堂中学生主动发起或回应的对话，必须使用【早期课堂】【最近课堂】【对比分析】的换行格式
- 专业解读：自信心对语言学习的促进作用

**维度3：语言主动应用能力**
- 对比：词汇使用的灵活性、新词运用、语法结构的多样性
- 原文案例：对比两次课堂中学生使用复杂词汇或句式的片段，必须使用【早期课堂】【最近课堂】【对比分析】的换行格式
- 专业解读：主动应用能力体现的语言内化程度

**维度4：句子复杂度及组织能力**
- 对比：句型结构、从句使用、连接词、逻辑表达
- 原文案例：提取两次课堂中学生说出的最复杂句子进行对比，必须使用【早期课堂】【最近课堂】【对比分析】的换行格式
- 专业解读：句子复杂度对语言表达能力的提升意义

**三、基于阈值的建议触发机制**

请根据以下规则，智能触发相应的学习建议：

**规则1：参与度评估**
- 如果最近课堂参与度 ≤ 60%，触发"角色互换"建议：
  - 标题："家长伴学：角色互换法"
  - 内容：建议孩子用3-5分钟讲解今天学的内容，家长仅提2个澄清问题。目的是提高表达、逻辑、掌握度。具体场景：家庭作业辅导时；提问策略：围绕孩子讲解内容提出关键问题。

**规则2：语言准确率评估**
- 如果准确率下降 ≥ 10%，触发"三步审题法"建议：
  - 标题："提高准确率：三步审题法"
  - 内容：圈条件 → 画关系 → 估答案，提交前自检2个高风险点。详细步骤、风险点识别方法、质量提升意义。

**规则3：主动回答次数评估**
- 如果主动回答次数 < 5次/课堂，触发"互动激励"建议：
  - 标题："提升主动性：互动激励法"
  - 内容：设置课前小目标（如主动回答3次），完成后给予奖励。建议具体且可执行。

**规则4：平均回答长度评估**
- 如果平均回答长度 < 5词，触发"完整表达"建议：
  - 标题："培养完整表达：扩展句子练习"
  - 内容：鼓励学生用完整句子回答，而非单词或短语。提供具体练习方法。

**规则5：句子复杂度评估**
- 如果完整句输出次数 < 总发言次数的50%，触发"句型练习"建议：
  - 标题："提升句子完整性：3-2-1结构练习"
  - 内容：3题例仿 → 2题同结构变式 → 1题迁移。详细选题方案和练习方法。

---

**请以JSON格式返回分析报告**（保持现有字段名，在analysis和example字段中融入以上所有分析）：

{
  "learningData": {
    "handRaising": {
      "trend": "提升/下降/持平",
      "percentage": "提升率（如 +30%，必须基于实际数据计算）",
      "analysis": "详细分析（融入具体数据、原文案例对比、专业解读），至少150词"
    },
    "answerLength": {
      "trend": "提升/下降/持平",
      "percentage": "提升率（必须基于实际数据）",
      "analysis": "详细分析（融入对比案例），至少120词"
    },
    "completeSentences": {
      "trend": "提升/下降/持平",
      "percentage": "提升率（必须基于实际数据）",
      "analysis": "详细分析（融入句子案例对比），至少120词"
    },
    "readingAccuracy": {
      "trend": "提升/下降/持平",
      "percentage": "变化值（如 +8%或92%→95%）",
      "analysis": "详细分析（融入错误类型对比），至少100词"
    }
  },
  "progressDimensions": {
    "fluency": {
      "analysis": "口语流利度的深度分析，包括：1) 具体数据对比；2) 语速、停顿、连贯性变化；3) 专业解读。至少150词。",
      "example": "两次课堂的原文对话对比案例，必须严格按照以下格式排版（每个部分单独成段，使用换行符分隔）：\n\n💡 示例：\n\n【早期课堂】老师：'You can say how are you.' 学生：'How are you?'\n\n【最近课堂】老师：'Are you ready with our lesson for today?' 学生：'Yes, I'm ready.'\n\n【对比分析】小明在最近课堂中表现出更少的犹豫，显示出语速和流利度的提高。\n\n请只提供1组最具代表性的对比案例，必须包含【早期课堂】【最近课堂】【对比分析】三个部分，且每部分单独成段。"
    },
    "confidence": {
      "analysis": "自信心与互动的深度分析（融入量化数据），至少150词。",
      "example": "两次课堂的互动案例对比，格式与fluency相同（必须包含【早期课堂】【最近课堂】【对比分析】三个单独段落）"
    },
    "languageApplication": {
      "analysis": "语言主动应用能力的深度分析（融入词汇和语法对比），至少150词。",
      "example": "两次课堂的语言应用案例对比，格式与fluency相同（必须包含【早期课堂】【最近课堂】【对比分析】三个单独段落）"
    },
    "sentenceComplexity": {
      "analysis": "句子复杂度及组织能力的深度分析（融入句型统计），至少150词。",
      "example": "两次课堂的句子复杂度案例对比，格式与fluency相同（必须包含【早期课堂】【最近课堂】【对比分析】三个单独段落）"
    }
  },
  "improvementAreas": {
    "pronunciation": {
      "overview": "发音方面的整体评估和趋势总结（基于两次课堂对比）。这是一个完整的段落概述，需要包含：1) 学生发音的总体水平评价；2) 两次课堂的主要变化趋势（进步/持平/退步）；3) 主要存在的问题类型；4) 未来改进的方向和前景。字数要求：至少100词，确保内容完整、逻辑清晰。",
      "details": "详细的发音问题深度分析。这部分要在overview的基础上进一步展开，包含：1) 具体分析两次课堂中发音问题的类型、频率和严重程度；2) 对比早期课堂和最近课堂的发音表现差异；3) 分析发音问题对整体表达流利度的影响；4) 提供具体的观察细节和案例背景。字数要求：至少150词，内容要比overview更加深入和具体。",
      "examples": [
        {
          "word": "具体单词1（如：nine）",
          "incorrect": "学生实际发出的错误发音（用IPA音标表示，如：/naɪn/ 错发成 /nɪn/ 或 /naɪŋ/）",
          "correct": "该单词的标准正确发音（用IPA音标表示，如：/naɪn/）",
          "type": "问题类型（如：元音不准确、重音问题、辅音发音等）"
        },
        {
          "word": "具体单词2（如：bag）",
          "incorrect": "学生实际发出的错误发音（用IPA音标表示，如：/bæɡ/ 错发成 /bɛɡ/ 或 /bɑːɡ/）",
          "correct": "该单词的标准正确发音（用IPA音标表示，如：/bæɡ/）",
          "type": "问题类型"
        },
        {
          "word": "具体单词3（如：fine）",
          "incorrect": "学生实际发出的错误发音（用IPA音标表示，如：/faɪn/ 错发成 /fɪn/ 或 /fiːn/）",
          "correct": "该单词的标准正确发音（用IPA音标表示，如：/faɪn/）",
          "type": "问题类型"
        }
      ],
      "suggestions": [
        {
          "title": "建议标题（基于阈值触发或通用建议）",
          "description": "详细的练习建议和方法（至少50词）"
        },
        {
          "title": "第二个建议标题",
          "description": "第二个练习建议和方法（至少50词）"
        }
      ]
    },
    "grammar": {
      "overview": "语法方面的整体评估和趋势总结（基于两次课堂对比）。这是一个完整的段落概述，需要包含：1) 学生语法的总体掌握水平；2) 两次课堂中语法表现的主要变化；3) 常见的语法问题类型；4) 语法准确性对口语表达的影响；5) 未来提升的方向。字数要求：至少100词，确保内容完整、逻辑连贯。",
      "details": "详细的语法问题深度分析。这部分要在overview的基础上进一步展开，包含：1) 具体对比两次课堂的语法错误类型、频率和严重程度；2) 分析学生在不同语法项目（如时态、第三人称单数、介词等）上的掌握差异；3) 提供早期课堂和最近课堂的语法表现对比；4) 分析语法问题的根源和改进路径。字数要求：至少150词，内容要比overview更加深入和具体。",
      "examples": [
        {
          "category": "错误类别1（如：第三人称单数）",
          "incorrect": "错误句子（最好来自实际对话）",
          "correct": "正确句子",
          "explanation": "错误解释和语法规则"
        },
        {
          "category": "错误类别2（如：时态使用、动词搭配）",
          "incorrect": "错误句子",
          "correct": "正确句子",
          "explanation": "错误解释和语法规则"
        },
        {
          "category": "错误类别3（如：介词使用、冠词使用）",
          "incorrect": "错误句子",
          "correct": "正确句子",
          "explanation": "错误解释和语法规则"
        }
      ],
      "suggestions": [
        {
          "title": "建议标题（基于阈值触发或通用建议）",
          "description": "详细的练习建议和方法（至少50词）"
        },
        {
          "title": "第二个建议标题",
          "description": "第二个练习建议和方法（至少50词）"
        }
      ]
    },
    "intonation": {
      "overview": "语调与节奏方面的整体评估和趋势总结（基于两次课堂对比）。这是一个完整的段落概述，需要包含：1) 学生语调与节奏的总体水平评价；2) 两次课堂在语调表现力和自然度上的主要变化；3) 主要存在的问题类型（如语调单一、停顿不当、重音错误等）；4) 未来改进的方向。字数要求：至少100词，确保内容完整、逻辑清晰。",
      "details": "详细的语调与节奏深度分析。这部分要在overview的基础上进一步展开，包含：1) 具体对比两次课堂的语调变化（升调、降调的使用是否自然）；2) 分析句子节奏和停顿的合理性及其变化；3) 评估语速的流畅度和句子重音的掌握情况；4) 对比早期课堂和最近课堂在语音韵律特征上的具体差异。注意：这部分应该专注于语调、节奏、重音等韵律特征，而不是讨论发音准确性（发音准确性在pronunciation部分讨论）。字数要求：至少150词，内容要比overview更加深入和具体。",
      "suggestions": [
        {
          "title": "建议标题（基于阈值触发或通用建议）",
          "description": "详细的练习建议和方法（至少50词）"
        },
        {
          "title": "第二个建议标题",
          "description": "第二个练习建议和方法（至少50词）"
        }
      ]
    }
  }
}

**重要提示：**
1. 所有百分比必须基于实际数据计算，不要编造数字
2. 所有原文案例必须来自实际转录文本或对话记录
3. 每个analysis和example字段都要融入"对比"元素，突出变化
4. 基于阈值触发规则，在suggestions中智能添加相应建议
5. 确保返回有效的JSON格式，不要包含注释
6. 所有文字描述要详实、具体、有数据支撑
7. **发音示例（pronunciation.examples）中，incorrect 和 correct 字段必须是不同的音标！** incorrect 应该是学生实际发出的错误发音，correct 是该单词的标准正确发音。例如：如果学生把 "nine" /naɪn/ 错读成 /nɪn/，那么 incorrect 应该填 "/nɪn/"，correct 应该填 "/naɪn/"。请基于实际听到的发音错误填写，如果无法确定具体错误，请提供常见的错误发音模式。`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "你是一位专业的英语教学专家。请以JSON格式返回详细的学习分析报告。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const analysisData = JSON.parse(content);
      
      return {
        ...studentInfo,
        ...analysisData
      };
    } catch (error) {
      console.error('Error comparing videos:', error);
      throw new Error('Failed to generate comparison report');
    }
  }

  /**
   * 主要的分析方法
   */
  async analyzeVideos(request: VideoAnalysisRequest): Promise<VideoAnalysisResponse> {
    // 判断是否使用模拟数据
    const useMock = request.useMockData !== false && (request.useMockData || (!request.apiKey && this.defaultUseMock));
    
    if (useMock) {
      console.log('📝 Using mock analysis for:', request.studentName);
      return this.analyzeMock(request);
    }

    // 获取 OpenAI 客户端
    const openai = this.getOpenAIClient(request.apiKey);
    if (!openai) {
      throw new Error('No OpenAI API key available. Please provide an API key or use mock data.');
    }

    // 否则使用真实的OpenAI API
    try {
      console.log('🚀 Starting real AI video analysis for:', request.studentName);
      console.log('📹 Video 1:', request.video1);
      console.log('📹 Video 2:', request.video2);

      // 2. 🚀 超级并行：让所有可并行的步骤都并行执行
      console.log('\n=== 🚀 超级并行分析：下载、转录、分析全部并行 ===');
      const overallStartTime = Date.now();
      
      // 添加进度监控
      const progressInterval = setInterval(() => {
        const elapsed = ((Date.now() - overallStartTime) / 1000).toFixed(0);
        console.log(`⏳ 视频分析进行中... 已耗时: ${elapsed}秒`);
      }, 15000); // 每15秒打印一次进度
      
      let video1Result, video2Result;
      try {
        // 🔥 步骤1：并行转录两个视频（智能选择 AssemblyAI 或 Whisper）
        console.log('\n🎯 [并行] 智能转录两个视频（优先使用免费服务）...');
        const transcribeStartTime = Date.now();
        const [transcription1, transcription2] = await Promise.all([
          (async () => {
            console.log('📥 转录 Video 1...');
            try {
              // 尝试使用智能转录
              const result = await this.transcribeVideoSmart(request.video1, 'Video 1');
              console.log('✅ Video 1 转录完成（AssemblyAI）');
              return result;
            } catch (error: any) {
              // 如果需要降级到 Whisper
              if (error.message === 'FALLBACK_TO_WHISPER') {
                console.log('🔄 Video 1 降级到 Whisper...');
                const result = await this.whisperService.transcribeVideo(request.video1, openai);
                console.log('✅ Video 1 转录完成（Whisper）');
                return result;
              }
              throw error;
            }
          })(),
          (async () => {
            console.log('📥 转录 Video 2...');
            try {
              // 尝试使用智能转录
              const result = await this.transcribeVideoSmart(request.video2, 'Video 2');
              console.log('✅ Video 2 转录完成（AssemblyAI）');
              return result;
            } catch (error: any) {
              // 如果需要降级到 Whisper
              if (error.message === 'FALLBACK_TO_WHISPER') {
                console.log('🔄 Video 2 降级到 Whisper...');
                const result = await this.whisperService.transcribeVideo(request.video2, openai);
                console.log('✅ Video 2 转录完成（Whisper）');
                return result;
              }
              throw error;
            }
          })()
        ]);
        const transcribeTime = ((Date.now() - transcribeStartTime) / 1000).toFixed(1);
        console.log(`✅ 两个视频转录完成！耗时: ${transcribeTime}秒`);
        console.log(`💰 当前 AssemblyAI 剩余免费额度: ${assemblyAIService.getStats().remainingMinutes} 分钟\n`);

        // 🔥 步骤2：并行分析两个视频的转录文本
        console.log('🤖 [并行] 使用GPT-4分析两个视频...');
        const gptStartTime = Date.now();
        const [analysis1Text, analysis2Text] = await Promise.all([
          this.analyzeTranscriptionWithGPT(transcription1, openai, 'Video 1'),
          this.analyzeTranscriptionWithGPT(transcription2, openai, 'Video 2')
        ]);
        const gptTime = ((Date.now() - gptStartTime) / 1000).toFixed(1);
        console.log(`✅ 两个视频GPT分析完成！耗时: ${gptTime}秒\n`);

        // 组装结果
        video1Result = { transcription: transcription1, analysis: analysis1Text };
        video2Result = { transcription: transcription2, analysis: analysis2Text };
        
        clearInterval(progressInterval);
        const totalTime = ((Date.now() - overallStartTime) / 1000).toFixed(1);
        console.log(`✅ 所有步骤完成！总耗时: ${totalTime}秒 (转录: ${transcribeTime}秒, GPT分析: ${gptTime}秒)`);
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }

      // 3. 比较并生成报告
      console.log('\n=== 📊 生成对比报告 ===');
      const reportStartTime = Date.now();
      const report = await this.compareVideos(
        video1Result,
        video2Result,
        {
          studentName: request.studentName,
          grade: request.grade,
          level: request.level,
          unit: request.unit,
          video1Time: request.video1Time,
          video2Time: request.video2Time
        },
        openai
      );

      const reportTime = ((Date.now() - reportStartTime) / 1000).toFixed(1);
      console.log(`✅ 对比报告生成完成！耗时: ${reportTime}秒`);
      console.log('✅ 整体分析完成 for:', request.studentName);
      return report;
    } catch (error) {
      console.error('❌ Error in analyzeVideos:', error);
      
      // 提供更详细的错误信息
      if (error instanceof Error) {
        if (error.message.includes('transcribe')) {
          throw new Error('视频转录失败：' + error.message + '\n请确保视频链接可访问，且包含音频内容。');
        } else if (error.message.includes('API key')) {
          throw new Error('API Key 无效：' + error.message);
        } else if (error.message.includes('download')) {
          throw new Error('视频下载失败：' + error.message + '\n请检查视频链接是否正确。');
        }
      }
      
      throw error;
    }
  }

  /**
   * 用于开发和测试的模拟分析方法
   */
  async analyzeMock(request: VideoAnalysisRequest): Promise<VideoAnalysisResponse> {
    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 返回模拟数据
    return {
      studentName: request.studentName,
      grade: request.grade,
      level: request.level,
      unit: request.unit,
      learningData: {
        handRaising: {
          trend: "提升",
          percentage: "↑ 15%",
          analysis: "本周举手次数相比上周增加了15%，展现出更强的课堂参与意愿"
        },
        answerLength: {
          trend: "提升",
          percentage: "↑ 23%",
          analysis: "回答平均长度从5个词增加到7个词，语言表达更加完整"
        },
        completeSentences: {
          trend: "提升",
          percentage: "↑ 18%",
          analysis: "完整句子使用率从60%提升至78%，语法结构更加规范"
        },
        readingAccuracy: {
          trend: "持平",
          percentage: "92%",
          analysis: "保持了较高的阅读准确率，发音清晰准确"
        }
      },
      progressDimensions: {
        fluency: {
          analysis: "在口语流利度方面，小明的表现显示出一定的进步，尽管仍需大幅提高。在早期课堂中，小明的语速较慢，存在明显的停顿，主要依赖老师的引导和重复。在最近的课堂上，小明的语速有所加快，尽管仍有一些犹豫和停顿，但整体流利度有所提升。这种进步对于提升小明的语言自信心和表达能力具有重要意义，因为流利度的提高能够帮助学生更自如地进行交流，进而增强其语言学习的积极性和主动性。",
          example: "【早期课堂】老师：'You can say how are you.' 学生：'How are you?'\n\n【最近课堂】老师：'Are you ready with our lesson for today?' 学生：'Yes, I'm ready.'\n\n【对比分析】小明在最近课堂中表现出更少的犹豫，显示出语速和流利度的提高。"
        },
        confidence: {
          analysis: "小明在课堂中的自信心和互动性显著增强。早期课堂中，小明的回答多限于简单的确认或重复，声音轻且犹豫，然而，在最近的课堂中，小明表现出更大的参与意愿，主动回答问题并显示出对学习内容的更多兴趣。这种自信心的提升在语言学习中至关重要，它不仅有助于提高课堂参与度，还能够促进语言表达能力和综合语言技能的发展。",
          example: "【早期课堂】老师：'Do you drink milk, Leo? Yes or no?' 学生：'Yes.'\n\n【最近课堂】老师：'Are you ready with our lesson for today?' 学生：'Yes, I'm ready.'\n\n【对比分析】在最近课堂中，小明更主动地参与对话，声音更响亮，显示出自信心的提升。"
        },
        languageApplication: {
          analysis: "小明在语言主动应用能力方面展现出进步的迹象。在早期课堂中，小明主要使用简单的单词和短语回答问题，而在最近的课堂中，小明开始尝试使用更复杂的句型结构。虽然词汇量和语法的多样性仍需提高，但这种主动尝试使用新学知识的态度值得肯定。语言主动应用能力的提升体现了学生对语言知识的内化程度，有助于培养其独立思考和表达的能力。",
          example: "【早期课堂】老师：'What do you see?' 学生：'Cat.'\n\n【最近课堂】老师：'What are we learning today?' 学生：'We are learning about animals.'\n\n【对比分析】小明从单词回答进步到使用完整句子，展示了语言应用能力的提升。"
        },
        sentenceComplexity: {
          analysis: "在句子复杂度及组织能力方面，小明表现出明显的成长。早期课堂中，小明多使用单词或简单短语回答，而在最近的课堂中，小明能够说出更完整的句子，虽然结构仍相对简单，但已经开始尝试使用主谓宾完整的句型。句子复杂度的提升对于语言表达能力的发展至关重要，它标志着学生从简单的词汇堆砌向有逻辑、有结构的表达转变。",
          example: "【早期课堂】老师：'Do you like milk?' 学生：'Yes.'\n\n【最近课堂】老师：'Are you ready?' 学生：'Yes, I'm ready.'\n\n【对比分析】小明开始使用完整句子结构（主语+动词），展示了句子组织能力的进步。"
        }
      },
      improvementAreas: {
        pronunciation: {
          overview: "小明在发音方面表现出一定的进步，特别是在最近课堂中，他的发音更为准确且流利。然而，他仍然在某些单词的元音和辅音发音上存在问题，可能影响整体流利度。通过持续练习和教师的指导，Leo有望在发音上取得更大进步。",
          details: "在两次课堂中，小明的发音逐步改善。他在早期课堂中发音不太准确，尤其是在复杂单词和新词汇上有明显问题。在最近课堂中，虽然他在发音上仍有需要改进的地方，但他在重复复杂句子和学习新词汇时显示出了更好的发音技巧。",
          examples: [
            {
              word: "awfully",
              incorrect: "/ˈɔː.fəli/",
              correct: "/ˈɔː.fli/",
              type: "元音不准确"
            },
            {
              word: "ballet",
              incorrect: "/bæˈleɪ/",
              correct: "/ˈbæl.eɪ/",
              type: "重音问题"
            },
            {
              word: "pig",
              incorrect: "/pɪg/",
              correct: "/pɪɡ/",
              type: "辅音发音"
            }
          ],
          suggestions: [
            {
              title: "提高准确性：三步审题法",
              description: "建议小明在回答问题时，首先圈出主要条件，然后画出关系，最后估计答案。这种方法有助于提高他的发音准确性和语言理解能力。在连读新词时，可以刻意放慢语速，注意每个音节的发音细节，特别是元音和重音位置。通过反复练习，逐步提高发音的准确度。"
            },
            {
              title: "音标学习与跟读模仿",
              description: "建议系统学习国际音标（IPA），掌握每个音素的正确发音方法。可以使用在线词典或APP（如剑桥词典、Forvo）查询单词的标准发音，进行多次跟读模仿。每天选择5-10个易错词汇进行专项练习，录音对比自己与标准发音的差异，针对性改进。长期坚持能显著提升发音标准度。"
            }
          ]
        },
        grammar: {
          overview: "Leo在语法方面整体表现良好，在两次课堂中都能基本掌握简单句的结构。然而，在第三人称单数、动词搭配和介词使用等细节方面仍有提升空间。通过针对性的语法练习和实时纠错，Leo能够进一步提高语法准确性，使口语表达更加规范和流畅。",
          details: "对比两次课堂的语法表现，Leo在基础句型的掌握上较为稳定，但在动词变化和时态一致性方面偶尔出现小错误。特别是在第三人称单数动词变化、动词与be动词的混用、以及介词的选择上需要加强。这些语法细节虽然不影响基本交流，但对于提升英语表达的准确性和专业度非常重要。",
          examples: [
            {
              category: "第三人称单数",
              incorrect: "She is feeds her cat",
              correct: "She feeds her cat",
              explanation: "当主语是第三人称单数时，动词要加 -s/-es，但不需要与 be 动词同时使用。"
            },
            {
              category: "动词搭配",
              incorrect: "My sister want to eat my make soup",
              correct: "My sister wants to eat the soup I made",
              explanation: "主语是第三人称单数时动词要加-s，定语从句的语序需要调整为正确的英语表达方式。"
            },
            {
              category: "介词使用",
              incorrect: "She is feeding for her dog",
              correct: "She is feeding her dog",
              explanation: "动词 feed 是及物动词，后面直接跟宾语，不需要介词 for。"
            }
          ],
          suggestions: [
            {
              title: "语法规则强化练习",
              description: "在口语练习前，可以进行简短的语法复习。建议每次课前花5分钟回顾本节课重点语法规则，特别是第三人称单数、时态变化等常见易错点。可以通过填空练习、句子改错等方式加强记忆。"
            },
            {
              title: "实时纠错与反馈",
              description: "在口语表达过程中，及时纠正语法错误并给予正面反馈。建议使用「三明治反馈法」：先肯定表达内容 → 温和指出语法问题 → 鼓励正确重述。这样可以在不打击自信心的前提下，帮助学生建立正确的语法习惯。"
            }
          ]
        },
        intonation: {
          overview: "Leo在语调与节奏方面表现出积极的进步。对比两次课堂，Leo的语调从较为平淡、缺乏起伏变化，逐步发展为能够自然地使用升调和降调。他的语速也更加流畅，停顿位置更加合理。主要存在的问题包括语调单一和句子重音掌握不足，但最近课堂已有明显改善。建议继续通过跟读和模仿练习，进一步提升语调的自然度和表现力。",
          details: "在早期课堂中，Leo的语调较为平淡，缺乏起伏变化，句子节奏也不够自然，常常出现不恰当的停顿。在最近课堂中，Leo的语调开始有更多的变化，特别是在回答问题时能够自然地使用升调和降调。他的语速也更加流畅，停顿位置更加合理，整体表达听起来更接近自然的英语口语节奏。通过对比分析，Leo在句子重音的掌握上有明显提升。早期课堂中他倾向于平均分配每个词的重音，导致表达缺乏重点。最近课堂中，他开始能够在关键词上加强语气，使得表达更加生动有力。",
          suggestions: [
            {
              title: "语调模仿练习",
              description: "建议通过模仿和重复练习来提高小明的语调变化，特别是通过听力材料和跟读练习。可以选择适合年龄段的英语动画片或儿歌，让学生跟读并模仿其中的语调起伏、停顿节奏。每天15分钟的跟读练习，能有效改善语调的自然度和流畅性。"
            },
            {
              title: "句子重音训练",
              description: "针对句子中的重点词汇进行重音标记和练习。建议在朗读句子时，先标出需要强调的关键词（如名词、动词、形容词），然后有意识地加重这些词的读音。可以通过拍手、敲桌子等身体动作配合，帮助学生建立重音意识，使表达更加生动有力。"
            }
          ]
        }
      }
    };
  }
}

