import OpenAI from 'openai';
import axios from 'axios';
import { VideoAnalysisRequest, VideoAnalysisResponse } from '../types';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { WhisperService, TranscriptionResult } from './whisperService';

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
   * 使用 Whisper API 转录视频，然后用 GPT-4 分析内容
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

      // 2. 分析转录文本的基本特征
      const textAnalysis = this.whisperService.analyzeTranscription(transcription.text);
      
      // 3. 使用 GPT-4 进行深度分析
      console.log(`🤖 Analyzing ${videoLabel} content with GPT-4...`);
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `你是一位专业的英语教学专家，擅长分析学生的英语学习表现。
你会收到一段英语学习课堂的语音转录文本，请详细分析学生的英语能力和表现。`
          },
          {
            role: "user",
            content: `请分析以下英语学习课堂的转录文本：

【转录文本】
${transcription.text}

【基本统计】
- 总词数: ${textAnalysis.wordCount}
- 句子数: ${textAnalysis.sentenceCount}
- 平均每句词数: ${textAnalysis.averageWordsPerSentence.toFixed(1)}
- 独特词汇数: ${textAnalysis.uniqueWords}
- 视频时长: ${transcription.duration ? `${Math.round(transcription.duration)}秒` : '未知'}

请从以下方面进行分析：
1. 回答长度和完整性
2. 语言流利度（根据转录文本判断）
3. 词汇运用能力
4. 句型复杂度
5. 语法错误（如果有）
6. 发音问题（Whisper 可能识别的错误）
7. 整体参与度和积极性

请以JSON格式返回分析结果：
{
  "wordCount": 数字,
  "sentenceCount": 数字,
  "fluency": "分析文字",
  "vocabulary": "分析文字",
  "grammar": "分析文字",
  "participation": "分析文字",
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["待改进1", "待改进2"]
}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000
      });

      const analysisText = response.choices[0]?.message?.content || '{}';
      console.log(`✅ Analysis complete for ${videoLabel}`);
      
      return {
        transcription,
        analysis: analysisText
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
    studentInfo: { studentName: string; grade: string; level: string; unit: string },
    openai: OpenAI
  ): Promise<VideoAnalysisResponse> {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    try {
      const video1Analysis = JSON.parse(video1Result.analysis);
      const video2Analysis = JSON.parse(video2Result.analysis);

      const prompt = `作为一名专业的英语教学专家，请比较学生 ${studentInfo.studentName}（${studentInfo.grade}，${studentInfo.level}）的两个学习视频，生成详细的学习分析报告。

学生信息：
- 姓名：${studentInfo.studentName}
- 年级：${studentInfo.grade}
- 级别：${studentInfo.level}
- 单元：${studentInfo.unit}

【第一个视频】（较早的课堂）
转录文本：
${video1Result.transcription.text}

分析结果：
${JSON.stringify(video1Analysis, null, 2)}

【第二个视频】（较新的课堂）
转录文本：
${video2Result.transcription.text}

分析结果：
${JSON.stringify(video2Analysis, null, 2)}

请按照以下JSON格式提供完整且详细的分析报告，确保每个部分都有实质性的内容：

{
  "learningData": {
    "handRaising": {
      "trend": "提升/下降/持平",
      "percentage": "变化百分比（如 +15%）",
      "analysis": "详细分析举手次数的变化及其反映的学习态度"
    },
    "answerLength": {
      "trend": "提升/下降/持平",
      "percentage": "变化百分比",
      "analysis": "详细分析回答长度的变化"
    },
    "completeSentences": {
      "trend": "提升/下降/持平",
      "percentage": "变化百分比",
      "analysis": "详细分析完整句子使用情况的变化"
    },
    "readingAccuracy": {
      "trend": "提升/下降/持平",
      "percentage": "变化百分比",
      "analysis": "详细分析阅读准确度的变化"
    }
  },
  "progressDimensions": {
    "fluency": {
      "analysis": "流利度分析，包括语速、停顿、连贯性等方面的进步",
      "example": "具体例子，引用学生在两个视频中的表现对比"
    },
    "confidence": {
      "analysis": "自信心分析，包括声音大小、表达主动性等方面的进步",
      "example": "具体例子"
    },
    "languageApplication": {
      "analysis": "语言运用分析，包括词汇量、语法使用等方面的进步",
      "example": "具体例子"
    },
    "sentenceComplexity": {
      "analysis": "句子复杂度分析，包括句式结构、从句使用等方面的进步",
      "example": "具体例子"
    }
  },
  "improvementAreas": {
    "pronunciation": {
      "overview": "发音方面的总体评价和主要问题",
      "details": "详细的发音问题分析，包括具体的音标、单词等",
      "examples": [
        {
          "word": "单词（如 'think'）",
          "incorrect": "学生的错误发音（如 'tink'）",
          "correct": "正确发音（如 /θɪŋk/）",
          "type": "问题类型（如 '咬舌音'）"
        }
      ],
      "suggestions": [
        {
          "title": "建议标题（如 '咬舌音练习'）",
          "description": "详细的练习建议和方法"
        }
      ]
    },
    "grammar": {
      "overview": "语法方面的总体评价和主要问题",
      "details": "详细的语法问题分析，包括时态、单复数、句式等",
      "examples": [
        {
          "sentence": "学生说的错误句子",
          "error": "具体的语法错误",
          "correction": "正确的句子",
          "rule": "相关的语法规则说明"
        }
      ],
      "suggestions": [
        {
          "title": "建议标题（如 '时态练习'）",
          "description": "详细的练习建议，包括具体的练习方法和例句"
        }
      ]
    },
    "intonation": {
      "overview": "语调和节奏方面的总体评价",
      "details": "详细的语调节奏分析，包括重音、升降调、语速等",
      "examples": [
        {
          "sentence": "示例句子",
          "issue": "语调问题描述",
          "improvement": "改进建议"
        }
      ],
      "suggestions": [
        {
          "title": "建议标题（如 '疑问句语调练习'）",
          "description": "详细的练习建议，包括具体的练习句子和方法"
        }
      ]
    }
  }
}

重要提示：
1. 请确保每个部分都有实质性的内容，不要留空或只写占位符
2. 对于 grammar 和 intonation 部分，请基于转录文本提供至少2-3个具体的例子和建议
3. 所有的分析都应该基于两个视频的对比，突出学生的进步或需要改进的地方
4. 确保返回有效的JSON格式，不要包含注释或其他非JSON内容`;

      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
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

      // 2. 使用 Whisper + GPT-4 分析两个视频
      console.log('\n=== 分析第一个视频（较早课堂）===');
      const video1Result = await this.analyzeVideoContent(request.video1, openai, 'Video 1 (Earlier)');
      
      console.log('\n=== 分析第二个视频（较新课堂）===');
      const video2Result = await this.analyzeVideoContent(request.video2, openai, 'Video 2 (Later)');

      // 3. 比较并生成报告
      console.log('\n=== 生成对比报告 ===');
      const report = await this.compareVideos(
        video1Result,
        video2Result,
        {
          studentName: request.studentName,
          grade: request.grade,
          level: request.level,
          unit: request.unit
        },
        openai
      );

      console.log('✅ Analysis complete for:', request.studentName);
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
          analysis: "学生的语言流利度有明显提升，说话时停顿减少，能够更自然地表达想法。",
          example: "第二个视频中回答问题时，能够流畅地说出完整句子。"
        },
        confidence: {
          analysis: "自信心增强明显，声音洪亮，眼神交流更加自然。",
          example: "主动要求回答老师提问，并在回答时面带微笑。"
        },
        languageApplication: {
          analysis: "开始尝试使用课堂外学到的词汇和表达。",
          example: "使用了更丰富的词汇来描述活动。"
        },
        sentenceComplexity: {
          analysis: "句型结构更加复杂，开始使用复合句和连接词。",
          example: "能够说出包含原因和结果的复杂句子。"
        }
      },
      improvementAreas: {
        pronunciation: {
          overview: "这是目前最需要关注的系统提升的方面。",
          details: "由于连读加快，一些单词的发音细节容易被忽略。",
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
            }
          ],
          suggestions: [
            {
              title: "慢下来",
              description: "在连读新词时，可以刻意放慢语速。"
            },
            {
              title: "跟读模仿",
              description: "找到标准发音，进行多次跟读模仿。"
            }
          ]
        },
        grammar: {
          overview: "整体语法很好，但在一些细节上可以做得更完美。",
          examples: [
            {
              category: "第三人称单数",
              incorrect: "She is feeds her cat",
              correct: "She feeds her cat",
              explanation: "应当使用动词原形加s的形式"
            }
          ],
          suggestions: [
            {
              point: "在口语练习前，可以进行简短的语法复习。"
            }
          ]
        },
        intonation: {
          observation: "语调起伏较少，听起来略显平淡。",
          suggestions: [
            {
              point: "多听自然的英语对话，感受和模仿语调变化。"
            }
          ]
        }
      }
    };
  }
}

