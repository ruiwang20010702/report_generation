import OpenAI from 'openai';
import axios from 'axios';
import { VideoAnalysisRequest, VideoAnalysisResponse } from '../types/index.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { WhisperService, TranscriptionResult } from './whisperService.js';
import { tingwuTranscriptionService } from './tingwuTranscriptionService.js';
import { reportRecordService } from './reportRecordService.js';
import { AppError, ErrorType } from '../utils/errors.js';
import { alertServiceError } from './alertService.js';

/**
 * 📝 报告字数配置
 * 在这里修改报告各部分的字数要求
 */
const REPORT_WORD_COUNT = {
  // 学习数据分析
  learningData: {
    handRaising: 50,      // 主动发言次数分析
    answerLength: 50,    // 回答长度分析
    completeSentences: 50, // 完整句子率分析
    readingAccuracy: 50,  // 阅读准确率分析
  },
  // 进步维度
  progressDimensions: {
    fluency: 100,           // 流利度分析
    confidence: 100,        // 自信心分析
    languageApplication: 100, // 语言应用分析
    sentenceComplexity: 100,  // 句子复杂度分析
  },
  // 改进领域
  improvementAreas: {
    overview: 25,          // 概述部分
    details: 150,           // 详细分析部分
    suggestion: 100,        // 建议描述
  },
};

/**
 * 🎯 AI 提供商配置接口
 */
interface AIProviderConfig {
  name: string;           // 提供商标识：'DeepSeek' | 'GLM' | 'Qwen' | 'OpenAI'
  apiKey: string;         // API 密钥
  baseURL?: string;       // API 基础 URL（可选，OpenAI 使用默认）
  model: string;          // 模型名称
  displayName: string;    // 显示名称
  emoji: string;          // 图标
  features: string[];     // 特性列表
}

/**
 * 💰 AI 模型定价配置（2025年4月更新）
 * 单位：元/1K tokens
 * 注意：智谱GLM-4-Plus在2025年4月24日大幅降价，从¥50/1M降至¥5/1M tokens
 */
const AI_PRICING: Record<string, { input: number; output: number }> = {
  'glm-4-plus': { input: 0.005, output: 0.005 },   // 智谱GLM-4-Plus: ¥5/1M tokens (2025年4月降价后)
  'glm-4': { input: 0.1, output: 0.1 },             // 智谱GLM-4: ¥100/1M tokens
  'deepseek-chat': { input: 0.001, output: 0.002 }, // DeepSeek: ¥1/1M input, ¥2/1M output
  'qwen-plus': { input: 0.004, output: 0.012 },     // 通义千问Plus: ¥4/1M input, ¥12/1M output
  'gpt-4o': { input: 2.5, output: 10 },             // GPT-4o: $2.5/1M input, $10/1M output (按¥1=$1计算)
};

/**
 * 💰 计算 AI 调用成本
 */
function calculateAICost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = AI_PRICING[model] || { input: 0.005, output: 0.005 }; // 默认使用GLM-4-Plus定价（2025年4月降价后）
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

export class VideoAnalysisService {
  private defaultOpenai: OpenAI | null;
  private defaultUseMock: boolean;
  private whisperService: WhisperService;

