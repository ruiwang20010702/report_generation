/**
 * 📝 转录分析模块
 * 负责视频转录和单视频分析
 */

import OpenAI from 'openai';
import { TranscriptionResult, WhisperService } from '../whisperService.js';
import { tingwuTranscriptionService } from '../tingwuTranscriptionService.js';
import { AppError, ErrorType } from '../../utils/errors.js';
import { withRetry, type AICallConfig } from '../../utils/aiServiceWrapper.js';
import { calculateAICost } from './config.js';
import { getModelName, getProviderInfo } from './aiClient.js';

/**
 * 🚀 使用通义听悟进行视频转录
 * 通义听悟：价格便宜，免费额度高（每天2小时），超出后自动使用付费额度
 */
export async function transcribeVideoSmart(
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
 * 使用 GLM-4-Plus 分析转录文本
 * 返回：{ analysis: string, usage: { promptTokens, completionTokens, totalTokens, cost } }
 */
export async function analyzeTranscriptionWithGPT(
  transcription: TranscriptionResult,
  openai: OpenAI,
  videoLabel: string = 'video',
  whisperService: WhisperService
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
    const textAnalysis = whisperService.analyzeTranscription(transcription.text);
    
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
    const model = getModelName(openai);
    const provider = getProviderInfo(openai);
    console.log(`${provider} 正在分析 ${videoLabel}，模型: ${model}`);
    
    // 使用重试机制调用 AI
    const aiCallConfig: AICallConfig = {
      maxRetries: 3,
      retryDelayBase: 2000,
      timeout: 120000, // 2分钟超时
      operationLabel: `单视频分析(${videoLabel})`,
    };
    
    const response = await withRetry(
      () => openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `你是一位专业的英语教学专家，擅长分析1对1教学场景中学生的英语学习表现。
你会收到一段英语学习课堂的语音转录文本（包含老师和学生的对话），请详细分析学生的英语能力和表现。
重点分析：学生的发言内容、主动性、语言能力等，而非老师的教学内容。

🔴🔴🔴 **关键要求（必须遵守）：** 🔴🔴🔴

1. **你必须从对话内容中推断老师和学生的角色**：
   - 通常提问、引导、纠正的是老师（如 "What's this?", "Can you say...?", "Good job!"）
   - 通常回答、跟读、模仿的是学生（如 "Yes", "It's a cat", "I like..."）
   - 即使转录没有标注说话人，你也必须根据对话内容和上下文推断

2. **你必须返回包含准确数字的关键字段**：
   - handRaising：学生主动回答次数（即使只是 Yes/No 或跟读也算）
   - answerLength：学生平均每次回答的词数
   - completeSentences：学生说出完整句子的次数
   - readingAccuracy：学生的发音/语法准确率

3. **禁止返回全 0 的数据**：
   - 如果转录文本有内容，学生一定有发言
   - 即使无法精确计算，也必须给出合理的估算值
   - 返回全 0 会导致后续分析失败！`
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
  "handRaising": {
    "count": 学生主动回答或发言的次数（数字，包括Yes/No和跟读），
    "percentage": 学生发言占总对话的百分比（数字，0-100）
  },
  "answerLength": {
    "average": 学生平均每次回答的词数（数字，保留1位小数）
  },
  "completeSentences": {
    "count": 学生说出完整句子（有主谓宾结构）的次数（数字），
    "percentage": 完整句占总回答次数的百分比（数字，0-100）
  },
  "readingAccuracy": {
    "correctRate": 根据转录文本推测的学生发音和语法准确率（数字，0-100）
  },
  "fluency": "口语流利度的详细分析（融入量化数据和具体案例），包括：1) 流利度评分或描述；2) 语速和停顿情况；3) 连贯性分析；4) 具体进步表现（如果有）。至少100词。",
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
  ],
  "pronunciationWords": ["word1", "word2", "word3"]
}

🔴🔴🔴 **强制要求（必须遵守）：** 🔴🔴🔴

**一、角色识别规则（即使转录没有标注说话人）：**
- 老师特征：提问句（What/How/Can you...?）、引导语（Let's...、Try to...）、表扬语（Good job!、Well done!）、纠正语（No, it's...）
- 学生特征：回答句（Yes/No、It's...、I like...）、跟读内容、简短回应（OK、Yeah）
- 在1对1课堂中，通常老师说话更多，学生回答较短但次数不少

**二、关键字段强制要求：**

1. **handRaising 字段是强制的：**
   - count：整数，学生发言次数（包括 Yes/No、跟读、简短回答），**不能为 0**（除非转录完全为空）
   - percentage：0-100，学生发言占比

2. **answerLength 字段是强制的：**
   - average：数字，学生平均每次回答的词数，**不能为 0**

3. **completeSentences 字段是强制的：**
   - count：整数，学生说出完整句子的次数
   - percentage：0-100，完整句占比

4. **readingAccuracy 字段是强制的：**
   - correctRate：0-100，学生准确率，**不能为 0**（正常学生至少有 60-80% 准确率）

**三、禁止返回全 0：**
❌ 如果你返回 handRaising.count=0、answerLength.average=0、readingAccuracy.correctRate=0，这意味着学生完全没有发言，这在正常课堂中是不可能的！
✅ 即使无法精确计算，也必须根据对话内容给出合理估算值
✅ 例如：如果对话中有 10 个问答回合，学生至少回答了 10 次，平均每次 2-3 词

**四、pronunciationWords 字段（必须提供3个单词）：**
- 从学生的发言中提取 **3个英文单词**，优先选择你认为学生可能发音有问题的单词
- 选择标准（按优先级）：
  1. 包含 th 音的单词（如 think, this, that, three, with）
  2. 包含 v/w 音的单词（如 very, van, video, want, what）
  3. 包含 r/l 音的单词（如 really, little, read, look）
  4. 包含复杂元音的单词（如 found, about, teacher）
  5. 其他学生实际说过的名词或动词
- 这些单词必须是学生在对话中**实际说过**的词！
- 如果找不到发音难点词，就选择文本中常见的名词或动词，但不要使用示例中的单词。

⚠️ 这些数据将用于后续的对比分析，是生成个性化学习建议的关键依据！返回全 0 会导致整个报告失败！`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,  // 极低温度确保 AI 严格遵守 JSON schema，特别是 handRaising/answerLength/completeSentences/readingAccuracy 等关键数字字段
      max_tokens: 4000
    }),
      aiCallConfig
    );

    const analysisText = response.choices[0]?.message?.content || '{}';
    
    // 🔍 调试日志：查看单视频分析返回的原始数据
    try {
      const parsedAnalysis = JSON.parse(analysisText);
      console.log(`🔍 [单视频分析] ${videoLabel} 返回的关键字段:`, {
        handRaising: parsedAnalysis.handRaising,
        answerLength: parsedAnalysis.answerLength,
        completeSentences: parsedAnalysis.completeSentences,
        readingAccuracy: parsedAnalysis.readingAccuracy
      });
    } catch (e) {
      console.error(`❌ [单视频分析] ${videoLabel} 返回的JSON解析失败`);
    }
    
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