  constructor() {
    this.whisperService = new WhisperService();
    
    // 🌟 强制使用 GLM 模型（固定配置）
    try {
    const aiProvider = this.detectAIProvider();
    if (aiProvider) {
      this.defaultOpenai = this.createAIClient(aiProvider);
      this.defaultUseMock = false;
    } else {
        // 检查是否强制使用 Mock
        if (process.env.USE_MOCK_ANALYSIS === 'true') {
      console.log('⚠️  Default mode: MOCK - using simulated data');
      console.log('💡 Users can provide their own API Key in the form for real AI analysis');
      this.defaultOpenai = null;
      this.defaultUseMock = true;
        } else {
          throw new Error('GLM API Key 未配置且未启用 Mock 模式');
        }
      }
    } catch (error) {
      console.error('❌ AI 服务初始化失败:', error instanceof Error ? error.message : error);
      // 转换为AppError
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorType.API_KEY_ERROR,
        error instanceof Error ? error.message : 'AI服务初始化失败',
        {
          originalError: error instanceof Error ? error : undefined,
          userMessage: 'AI服务配置错误，请检查API密钥设置',
        }
      );
    }
  }

  /**
   * 🔍 强制使用 GLM 模型（固定配置）
   * 不再支持降级到其他模型，确保输出一致性
   */
  private detectAIProvider(): AIProviderConfig | null {
    // 🧠 强制使用智谱 GLM - 质量最高的国内模型（测试得分 98/100）
    if (process.env.GLM_API_KEY) {
      return {
        name: 'GLM',
        apiKey: process.env.GLM_API_KEY,
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        model: 'glm-4-plus',
        displayName: '智谱 GLM-4-Plus',
        emoji: '🧠',
        features: ['国内直连', '质量最高', '128K上下文']
      };
    }

    // ❌ GLM 不可用时抛出错误，不再降级
    throw new AppError(
      ErrorType.API_KEY_ERROR,
      'GLM API Key 未配置',
      {
        userMessage: 'GLM API Key 未配置，请设置环境变量 GLM_API_KEY 以使用智谱 GLM 模型。系统已配置为强制使用 GLM 模型。',
        context: {
          hint: '请设置环境变量 GLM_API_KEY 以使用智谱 GLM 模型',
        },
      }
    );
  }

  /**
   * 🏗️ 创建 AI 客户端实例
   */
  private createAIClient(config: AIProviderConfig): OpenAI {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${config.emoji} 使用 AI 服务: ${config.displayName}`);
    console.log(`📋 模型: ${config.model}`);
    console.log(`✨ 特性: ${config.features.join(' | ')}`);
    console.log(`${'='.repeat(60)}\n`);

    const clientConfig: any = {
      apiKey: config.apiKey,
    };

    if (config.baseURL) {
      clientConfig.baseURL = config.baseURL;
    }

    // 为 OpenAI 添加代理支持
    if (config.name === 'OpenAI') {
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      if (proxyUrl) {
        console.log('🌐 Using proxy:', proxyUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
        clientConfig.httpAgent = new HttpsProxyAgent(proxyUrl);
      }
    }

    return new OpenAI(clientConfig);
  }

  /**
   * 创建 AI 客户端（支持动态 API Key 和代理）
   * 注意：系统使用智谱 GLM 模型，用户提供的 API Key 也应该是 GLM 的
   */
  private getOpenAIClient(apiKey?: string): OpenAI | null {
    if (apiKey) {
      console.log('🔑 Using user-provided GLM API Key');
      
      // 配置 GLM 客户端（智谱AI）
      const config: any = {
        apiKey,
        baseURL: 'https://open.bigmodel.cn/api/paas/v4', // GLM API 地址
      };
      
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
   * 🎯 根据客户端自动选择合适的模型
   */
  private getModelName(openai: OpenAI): string {
    const baseURL = (openai as any).baseURL;
    
    // DeepSeek
    if (baseURL?.includes('deepseek.com')) {
      return 'deepseek-chat';
    }
    
    // 智谱 GLM
    if (baseURL?.includes('bigmodel.cn')) {
      return 'glm-4-plus';
    }
    
    // 通义千问
    if (baseURL?.includes('dashscope.aliyuncs.com')) {
      return 'qwen-plus';
    }
    
    // OpenAI（默认）
    return 'gpt-4o';
  }

  /**
   * 📊 获取当前使用的 AI 提供商信息
   */
  private getProviderInfo(openai: OpenAI): string {
    const baseURL = (openai as any).baseURL;
    
    if (baseURL?.includes('deepseek.com')) return '🔷 DeepSeek';
    if (baseURL?.includes('bigmodel.cn')) return '🧠 智谱GLM-4';
    if (baseURL?.includes('dashscope.aliyuncs.com')) return '🇨🇳 通义千问';
    return '🤖 OpenAI GPT-4';
  }

  /**
   * 使用 GLM-4-Plus 分析转录文本
   * 返回：{ analysis: string, usage: { promptTokens, completionTokens, totalTokens, cost } }
   */
  private async analyzeTranscriptionWithGPT(
    transcription: TranscriptionResult,
    openai: OpenAI,
    videoLabel: string = 'video'
  ): Promise<{ analysis: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } }> {
    if (!openai) {
      throw new AppError(
        ErrorType.AI_ANALYSIS_ERROR,
        'OpenAI client not initialized',
        {
          userMessage: 'AI分析服务未初始化，请检查配置',
          context: { videoLabel },
        }
      );
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
      
      // 使用 AI 模型进行深度分析
      const model = this.getModelName(openai);
      const provider = this.getProviderInfo(openai);
      console.log(`${provider} 正在分析 ${videoLabel}，模型: ${model}`);
      const response = await openai.chat.completions.create({
        model: model,
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
- 主动回答次数：学生主动回答问题或发言的次数（包括简单的"Yes/No"或跟读）
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
- 请提取4段最能体现学生能力的对话片段（包含老师问题+学生回答）

请以JSON格式返回分析结果（保持现有字段名，在内容中融入上述分析）：
{
  "wordCount": 学生发言的总词数（数字）,
  "sentenceCount": 学生发言的句子数（数字）,
  "fluency": "口语流利度的详细分析（融入量化数据和具体案例），包括：1) 流利度评分或描述；2) 语速和停顿情况；3) 连贯性分析；4) 具体进步表现（如果有）。至少10词。",
  "vocabulary": "词汇运用能力的详细分析（融入统计数据），包括：1) 词汇量评估；2) 词汇分类统计（基础词/进阶词）；3) 词汇运用灵活性；4) 新词汇掌握情况。至少100词。",
  "grammar": "语法和句型的详细分析（融入句型统计），包括：1) 语法准确率；2) 句型复杂度统计；3) 常见语法问题；4) 句子组织能力。至少100词。",
  "participation": "参与度和互动性的详细分析（融入量化指标），包括：1) 主动回答次数（具体数字）；2) 平均回答长度（词数）；3) 完整句输出次数；4) 语言准确率（百分比）；5) 参与度评估（学生发言占比）。至少100词。",
  "strengths": ["优点1（具体且有数据支持）", "优点2（具体且有数据支持）", "优点3（具体且有数据支持）"],
  "weaknesses": ["待改进1（具体且有案例）", "待改进2（具体且有案例）"],
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
        temperature: 0.1,  // 降低到0.1以提高输出一致性和确定性（原值0.7会产生更多随机性，0.1更稳定可靠）
        max_tokens: 3000
      });

      const analysisText = response.choices[0]?.message?.content || '{}';
      
      // 提取 token 使用量
      const usage = response.usage;
      const promptTokens = usage?.prompt_tokens || 0;
      const completionTokens = usage?.completion_tokens || 0;
      const totalTokens = usage?.total_tokens || 0;
      
      // 计算成本
      const cost = calculateAICost(model, promptTokens, completionTokens);
      
      console.log(`✅ AI analysis complete for ${videoLabel} (${model})`);
      console.log(`   Tokens: ${promptTokens} input + ${completionTokens} output = ${totalTokens} total`);
      console.log(`   Cost: ¥${cost.toFixed(4)}`);
      
      return {
        analysis: analysisText,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          cost
        }
      };
    } catch (error) {
      console.error(`❌ Error analyzing ${videoLabel}:`, error);
      
      // 如果已经是AppError，直接抛出（不修改context，因为它是只读的）
      if (error instanceof AppError) {
        throw error;
      }
      
      // 转换为AppError
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AppError(
        ErrorType.AI_ANALYSIS_ERROR,
        `Failed to analyze transcription: ${errorMessage}`,
        {
          originalError: error instanceof Error ? error : undefined,
          userMessage: 'AI分析失败，请稍后重试。如果问题持续，请检查视频内容和API配置。',
          context: { videoLabel },
        }
      );
    }
  }

  /**
   * 🚀 使用通义听悟进行视频转录
   * 通义听悟：价格便宜，免费额度高（每天2小时），超出后自动使用付费额度
   */
  private async transcribeVideoSmart(
    videoUrl: string,
    videoLabel: string = 'video',
    language: string = 'en',
    speakerCount?: number
  ): Promise<TranscriptionResult> {
    // 🇨🇳 使用通义听悟服务
    if (!tingwuTranscriptionService.isAvailable()) {
      throw new AppError(
        ErrorType.SERVICE_UNAVAILABLE,
        '通义听悟服务不可用：未配置 AccessKey',
        {
          userMessage: '转录服务不可用：未配置 AccessKey（需要 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET）',
          context: {
            videoLabel,
            hint: '请配置环境变量 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET',
          },
        }
      );
    }

    console.log(`🇨🇳 [${videoLabel}] 使用通义听悟服务（教育网课场景）`);
    
    // 显示免费额度信息（仅供参考，不影响服务）
    const stats = tingwuTranscriptionService.getStats();
    if (stats.remainingMinutes > 0) {
      console.log(`💰 剩余免费额度: ${stats.remainingMinutes} 分钟/天`);
    } else {
      console.log(`💰 免费额度已用完，使用付费额度（¥0.01/分钟）`);
    }
    
    const diarizationSpeakerCount = speakerCount ?? 3;
    console.log(`🎓 使用教育领域专属模型，说话人分离：${diarizationSpeakerCount}人，语言: ${language}`);
        
        try {
      const result = await tingwuTranscriptionService.transcribeFromURL(videoUrl, {
            language,
            speakerLabels: true, // 启用说话人分离
            speakerCount: diarizationSpeakerCount, // 默认3个，或由请求覆盖
            transcriptionModel: 'domain-education',
            identityRecognitionEnabled: true,
            identitySceneIntroduction: 'One-on-one online English class scenario',
            identityContents: [
              { Name: 'Teacher', Description: 'Asks questions, guides learning, explains key points, corrects mistakes, provides feedback and encouragement. Compared to students, teachers speak more fluently and clearly.' },
              { Name: 'Student', Description: 'Answers teacher questions, repeats or retells, asks for clarification, practices learned content. Compared to teachers, students may speak less fluently and less clearly.' }
            ]
          });
          
      console.log(`✅ [${videoLabel}] 通义听悟转录成功！`);
      console.log(`💰 更新后剩余额度: ${tingwuTranscriptionService.getStats().remainingMinutes} 分钟/天`);
          
          return result;
        } catch (error: any) {
      console.error(`❌ [${videoLabel}] 通义听悟转录失败:`, error.message);
      
      // 如果已经是AppError，直接抛出（不修改context，因为它是只读的）
      if (error instanceof AppError) {
        throw error;
      }
      
      // 根据错误消息推断错误类型
      const errorMessage = error?.message || 'Unknown error';
      let errorType = ErrorType.TRANSCRIPTION_ERROR;
      let userMessage = '视频转录失败，请检查视频链接和内容';
      
      if (errorMessage.includes('URL') || errorMessage.includes('链接') || errorMessage.includes('link')) {
        errorType = ErrorType.VIDEO_PROCESSING_ERROR;
        userMessage = '视频链接无法访问，请确保链接有效且可公开访问';
      } else if (errorMessage.includes('AccessKey') || errorMessage.includes('API key') || errorMessage.includes('账号') || errorMessage.includes('余额')) {
        errorType = ErrorType.API_KEY_ERROR;
        userMessage = '转录服务配置或账户问题，请检查AccessKey设置和账户余额';
      }
      
      throw new AppError(
        errorType,
        `通义听悟转录失败：${errorMessage}`,
        {
          originalError: error instanceof Error ? error : undefined,
          userMessage,
          context: {
            videoLabel,
            hint: '请检查：1. AccessKey是否正确配置 2. 网络连接是否正常 3. 视频URL是否可访问 4. 免费额度是否充足',
          },
        }
      );
    }
  }

  /**
   * 使用通义听悟转录视频，然后用 GLM-4-Plus 分析内容
   * @deprecated 此方法已被超级并行版本替代，保留用于向后兼容
   */
  private async analyzeVideoContent(
    videoUrl: string, 
    openai: OpenAI,
    videoLabel: string = 'video'
  ): Promise<{ transcription: TranscriptionResult; analysis: { analysis: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } } }> {
    if (!openai) {
      throw new AppError(
        ErrorType.AI_ANALYSIS_ERROR,
        'OpenAI client not initialized',
        {
          userMessage: 'AI分析服务未初始化，请检查配置',
          context: { videoLabel },
        }
      );
    }
    
    try {
      // 1. 使用 Whisper API 转录视频
      console.log(`🎙️ Transcribing ${videoLabel}...`);
      const transcription = await this.whisperService.transcribeVideo(videoUrl, openai);
      console.log(`✅ Transcription complete for ${videoLabel}:`, transcription.text.substring(0, 100) + '...');

      // 2. 使用 GLM-4-Plus 进行分析
      const analysis = await this.analyzeTranscriptionWithGPT(transcription, openai, videoLabel);
      
      return {
        transcription,
        analysis
      };
    } catch (error) {
      console.error(`❌ Error analyzing ${videoLabel}:`, error);
      
      // 如果已经是AppError，直接抛出（不修改context，因为它是只读的）
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        ErrorType.AI_ANALYSIS_ERROR,
        `Failed to analyze video content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          originalError: error instanceof Error ? error : undefined,
          userMessage: '视频分析失败，请稍后重试',
          context: { videoLabel },
        }
      );
    }
  }

  /**
   * 比较两个视频，生成进步分析
   */
  private async compareVideos(
    video1Result: { transcription: TranscriptionResult; analysis: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } },
    video2Result: { transcription: TranscriptionResult; analysis: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } },
    studentInfo: { studentName: string; studentId?: string; grade: string; level: string; unit: string; video1Time?: string; video2Time?: string },
    openai: OpenAI
  ): Promise<VideoAnalysisResponse> {
    if (!openai) {
      throw new AppError(
        ErrorType.AI_ANALYSIS_ERROR,
        'OpenAI client not initialized',
        {
          userMessage: 'AI分析服务未初始化，请检查配置',
          context: { studentName: studentInfo.studentName },
        }
      );
    }
    
    try {
      // 验证转录文本
      if (!video1Result.transcription.text || video1Result.transcription.text.trim().length === 0) {
        throw new AppError(
          ErrorType.TRANSCRIPTION_ERROR,
          '第一个视频的转录文本为空',
          {
            userMessage: '第一个视频的转录文本为空，无法进行比较分析。请检查：1) 视频是否包含语音内容 2) 视频链接是否有效',
            context: { studentName: studentInfo.studentName, videoNumber: 1 },
          }
        );
      }
      if (!video2Result.transcription.text || video2Result.transcription.text.trim().length === 0) {
        throw new AppError(
          ErrorType.TRANSCRIPTION_ERROR,
          '第二个视频的转录文本为空',
          {
            userMessage: '第二个视频的转录文本为空，无法进行比较分析。请检查：1) 视频是否包含语音内容 2) 视频链接是否有效',
            context: { studentName: studentInfo.studentName, videoNumber: 2 },
          }
        );
      }

      const video1Analysis = JSON.parse(video1Result.analysis);
      const video2Analysis = JSON.parse(video2Result.analysis);
      
      // 验证分析结果是否有效
      if (!video1Analysis || typeof video1Analysis !== 'object') {
        throw new AppError(
          ErrorType.AI_ANALYSIS_ERROR,
          '第一个视频的分析结果无效',
          {
            userMessage: '第一个视频的分析结果格式错误，请重试',
            context: { studentName: studentInfo.studentName, videoNumber: 1 },
          }
        );
      }
      if (!video2Analysis || typeof video2Analysis !== 'object') {
        throw new AppError(
          ErrorType.AI_ANALYSIS_ERROR,
          '第二个视频的分析结果无效',
          {
            userMessage: '第二个视频的分析结果格式错误，请重试',
            context: { studentName: studentInfo.studentName, videoNumber: 2 },
          }
        );
      }

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
1. 详细的能力变化分析（至少${REPORT_WORD_COUNT.progressDimensions.fluency}词）
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
      "analysis": "详细分析（融入具体数据、原文案例对比、专业解读），至少${REPORT_WORD_COUNT.learningData.handRaising}词"
    },
    "answerLength": {
      "trend": "提升/下降/持平",
      "percentage": "提升率（必须基于实际数据）",
      "analysis": "详细分析（融入对比案例），至少${REPORT_WORD_COUNT.learningData.answerLength}词"
    },
    "completeSentences": {
      "trend": "提升/下降/持平",
      "percentage": "提升率（必须基于实际数据）",
      "analysis": "详细分析（融入句子案例对比），至少${REPORT_WORD_COUNT.learningData.completeSentences}词"
    },
    "readingAccuracy": {
      "trend": "提升/下降/持平",
      "percentage": "变化值（如 +8%或92%→95%）",
      "analysis": "详细分析（融入错误类型对比），至少${REPORT_WORD_COUNT.learningData.readingAccuracy}词"
    }
  },
  "progressDimensions": {
    "fluency": {
      "analysis": "口语流利度的深度分析，包括：1) 具体数据对比；2) 语速、停顿、连贯性变化；3) 专业解读。至少${REPORT_WORD_COUNT.progressDimensions.fluency}词。",
      "example": "两次课堂的原文对话对比案例，不要直接使用示例，而是根据实际情况进行修改，必须严格按照以下格式排版（每个部分单独成段，使用换行符分隔）：\n\n💡 示例：\n\n【早期课堂】老师：'You can say how are you.' 学生：'How are you?'\n\n【最近课堂】老师：'Are you ready with our lesson for today?' 学生：'Yes, I'm ready.'\n\n【对比分析】小明在最近课堂中表现出更少的犹豫，显示出语速和流利度的提高。\n\n请只提供1组最具代表性的对比案例，必须包含【早期课堂】【最近课堂】【对比分析】三个部分，且每部分单独成段。"
    },
    "confidence": {
      "analysis": "自信心与互动的深度分析（融入量化数据），至少${REPORT_WORD_COUNT.progressDimensions.confidence}词。",
      "example": "两次课堂的互动案例对比，格式与fluency相同（必须包含【早期课堂】【最近课堂】【对比分析】三个单独段落）"
    },
    "languageApplication": {
      "analysis": "语言主动应用能力的深度分析（融入词汇和语法对比），至少${REPORT_WORD_COUNT.progressDimensions.languageApplication}词。",
      "example": "两次课堂的语言应用案例对比，格式与fluency相同（必须包含【早期课堂】【最近课堂】【对比分析】三个单独段落）"
    },
    "sentenceComplexity": {
      "analysis": "句子复杂度及组织能力的深度分析（融入句型统计），至少${REPORT_WORD_COUNT.progressDimensions.sentenceComplexity}词。",
      "example": "两次课堂的句子复杂度案例对比，格式与fluency相同（必须包含【早期课堂】【最近课堂】【对比分析】三个单独段落）"
    }
  },
  "improvementAreas": {
    "pronunciation": {
      "overview": "发音方面的整体评估和趋势总结（基于两次课堂对比）。这是一个完整的段落概述，需要包含：1) 学生发音的总体水平评价；2) 两次课堂的主要变化趋势（进步/持平/退步）；3) 主要存在的问题类型；4) 未来改进的方向和前景。字数要求：至少${REPORT_WORD_COUNT.improvementAreas.overview}词，确保内容完整、逻辑清晰。",
      "details": "详细的发音问题深度分析。这部分要在overview的基础上进一步展开，包含：1) 具体分析两次课堂中发音问题的类型、频率和严重程度；2) 对比早期课堂和最近课堂的发音表现差异；3) 分析发音问题对整体表达流利度的影响；4) 提供具体的观察细节和案例背景。字数要求：至少${REPORT_WORD_COUNT.improvementAreas.details}词，内容要比overview更加深入和具体。",
      "examples": [
        {
          "word": "从学生实际对话中找出的第1个发音错误的单词（必须是转录文本中真实出现的单词）",
          "incorrect": "学生实际发出的错误发音的IPA音标（⚠️ 必须是错误的、不标准的音标，例如如果学生把big读成/bɪg/是错误的，那么这里应该填写/bɪg/；如果学生把/θ/读成/s/，那么这里应该填写含有/s/的错误音标）",
          "correct": "该单词的标准正确发音的IPA音标（⚠️ 必须是正确的、标准的音标，必须与incorrect字段不同！例如big的正确发音是/bɪɡ/，如果学生读错了，那么correct应该是/bɪɡ/，而incorrect应该是学生实际读出的错误音标）",
          "type": "问题类型（如：元音不准确、重音问题、辅音发音、/θ/和/s/混淆、/v/和/w/混淆等具体的发音错误类型）"
        },
        {
          "word": "从学生实际对话中找出的第2个发音错误的单词（必须是转录文本中真实出现的单词）",
          "incorrect": "学生实际发出的错误发音的IPA音标（⚠️ 必须是错误的、不标准的音标，必须与correct字段的值不同）",
          "correct": "该单词的标准正确发音的IPA音标（⚠️ 必须是正确的、标准的音标，必须与incorrect字段的值不同）",
          "type": "问题类型（如：元音不准确、重音问题、辅音发音、/θ/和/s/混淆、/v/和/w/混淆等具体的发音错误类型）"
        },
        {
          "word": "从学生实际对话中找出的第3个发音错误的单词（必须是转录文本中真实出现的单词）",
          "incorrect": "学生实际发出的错误发音的IPA音标（⚠️ 必须是错误的、不标准的音标，必须与correct字段的值不同）",
          "correct": "该单词的标准正确发音的IPA音标（⚠️ 必须是正确的、标准的音标，必须与incorrect字段的值不同）",
          "type": "问题类型（如：元音不准确、重音问题、辅音发音、/θ/和/s/混淆、/v/和/w/混淆等具体的发音错误类型）"
        }
      ],
      "suggestions": [
        {
          "title": "建议标题（基于阈值触发或通用建议）",
          "description": "详细的练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        },
        {
          "title": "第二个建议标题（基于阈值触发或通用建议，需要与第一个建议标题不同）",
          "description": "第二个练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        }
      ]
    },
    "grammar": {
      "overview": "语法方面的整体评估和趋势总结（基于两次课堂对比）。这是一个完整的段落概述，需要包含：1) 学生语法的总体掌握水平；2) 两次课堂中语法表现的主要变化；3) 常见的语法问题类型；4) 语法准确性对口语表达的影响；5) 未来提升的方向。字数要求：至少${REPORT_WORD_COUNT.improvementAreas.overview}词，确保内容完整、逻辑连贯。",
      "details": "详细的语法问题深度分析。这部分要在overview的基础上进一步展开，包含：1) 具体对比两次课堂的语法错误类型、频率和严重程度；2) 分析学生在不同语法项目（如时态、第三人称单数、介词等）上的掌握差异；3) 提供早期课堂和最近课堂的语法表现对比；4) 分析语法问题的根源和改进路径。字数要求：至少${REPORT_WORD_COUNT.improvementAreas.details}词，内容要比overview更加深入和具体。",
      "examples": [
        {
          "category": "错误类别1（如：第三人称单数）",
          "incorrect": "错误句子（最好是转录文本中真实出现的句子）",
          "correct": "正确句子",
          "explanation": "错误解释和语法规则"
        },
        {
          "category": "错误类别2（如：时态使用、动词搭配）",
          "incorrect": "错误句子（最好是转录文本中真实出现的句子） ",
          "correct": "正确句子",
          "explanation": "错误解释和语法规则"
        },
        {
          "category": "错误类别3（如：介词使用、冠词使用）",
          "incorrect": "错误句子（最好是转录文本中真实出现的句子）",
          "correct": "正确句子",
          "explanation": "错误解释和语法规则"
        }
      ],
      "suggestions": [
        {
          "title": "建议标题（基于阈值触发或通用建议）",
          "description": "详细的练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        },
        {
          "title": "第二个建议标题（基于阈值触发或通用建议，需要与第一个建议标题不同）",
          "description": "第二个练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        }
      ]
    },
    "intonation": {
      "overview": "语调与节奏方面的整体评估和趋势总结（基于两次课堂对比）。这是一个完整的段落概述，需要包含：1) 学生语调与节奏的总体水平评价；2) 两次课堂在语调表现力和自然度上的主要变化；3) 主要存在的问题类型（如语调单一、停顿不当、重音错误等）；4) 未来改进的方向。字数要求：至少${REPORT_WORD_COUNT.improvementAreas.overview}词，确保内容完整、逻辑清晰。",
      "details": "详细的语调与节奏深度分析。这部分要在overview的基础上进一步展开，包含：1) 具体对比两次课堂的语调变化（升调、降调的使用是否自然）；2) 分析句子节奏和停顿的合理性及其变化；3) 评估语速的流畅度和句子重音的掌握情况；4) 对比早期课堂和最近课堂在语音韵律特征上的具体差异。注意：这部分应该专注于语调、节奏、重音等韵律特征，而不是讨论发音准确性（发音准确性在pronunciation部分讨论）。字数要求：至少${REPORT_WORD_COUNT.improvementAreas.details}词，内容要比overview更加深入和具体。",
      "suggestions": [
        {
          "title": "建议标题（基于阈值触发或通用建议）",
          "description": "详细的练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        },
        {
          "title": "第二个建议标题（基于阈值触发或通用建议，需要与第一个建议标题不同）",
          "description": "第二个练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
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
7. ⚠️⚠️⚠️ 【关键】发音示例（pronunciation.examples）的音标要求：
   - 单词：必须从学生实际转录对话中找出（不要使用示例单词如 nine、bag、fine 等）
   - incorrect字段：必须填写学生实际发出的【错误】音标（例如：如果学生把/bɪɡ/读成/bɪg/，这里应该填/bɪg/；如果学生把think读成sink，这里应该填/sɪŋk/）
   - correct字段：必须填写该单词的【标准正确】音标（例如：big的标准音标是/bɪɡ/，think的标准音标是/θɪŋk/）
   - ❌❌❌ 严重错误示例（绝对禁止）：
     * word="think", incorrect="/θɪŋk/", correct="/θɪŋk/" ❌ 两个音标完全相同！
     * word="found", incorrect="/faʊnd/", correct="/faʊnd/" ❌ 两个音标完全相同！
     * word="big", incorrect="/bɪɡ/", correct="/bɪɡ/" ❌ 两个音标完全相同！
   - ✅✅✅ 正确示例（必须遵循）：
     * word="think", incorrect="/sɪŋk/", correct="/θɪŋk/" ✅ 首音 /s/ 和 /θ/ 不同
     * word="found", incorrect="/faund/", correct="/faʊnd/" ✅ 元音 /au/ 和 /aʊ/ 不同
     * word="van", incorrect="/wæn/", correct="/væn/" ✅ 首音 /w/ 和 /v/ 不同
   - 🔍 自查步骤：生成每个发音示例后，必须逐字符对比 incorrect 和 correct 音标，确保至少有一个音素不同！
   - 如果转录文本无法明确判断具体发音错误，可基于常见中国学生发音问题（如th→s，v→w，/ɪ/→/i/，/æ/→/e/等）进行合理推测
   - 宁可少给发音示例，也不要给出 incorrect 和 correct 相同的示例！`;

      const model = this.getModelName(openai);
      const provider = this.getProviderInfo(openai);
      console.log(`${provider} 正在生成对比报告，模型: ${model}`);

      const response = await openai.chat.completions.create({
        model: model,
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
        temperature: 0.1,  // 降低到0.1以提高输出一致性和确定性（原值0.7会产生更多随机性，0.1更稳定可靠）
        max_tokens: 4000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AppError(
          ErrorType.AI_ANALYSIS_ERROR,
          'No response from AI service',
          {
            userMessage: 'AI服务未返回有效响应，请稍后重试',
            context: { studentName: studentInfo.studentName },
          }
        );
      }

      const analysisData = JSON.parse(content);
      
      // 验证并修复发音示例中的重复音标问题
      this.validateAndFixPronunciationExamples(analysisData);
      this.validateAndFixGrammarExamples(analysisData);
      
      // 提取对比报告的 token 使用量
      const comparisonUsage = response.usage;
      const comparisonPromptTokens = comparisonUsage?.prompt_tokens || 0;
      const comparisonCompletionTokens = comparisonUsage?.completion_tokens || 0;
      const comparisonTotalTokens = comparisonUsage?.total_tokens || 0;
      
      // 计算对比报告成本（使用已声明的 model 变量）
      const comparisonCost = calculateAICost(model, comparisonPromptTokens, comparisonCompletionTokens);
      
      console.log(`💰 对比报告 Token 使用量: ${comparisonPromptTokens} input + ${comparisonCompletionTokens} output = ${comparisonTotalTokens} total`);
      console.log(`💰 对比报告成本: ¥${comparisonCost.toFixed(4)}`);
      
      // 汇总所有成本
      const video1Usage = video1Result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 };
      const video2Usage = video2Result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 };
      
      const totalAITokens = video1Usage.totalTokens + video2Usage.totalTokens + comparisonTotalTokens;
      const totalAICost = video1Usage.cost + video2Usage.cost + comparisonCost;
      
      // 转录成本
      const video1TranscriptionCost = video1Result.transcription.cost?.totalCost || 0;
      const video2TranscriptionCost = video2Result.transcription.cost?.totalCost || 0;
      const totalTranscriptionCost = video1TranscriptionCost + video2TranscriptionCost;
      const totalTranscriptionMinutes = (video1Result.transcription.cost?.durationMinutes || 0) + (video2Result.transcription.cost?.durationMinutes || 0);
      
      // 总成本
      const totalCost = totalTranscriptionCost + totalAICost;
      
      console.log(`\n💰 ===== 成本汇总 =====`);
      console.log(`   转录成本: ¥${totalTranscriptionCost.toFixed(2)} (${totalTranscriptionMinutes}分钟)`);
      console.log(`   AI分析成本: ¥${totalAICost.toFixed(4)} (${totalAITokens} tokens)`);
      console.log(`   总成本: ¥${totalCost.toFixed(4)}`);
      console.log(`======================\n`);
      
      // 构建成本详情
      const costBreakdown: import('../types/index.js').CostBreakdown = {
        transcription: {
          service: 'tingwu',
          video1Duration: video1Result.transcription.duration || 0,
          video2Duration: video2Result.transcription.duration || 0,
          totalMinutes: totalTranscriptionMinutes,
          unitPrice: 0.01,
          cost: totalTranscriptionCost,
          currency: 'CNY'
        },
        aiAnalysis: {
          provider: this.getProviderInfo(openai).replace(/[^\w\s-]/g, '').trim(), // 移除emoji
          model: model,
          video1Analysis: {
            promptTokens: video1Usage.promptTokens,
            completionTokens: video1Usage.completionTokens,
            totalTokens: video1Usage.totalTokens,
            cost: video1Usage.cost
          },
          video2Analysis: {
            promptTokens: video2Usage.promptTokens,
            completionTokens: video2Usage.completionTokens,
            totalTokens: video2Usage.totalTokens,
            cost: video2Usage.cost
          },
          comparison: {
            promptTokens: comparisonPromptTokens,
            completionTokens: comparisonCompletionTokens,
            totalTokens: comparisonTotalTokens,
            cost: comparisonCost
          },
          totalTokens: totalAITokens,
          totalCost: totalAICost,
          currency: 'CNY'
        },
        total: {
          cost: totalCost,
          currency: 'CNY',
          breakdown: `转录: ¥${totalTranscriptionCost.toFixed(2)} + AI分析: ¥${totalAICost.toFixed(4)}`
        },
        timestamp: new Date().toISOString()
      };
      
      return {
        ...studentInfo,
        ...analysisData,
        costBreakdown
      };
    } catch (error) {
      console.error('Error comparing videos:', error);
      
      // 如果已经是AppError，直接抛出（不修改context，因为它是只读的）
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        ErrorType.AI_ANALYSIS_ERROR,
        `Failed to generate comparison report: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          originalError: error instanceof Error ? error : undefined,
          userMessage: '生成对比报告失败，请稍后重试',
          context: { studentName: studentInfo.studentName },
        }
      );
    }
  }

  /**
   * 验证并修复发音示例中的重复音标问题
   * 如果 incorrect 和 correct 音标相同，则智能修复音标使其有意义
   */
  private validateAndFixPronunciationExamples(analysisData: any): void {
    if (!analysisData?.improvementAreas?.pronunciation?.examples) {
      return;
    }

    const examples = analysisData.improvementAreas.pronunciation.examples;
    let fixedCount = 0;

    // 规范化音标（移除空格和斜杠，统一比较）
    const normalizePhonetic = (str: string) => this.normalizePhoneticString(str);

    for (const example of examples) {
      const beforeIncorrect = example.incorrect;
      const beforeCorrect = example.correct;
      const incorrectNormalized = normalizePhonetic(example.incorrect || '');
      const correctNormalized = normalizePhonetic(example.correct || '');

      // 如果音标相同或为空，尝试智能修复
      if (!incorrectNormalized || !correctNormalized || incorrectNormalized === correctNormalized) {
        const fixed = this.smartFixPhonetics(example);
        if (fixed) {
          fixedCount++;
          console.log(`🔧 自动修复发音示例: ${example.word}`);
          console.log(`   原始 → incorrect="${beforeIncorrect}", correct="${beforeCorrect}"`);
          console.log(`   修复 → incorrect="${example.incorrect}", correct="${example.correct}"`);
        }
      }
    }

    // 日志输出
    if (fixedCount > 0) {
      console.log(`✅ 发音示例验证完成: ${examples.length} 个示例，其中 ${fixedCount} 个已自动修复`);
    } else {
      console.log(`✅ 发音示例验证完成: 所有 ${examples.length} 个示例均有效`);
    }
  }

  /**
   * 智能修复音标 - 根据常见发音问题自动生成合理的错误音标
   * 返回 true 表示修复成功，false 表示无法修复
   */
  private smartFixPhonetics(example: any): boolean {
    const word = example.word?.toLowerCase() || '';
    const type = example.type || '';
    
    // 如果 correct 为空，尝试从词典获取或保持原样
    if (!example.correct || !example.correct.trim()) {
      // 无法修复，保持原状
      return false;
    }

    // 如果 incorrect 为空或与 correct 相同，根据问题类型生成错误音标
    const correct = example.correct;
    let incorrect = '';

    // 1. th 音问题：/θ/ 或 /ð/ 常被读成 /s/, /z/, /t/, /d/
    if (type.includes('th') || word.includes('th')) {
      if (correct.includes('θ')) {
        incorrect = correct.replace(/θ/g, 's');  // think /θɪŋk/ → /sɪŋk/
      } else if (correct.includes('ð')) {
        incorrect = correct.replace(/ð/g, 'z');  // this /ðɪs/ → /zɪs/
      }
    }
    
    // 2. v/w 音问题：/v/ 常被读成 /w/
    else if ((type.includes('v') || type.includes('w')) && correct.includes('v')) {
      incorrect = correct.replace(/v/g, 'w');  // van /væn/ → /wæn/
    }
    else if ((type.includes('v') || type.includes('w')) && correct.includes('w')) {
      incorrect = correct.replace(/w/g, 'v');  // well /wel/ → /vel/
    }
    
    // 3. l/r 音问题：/l/ 和 /r/ 容易混淆
    else if (type.includes('l') || type.includes('r')) {
      if (correct.includes('l') && !correct.includes('r')) {
        incorrect = correct.replace(/l/g, 'r');  // light /laɪt/ → /raɪt/
      } else if (correct.includes('r') && !correct.includes('l')) {
        incorrect = correct.replace(/r/g, 'l');  // right /raɪt/ → /laɪt/
      }
    }
    
    // 4. 重音问题：移动重音符号位置
    else if (type.includes('重音') || type.includes('stress')) {
      if (correct.includes('ˈ')) {
        // 尝试移动主重音位置
        const parts = correct.split('ˈ');
        if (parts.length >= 2) {
          // 简单处理：把重音移到下一个元音前
          incorrect = correct.replace(/ˈ([^.]+)\./, '$1.ˈ');
          if (incorrect === correct) {
            // 如果没有成功移动，尝试简单地移除重音
            incorrect = correct.replace(/ˈ/g, '');
          }
        }
      }
    }
    
    // 5. 元音问题：替换常见元音
    else if (type.includes('元音') || type.includes('vowel')) {
      // /i:/ → /ɪ/
      if (correct.includes('iː') || correct.includes('i:')) {
        incorrect = correct.replace(/iː|i:/g, 'ɪ');
      }
      // /æ/ → /e/
      else if (correct.includes('æ')) {
        incorrect = correct.replace(/æ/g, 'e');
      }
      // /ɔː/ → /ɒ/
      else if (correct.includes('ɔː') || correct.includes('ɔ:')) {
        incorrect = correct.replace(/ɔː|ɔ:/g, 'ɒ');
      }
      // /aʊ/ → /au/
      else if (correct.includes('aʊ')) {
        incorrect = correct.replace(/aʊ/g, 'au');
      }
    }
    
    // 6. 辅音问题：常见辅音替换
    else if (type.includes('辅音') || type.includes('consonant')) {
      // /ŋ/ → /n/
      if (correct.includes('ŋ')) {
        incorrect = correct.replace(/ŋ/g, 'n');
      }
      // /ʃ/ → /s/
      else if (correct.includes('ʃ')) {
        incorrect = correct.replace(/ʃ/g, 's');
      }
      // /ʒ/ → /z/
      else if (correct.includes('ʒ')) {
        incorrect = correct.replace(/ʒ/g, 'z');
      }
    }
    
    // 7. 通用处理：如果以上都没匹配，尝试基于单词拼写猜测
    if (!incorrect && word) {
      incorrect = this.guessIncorrectPhonetic(word, correct);
    }

    // 8. 终极兜底：若还是相同，强制替换首个元音/辅音，保证不同
    if (!incorrect || this.normalizePhoneticString(incorrect) === this.normalizePhoneticString(correct)) {
      incorrect = this.generateFallbackIncorrect(correct);
    }

    // 如果成功生成了不同的音标，更新并返回成功
    if (
      incorrect &&
      this.normalizePhoneticString(incorrect) !== this.normalizePhoneticString(correct)
    ) {
      example.incorrect = incorrect;
      return true;
    }

    return false;
  }

  /**
   * 基于单词拼写和正确音标，猜测可能的错误发音
   */
  private guessIncorrectPhonetic(word: string, correct: string): string {
    // 如果单词包含 th
    if (word.includes('th')) {
      if (correct.includes('θ')) {
        return correct.replace(/θ/g, 's');
      }
      if (correct.includes('ð')) {
        return correct.replace(/ð/g, 'd');
      }
    }
    
    // 如果单词以 v 开头
    if (word.startsWith('v') && correct.includes('v')) {
      return correct.replace(/^v/, 'w');
    }
    
    // 如果单词包含 r
    if (word.includes('r') && correct.includes('r')) {
      return correct.replace(/r/g, 'l');
    }
    
    // 如果单词包含 l
    if (word.includes('l') && correct.includes('l')) {
      return correct.replace(/l/g, 'r');
    }
    
    // 默认：简化长元音为短元音
    return correct
      .replace(/iː/g, 'ɪ')
      .replace(/uː/g, 'ʊ')
      .replace(/ɑː/g, 'ʌ')
      .replace(/ɔː/g, 'ɒ');
  }

  /**
   * 将音标字符串标准化用于比较
   */
  private normalizePhoneticString(str?: string): string {
    if (!str) return '';
    return str.replace(/[\s\/]/g, '').toLowerCase();
  }

  /**
   * 在所有规则都无法修复时，强制替换至少一个音素，避免与正确音标完全一致
   */
  private generateFallbackIncorrect(correct: string): string {
    if (!correct) {
      return '';
    }

    const replacements: Array<{ pattern: RegExp; replace: string }> = [
      { pattern: /θ/, replace: 's' },
      { pattern: /ð/, replace: 'd' },
      { pattern: /ʃ/, replace: 's' },
      { pattern: /ʒ/, replace: 'z' },
      { pattern: /ŋ/, replace: 'n' },
      { pattern: /tʃ/, replace: 'ts' },
      { pattern: /dʒ/, replace: 'dz' },
    ];

    for (const { pattern, replace } of replacements) {
      if (pattern.test(correct)) {
        const result = correct.replace(pattern, replace);
        if (this.normalizePhoneticString(result) !== this.normalizePhoneticString(correct)) {
          return result;
        }
      }
    }

    const vowelMap: Record<string, string> = {
      'iː': 'ɪ',
      'i:': 'ɪ',
      'uː': 'ʊ',
      'u:': 'ʊ',
      'aɪ': 'æ',
      'eɪ': 'e',
      'aʊ': 'au',
      'əʊ': 'oʊ',
      'ɔː': 'ɒ',
      'ɔ:': 'ɒ',
      'ɑː': 'a',
      'ɑ:': 'a',
      'ɜː': 'ə',
      'ɜ:': 'ə',
      'æ': 'e',
      'ɒ': 'o',
      'ʌ': 'ɑ',
      'ɪ': 'i',
      'ʊ': 'u',
    };

    for (const [pattern, replacement] of Object.entries(vowelMap)) {
      const regex = new RegExp(pattern);
      if (regex.test(correct)) {
        const result = correct.replace(regex, replacement);
        if (this.normalizePhoneticString(result) !== this.normalizePhoneticString(correct)) {
          return result;
        }
      }
    }

    // 最后手动替换第一个英文字母，确保至少一个字符不同
    const fallback = correct.replace(/([a-zɑ-ʊ]+)/i, (match) => {
      if (!match) {
        return `s${match}`;
      }
      const first = match[0];
      const swapMap: Record<string, string> = {
        a: 'e',
        e: 'a',
        i: 'ɪ',
        o: 'u',
        u: 'o',
        b: 'p',
        d: 't',
        g: 'k',
      };
      const replacement = swapMap[first.toLowerCase()] || 'ə';
      const rest = match.slice(1);
      return `${replacement}${rest}`;
    });

    if (this.normalizePhoneticString(fallback) !== this.normalizePhoneticString(correct)) {
      return fallback;
    }

    return `${correct} (var)`;
  }

  /**
   * 验证并修复语法示例中的错误/正确句子重复问题
   */
  private validateAndFixGrammarExamples(analysisData: any): void {
    const examples = analysisData?.improvementAreas?.grammar?.examples;
    if (!examples || examples.length === 0) {
      return;
    }

    let fixedCount = 0;

    for (const example of examples) {
      const beforeIncorrect = example.incorrect;
      const correctNormalized = this.normalizeSentence(example.correct);
      const incorrectNormalized = this.normalizeSentence(example.incorrect);

      if (!correctNormalized) {
        continue;
      }

      if (!incorrectNormalized || incorrectNormalized === correctNormalized) {
        const fixed = this.smartFixGrammarExample(example);
        if (fixed) {
          fixedCount++;
          console.log(`🔁 自动修复语法示例: ${example.category || '未分类'}`);
          console.log(`   原始 → incorrect="${beforeIncorrect}", correct="${example.correct}"`);
          console.log(`   修复 → incorrect="${example.incorrect}"`);
        }
      }
    }

    if (fixedCount > 0) {
      console.log(`✅ 语法示例验证完成: ${examples.length} 个示例，其中 ${fixedCount} 个已自动修复`);
    } else {
      console.log(`✅ 语法示例验证完成: 所有 ${examples.length} 个示例均有效`);
    }
  }

  /**
   * 根据语法错误类型智能生成一个有区别的错误句子
   */
  private smartFixGrammarExample(example: any): boolean {
    const correct = (example.correct || '').trim();
    if (!correct) {
      return false;
    }

    const category = (example.category || '').toLowerCase();
    const generators: Array<() => string | null> = [];

    if (this.matchGrammarCategory(category, ['第三人称', 'third'])) {
      generators.push(() => this.makeThirdPersonError(correct));
    }
    if (this.matchGrammarCategory(category, ['时态', 'tense', '过去', '未来', '完成'])) {
      generators.push(() => this.makeTenseError(correct));
    }
    if (this.matchGrammarCategory(category, ['动词搭配', 'verb', '搭配'])) {
      generators.push(() => this.makeVerbPatternError(correct));
    }
    if (this.matchGrammarCategory(category, ['介词', 'preposition'])) {
      generators.push(() => this.makePrepositionError(correct));
    }
    if (this.matchGrammarCategory(category, ['冠词', 'article'])) {
      generators.push(() => this.makeArticleError(correct));
    }

    generators.push(() => this.makeGeneralGrammarError(correct));

    for (const generator of generators) {
      const candidate = generator();
      if (candidate && this.normalizeSentence(candidate) !== this.normalizeSentence(correct)) {
        example.incorrect = candidate;
        return true;
      }
    }

    return false;
  }

  private matchGrammarCategory(category: string, keywords: string[]): boolean {
    if (!category) {
      return false;
    }
    return keywords.some(keyword => category.includes(keyword));
  }

  private makeThirdPersonError(sentence: string): string | null {
    const regex = /\b([A-Za-z]+?)(ies|es|s)\b/;
    const match = sentence.match(regex);
    if (!match) {
      return null;
    }

    const original = match[0];
    const base = this.deInflectThirdPerson(original);
    if (base === original) {
      return null;
    }

    return sentence.replace(original, base);
  }

  private deInflectThirdPerson(word: string): string {
    const lower = word.toLowerCase();
    if (lower.endsWith('ies')) {
      return word.slice(0, -3) + 'y';
    }
    if (lower.endsWith('es')) {
      return word.slice(0, -2);
    }
    if (lower.endsWith('s')) {
      return word.slice(0, -1);
    }
    return word;
  }

  private makeTenseError(sentence: string): string | null {
    return this.applyGrammarReplacementRules(sentence, [
      { pattern: /\bwent\b/i, replace: 'go' },
      { pattern: /\bgo\b/i, replace: 'went' },
      { pattern: /\bwas\b/i, replace: 'is' },
      { pattern: /\bwere\b/i, replace: 'are' },
      { pattern: /\bhad\b/i, replace: 'has' },
      { pattern: /\bhas\b/i, replace: 'have' },
      { pattern: /\bdid\b/i, replace: 'do' },
      { pattern: /\bplayed\b/i, replace: 'play' },
      { pattern: /\bfinished\b/i, replace: 'finish' }
    ]);
  }

  private makeVerbPatternError(sentence: string): string | null {
    const candidate = this.applyGrammarReplacementRules(sentence, [
      { pattern: /\bto\s+([A-Za-z]+)\b/, replace: '$1' },
      { pattern: /\b(is|are)\s+(\w+ing)\b/i, replace: '$1 to $2' },
      { pattern: /\b(want|needs)\s+to\b/i, replace: '$1' }
    ]);

    if (candidate) {
      return candidate;
    }

    return null;
  }

  private makePrepositionError(sentence: string): string | null {
    return this.applyGrammarReplacementRules(sentence, [
      { pattern: /\bon\b/i, replace: 'in' },
      { pattern: /\bin\b/i, replace: 'on' },
      { pattern: /\bat\b/i, replace: 'in' },
      { pattern: /\bfor\b/i, replace: 'to' }
    ]);
  }

  private makeArticleError(sentence: string): string | null {
    const match = sentence.match(/\b(an?|the)\b/i);
    if (!match) {
      return null;
    }

    const result = sentence.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
    return result;
  }

  private makeGeneralGrammarError(sentence: string): string | null {
    const articleRemoved = this.makeArticleError(sentence);
    if (articleRemoved && this.normalizeSentence(articleRemoved) !== this.normalizeSentence(sentence)) {
      return articleRemoved;
    }

    const replacement = this.applyGrammarReplacementRules(sentence, [
      { pattern: /\bis\b/i, replace: 'are' },
      { pattern: /\bare\b/i, replace: 'is' },
      { pattern: /\bhave\b/i, replace: 'has' },
      { pattern: /\bhas\b/i, replace: 'have' }
    ]);

    if (replacement) {
      return replacement;
    }

    // 最后兜底：重复第一个单词，制造语法问题
    const duplicated = sentence.replace(/\b(\w+)\b/, '$1 $1');
    if (this.normalizeSentence(duplicated) !== this.normalizeSentence(sentence)) {
      return duplicated;
    }

    return null;
  }

  private applyGrammarReplacementRules(
    sentence: string,
    rules: Array<{ pattern: RegExp; replace: string | ((substring: string, ...args: any[]) => string) }>
  ): string | null {
    for (const rule of rules) {
      if (rule.pattern.test(sentence)) {
        const next = sentence.replace(rule.pattern, rule.replace as any);
        if (this.normalizeSentence(next) !== this.normalizeSentence(sentence)) {
          return next;
        }
      }
    }
    return null;
  }

  private normalizeSentence(str?: string): string {
    if (!str) {
      return '';
    }
    return str.replace(/[^a-z0-9]/gi, '').toLowerCase();
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

    // 获取 AI 客户端（GLM）
    const openai = this.getOpenAIClient(request.apiKey);
    if (!openai) {
      throw new AppError(
        ErrorType.API_KEY_ERROR,
        'No GLM API key available',
        {
          userMessage: '未提供GLM API密钥。请提供GLM API密钥或使用模拟数据模式。',
          context: { studentName: request.studentName },
        }
      );
    }

    // 否则使用真实的OpenAI API
    try {
      console.log('🚀 Starting real AI video analysis for:', request.studentName);
      console.log('📹 Video 1:', request.video1);
      console.log('📹 Video 2:', request.video2);

      // 2. 🚀 超级并行：让所有可并行的步骤都并行执行
      console.log('\n=== 🚀 超级并行分析：下载、转录、分析全部并行 ===');
      const overallStartTime = Date.now();
      
      // 视频处理状态跟踪
      const videoStatus = {
        video1: { transcribing: false, analyzing: false, completed: false },
        video2: { transcribing: false, analyzing: false, completed: false }
      };
      
      // 添加进度监控 - 显示每个视频的详细状态
      const progressInterval = setInterval(() => {
        const elapsed = ((Date.now() - overallStartTime) / 1000).toFixed(0);
        const v1Status = videoStatus.video1.completed ? '✅ 已完成' : 
                        videoStatus.video1.analyzing ? '🤖 分析中' :
                        videoStatus.video1.transcribing ? '📝 转录中' : '⏳ 等待中';
        const v2Status = videoStatus.video2.completed ? '✅ 已完成' : 
                        videoStatus.video2.analyzing ? '🤖 分析中' :
                        videoStatus.video2.transcribing ? '📝 转录中' : '⏳ 等待中';
        console.log(`⏳ 视频分析进行中... 已耗时: ${elapsed}秒 | 视频1: ${v1Status} | 视频2: ${v2Status}`);
      }, 15000); // 每15秒打印一次进度
      
      let video1Result, video2Result;
      try {
        // 🔥 流水线模式：每个视频转录完成后立即开始分析，无需等待其他视频
        console.log('\n🎯 [流水线] 转录和分析流水线执行（转录完成即开始分析）...');
        const transcribeStartTime = Date.now();
        
        // 并行执行两个视频的完整流程（转录 → 分析）
        const transcriptionLanguage =
          request.language ||
          process.env.TINGWU_LANGUAGE ||
          'en';
        console.log(`🌐 使用转录语言: ${transcriptionLanguage}`);
        const requestedSpeakerCount = request.speakerCount ?? 3;
        console.log(`👥 说话人数量（可配置）: ${requestedSpeakerCount}`);

        const [result1, result2] = await Promise.all([
          (async () => {
            console.log('📥 [视频1] 开始转录...');
            videoStatus.video1.transcribing = true;
            const transcription1 = await this.transcribeVideoSmart(
              request.video1,
              'Video 1',
              transcriptionLanguage,
              requestedSpeakerCount
            );
            console.log('✅ [视频1] 转录完成');
            
            // 验证转录结果
            if (!transcription1.text || transcription1.text.trim().length === 0) {
              throw new AppError(
                ErrorType.TRANSCRIPTION_ERROR,
                '第一个视频转录失败：未提取到任何文本内容',
                {
                  userMessage: '第一个视频转录失败：未提取到任何文本内容。可能原因：1) 视频中没有语音 2) 视频链接无效 3) 转录服务异常',
                  context: { studentName: request.studentName, videoNumber: 1 },
                }
              );
            }
            console.log(`📝 [视频1] 转录文本长度: ${transcription1.text.length} 字符`);
            
            // 转录完成后立即开始分析（不等待 Video 2）
            videoStatus.video1.transcribing = false;
            videoStatus.video1.analyzing = true;
            console.log('🤖 [视频1] 开始分析...');
            const analysis1Text = await this.analyzeTranscriptionWithGPT(transcription1, openai, 'Video 1');
            console.log('✅ [视频1] 分析完成');
            videoStatus.video1.analyzing = false;
            videoStatus.video1.completed = true;
            
            return { 
              transcription: transcription1, 
              analysis: analysis1Text.analysis,
              usage: analysis1Text.usage
            };
          })(),
          (async () => {
            console.log('📥 [视频2] 开始转录...');
            videoStatus.video2.transcribing = true;
            const transcription2 = await this.transcribeVideoSmart(
              request.video2,
              'Video 2',
              transcriptionLanguage,
              requestedSpeakerCount
            );
            console.log('✅ [视频2] 转录完成');
            
            // 验证转录结果
            if (!transcription2.text || transcription2.text.trim().length === 0) {
              throw new AppError(
                ErrorType.TRANSCRIPTION_ERROR,
                '第二个视频转录失败：未提取到任何文本内容',
                {
                  userMessage: '第二个视频转录失败：未提取到任何文本内容。可能原因：1) 视频中没有语音 2) 视频链接无效 3) 转录服务异常',
                  context: { studentName: request.studentName, videoNumber: 2 },
                }
              );
            }
            console.log(`📝 [视频2] 转录文本长度: ${transcription2.text.length} 字符`);
            
            // 转录完成后立即开始分析（不等待 Video 1）
            videoStatus.video2.transcribing = false;
            videoStatus.video2.analyzing = true;
            console.log('🤖 [视频2] 开始分析...');
            const analysis2Text = await this.analyzeTranscriptionWithGPT(transcription2, openai, 'Video 2');
            console.log('✅ [视频2] 分析完成');
            videoStatus.video2.analyzing = false;
            videoStatus.video2.completed = true;
            
            return { 
              transcription: transcription2, 
              analysis: analysis2Text.analysis,
              usage: analysis2Text.usage
            };
          })()
        ]);
        
        video1Result = result1;
        video2Result = result2;
        
        const totalTime = ((Date.now() - overallStartTime) / 1000).toFixed(1);
        const transcribeTime = ((Date.now() - transcribeStartTime) / 1000).toFixed(1);
        console.log(`✅ 所有视频转录和分析完成！总耗时: ${totalTime}秒`);
        // 显示使用的服务统计
        console.log(`💰 当前通义听悟剩余免费额度: ${tingwuTranscriptionService.getStats().remainingMinutes} 分钟/天\n`);
        
        clearInterval(progressInterval);
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
          studentId: request.studentId,
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
      
      // 记录报告到数据库（异步，不阻塞返回）
      if (report.costBreakdown) {
        // 合并两个视频的转录文本
        const combinedTranscript = [
          `=== 第一个视频转录 (${request.video1Time || '未知时间'}) ===`,
          video1Result.transcription.text,
          '',
          `=== 第二个视频转录 (${request.video2Time || '未知时间'}) ===`,
          video2Result.transcription.text
        ].join('\n');
        
        // 计算总音频时长（秒）
        const totalDuration = (video1Result.transcription.duration || 0) + (video2Result.transcription.duration || 0);
        
        reportRecordService.recordReport({
          userId: request.userId,
          studentName: request.studentName,
          studentId: request.studentId,
          videoUrl: `${request.video1};${request.video2}`, // 用分号分隔两个视频URL
          transcript: combinedTranscript,
          audioDur: Math.round(totalDuration),
          fileName: `${request.studentName}_${new Date().toISOString().split('T')[0]}`,
          fileUrl: request.video1, // 使用第一个视频作为主要链接
          costDetail: report.costBreakdown,
          analysisData: report // 保存完整的报告数据
        }).catch(err => {
          console.error('⚠️ 报告记录保存失败（不影响主流程）:', err.message);
        });
      }
      
      return report;
    } catch (error) {
      console.error('❌ Error in analyzeVideos:', error);
      
      // 如果已经是AppError，直接抛出（不修改context，因为它是只读的）
      if (error instanceof AppError) {
        throw error;
      }
      
      // 根据错误消息推断错误类型
      const errorMessage = error instanceof Error ? error.message : String(error);
      let errorType = ErrorType.INTERNAL_ERROR;
      let userMessage = '视频分析失败，请稍后重试';
      
      if (errorMessage.includes('transcribe') || errorMessage.includes('转录')) {
        errorType = ErrorType.TRANSCRIPTION_ERROR;
        userMessage = '视频转录失败，请确保视频链接可访问，且包含音频内容';
      } else if (errorMessage.includes('API key') || errorMessage.includes('API Key')) {
        errorType = ErrorType.API_KEY_ERROR;
        userMessage = 'API密钥无效或未配置，请检查配置';
      } else if (errorMessage.includes('download') || errorMessage.includes('下载')) {
        errorType = ErrorType.VIDEO_PROCESSING_ERROR;
        userMessage = '视频下载失败，请检查视频链接是否正确';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
        errorType = ErrorType.TIMEOUT_ERROR;
        userMessage = '请求超时，请尝试使用较短的视频（建议3-5分钟）';
      }
      
      throw new AppError(
        errorType,
        errorMessage,
        {
          originalError: error instanceof Error ? error : undefined,
          userMessage,
          context: { studentName: request.studentName },
        }
      );
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
      studentId: request.studentId,
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

