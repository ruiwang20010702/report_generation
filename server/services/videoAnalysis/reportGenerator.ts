/**
 * 📊 报告生成模块
 * 负责生成对比报告
 */

import OpenAI from 'openai';
import { AppError, ErrorType } from '../../utils/errors.js';
import { withRetry, type AICallConfig } from '../../utils/aiServiceWrapper.js';
import { REPORT_WORD_COUNT, calculateAICost, type PostProcessingUsage, createEmptyUsage } from './config.js';
import { getModelName, getProviderInfo } from './aiClient.js';
import {
  validateAndFixPronunciationExamples,
  validateAndFixGrammarExamples,
  validateAndFixNegativePercentages,
  validateAndFixDataConsistency,
  normalizeLearningData
} from './dataValidator.js';
import type { SingleVideoResult, StudentInfo } from './types.js';
import type { VideoAnalysisResponse, CostBreakdown } from '../../types/index.js';

/**
 * 🔍 提取学生说过的所有英文单词（用于发音示例验证）
 */
function extractStudentWords(utterances: any[] | undefined): string[] {
  if (!utterances) return [];
  const studentWords = new Set<string>();
  
  const speakers = new Set(utterances.map(u => u.speaker).filter(Boolean));
  const hasSingleSpeaker = speakers.size <= 1;
  
  if (hasSingleSpeaker) {
    console.log('📝 [发音分析] 检测到单一speaker，启用名词提取模式');
    
    // 常见英语名词列表（教育场景常用）
    const commonNouns = new Set([
      // 动物
      'cat', 'dog', 'bird', 'fish', 'rabbit', 'mouse', 'elephant', 'lion', 'tiger', 'bear',
      'monkey', 'horse', 'cow', 'pig', 'sheep', 'chicken', 'duck', 'frog', 'snake', 'turtle',
      'butterfly', 'bee', 'ant', 'spider', 'whale', 'dolphin', 'shark', 'penguin', 'panda', 'giraffe',
      // 食物
      'apple', 'banana', 'orange', 'grape', 'strawberry', 'watermelon', 'mango', 'peach', 'pear', 'lemon',
      'bread', 'rice', 'noodle', 'cake', 'cookie', 'candy', 'chocolate', 'pizza', 'burger', 'sandwich',
      'egg', 'milk', 'juice', 'water', 'tea', 'coffee', 'soup', 'salad', 'cheese', 'butter',
      'meat', 'chicken', 'fish', 'vegetable', 'carrot', 'tomato', 'potato', 'onion', 'corn', 'bean',
      // 家庭/人物
      'mother', 'father', 'mom', 'dad', 'sister', 'brother', 'grandmother', 'grandfather', 'grandma', 'grandpa',
      'baby', 'child', 'children', 'boy', 'girl', 'man', 'woman', 'friend', 'teacher', 'student',
      'doctor', 'nurse', 'police', 'fireman', 'driver', 'farmer', 'chef', 'singer', 'dancer', 'artist',
      // 身体部位
      'head', 'hair', 'face', 'eye', 'eyes', 'nose', 'mouth', 'ear', 'ears', 'hand', 'hands',
      'arm', 'arms', 'leg', 'legs', 'foot', 'feet', 'finger', 'fingers', 'toe', 'toes',
      // 物品/日常用品
      'book', 'pen', 'pencil', 'paper', 'bag', 'desk', 'chair', 'table', 'door', 'window',
      'bed', 'lamp', 'clock', 'phone', 'computer', 'television', 'camera', 'ball', 'toy', 'game',
      'car', 'bus', 'train', 'plane', 'bike', 'boat', 'ship', 'truck', 'taxi', 'subway',
      'house', 'home', 'room', 'kitchen', 'bathroom', 'bedroom', 'garden', 'park', 'school', 'hospital',
      // 衣物
      'shirt', 'pants', 'dress', 'skirt', 'jacket', 'coat', 'hat', 'cap', 'shoes', 'socks',
      'gloves', 'scarf', 'glasses', 'watch', 'ring', 'necklace', 'bag', 'umbrella',
      // 自然/天气
      'sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'wind', 'sky', 'tree', 'flower',
      'grass', 'leaf', 'river', 'lake', 'sea', 'ocean', 'mountain', 'hill', 'forest', 'beach',
      // 颜色
      'color', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'brown', 'gray',
      // 数字/时间相关
      'number', 'time', 'day', 'week', 'month', 'year', 'morning', 'afternoon', 'evening', 'night',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      // 学校相关
      'class', 'lesson', 'homework', 'test', 'exam', 'question', 'answer', 'word', 'sentence', 'story',
      'picture', 'drawing', 'music', 'song', 'dance', 'sport', 'game', 'playground',
      // 其他常见名词
      'thing', 'place', 'way', 'world', 'country', 'city', 'town', 'street', 'road',
      'idea', 'problem', 'example', 'reason', 'fact', 'information', 'news', 'weather',
      'family', 'group', 'team', 'party', 'meeting', 'birthday', 'holiday', 'vacation', 'trip', 'adventure',
      // 抽象名词
      'love', 'happiness', 'fun', 'joy', 'hope', 'dream', 'wish', 'surprise', 'secret', 'magic',
    ]);
    
    utterances.forEach(utterance => {
      const text = (utterance.text || '').toLowerCase();
      const words = text.match(/[a-zA-Z]{2,}/g) || [];
      words.forEach((word: string) => {
        const wordLower = word.toLowerCase();
        if (commonNouns.has(wordLower)) {
          studentWords.add(wordLower);
        }
      });
    });
    
    console.log(`   从转录文本中提取了 ${studentWords.size} 个名词`);
  } else {
    utterances.forEach(utterance => {
      if (utterance.speaker === 'Student' || utterance.speaker === '学生') {
        const words = (utterance.text || '').match(/[a-zA-Z]{2,}/g) || [];
        words.forEach((word: string) => studentWords.add(word.toLowerCase()));
      }
    });
  }
  
  return Array.from(studentWords).sort();
}

/**
 * 计算变化百分比（相对变化率）
 * 用于非百分比指标，如次数、词数等
 */
function calculateChange(oldVal: number | undefined | null, newVal: number | undefined | null): string {
  // 确保值是有效数字
  const oldNum = Number(oldVal) || 0;
  const newNum = Number(newVal) || 0;
  
  if (oldNum === 0) return newNum > 0 ? '+100%' : '0%';
  
  const changeValue = (newNum - oldNum) / oldNum * 100;
  
  // 防止 NaN 或 Infinity
  if (!isFinite(changeValue)) return '0%';
  
  const changeStr = changeValue.toFixed(0);
  return changeValue >= 0 ? `+${changeStr}%` : `${changeStr}%`;
}

/**
 * 计算百分比指标的差值（绝对差值）
 * 用于已经是百分比的指标，如完整句子率、阅读准确率等
 * 例如：从80%提升到88%，应该显示+8%而不是+10%
 */
function calculatePercentageDiff(oldVal: number | undefined | null, newVal: number | undefined | null): string {
  const oldNum = Number(oldVal) || 0;
  const newNum = Number(newVal) || 0;
  
  const diff = newNum - oldNum;
  const diffStr = Math.round(diff).toString();
  
  return diff >= 0 ? `+${diffStr}%` : `${diffStr}%`;
}

/**
 * 比较两个视频，生成进步分析
 */
export async function compareVideos(
  video1Result: SingleVideoResult,
  video2Result: SingleVideoResult,
  studentInfo: StudentInfo,
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

    let video1Analysis: any;
    let video2Analysis: any;
    
    try {
      video1Analysis = JSON.parse(video1Result.analysis);
    } catch (parseError) {
      throw new AppError(
        ErrorType.AI_ANALYSIS_ERROR,
        `第一个视频的分析结果解析失败: ${parseError instanceof Error ? parseError.message : 'JSON格式错误'}`,
        {
          userMessage: '第一个视频的分析结果格式错误，请重试',
          context: { studentName: studentInfo.studentName, videoNumber: 1 },
        }
      );
    }
    
    try {
      video2Analysis = JSON.parse(video2Result.analysis);
    } catch (parseError) {
      throw new AppError(
        ErrorType.AI_ANALYSIS_ERROR,
        `第二个视频的分析结果解析失败: ${parseError instanceof Error ? parseError.message : 'JSON格式错误'}`,
        {
          userMessage: '第二个视频的分析结果格式错误，请重试',
          context: { studentName: studentInfo.studentName, videoNumber: 2 },
        }
      );
    }
    
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

    // 提取学生说过的单词（用于验证发音示例的来源）
    // 1. 从转录文本中提取所有学生说过的单词
    const video1ExtractedWords = extractStudentWords(video1Result.transcription.utterances);
    const video2ExtractedWords = extractStudentWords(video2Result.transcription.utterances);
    const allStudentWords = [...new Set([...video1ExtractedWords, ...video2ExtractedWords])].sort();
    
    // 2. 提取 AI 在单视频分析时选出的发音难点词（每个视频 3 个，共 6 个）
    const video1AIWords = Array.isArray(video1Analysis.pronunciationWords) ? video1Analysis.pronunciationWords : [];
    const video2AIWords = Array.isArray(video2Analysis.pronunciationWords) ? video2Analysis.pronunciationWords : [];
    const pronunciationFocusWords = [...new Set([...video1AIWords, ...video2AIWords].map((w: string) => w.toLowerCase()))];
    
    console.log(`📝 [发音分析] 视频1 AI提取的发音难点词: [${video1AIWords.join(', ')}]`);
    console.log(`📝 [发音分析] 视频2 AI提取的发音难点词: [${video2AIWords.join(', ')}]`);
    console.log(`📝 [发音分析] 合并后的发音重点关注单词 (${pronunciationFocusWords.length}个): [${pronunciationFocusWords.join(', ')}]`);
    console.log(`📝 [发音分析] 学生说过的所有单词 (${allStudentWords.length}个): [${allStudentWords.slice(0, 20).join(', ')}${allStudentWords.length > 20 ? '...' : ''}]`);

    // 3. 提取 AI 在单视频分析时识别的语法错误示例（每个视频最多 3 个，共最多 6 个）
    const video1GrammarExamples = Array.isArray(video1Analysis.grammarExamples) ? video1Analysis.grammarExamples : [];
    const video2GrammarExamples = Array.isArray(video2Analysis.grammarExamples) ? video2Analysis.grammarExamples : [];
    const allGrammarExamples = [...video1GrammarExamples, ...video2GrammarExamples];
    
    console.log(`📝 [语法分析] 视频1 AI提取的语法错误示例: ${video1GrammarExamples.length}个`);
    console.log(`📝 [语法分析] 视频2 AI提取的语法错误示例: ${video2GrammarExamples.length}个`);
    console.log(`📝 [语法分析] 合并后的语法错误示例 (${allGrammarExamples.length}个)`);

    // 预提取关键数据（确保所有数值都有默认值）
    const video1Data = {
      handRaising: { 
        count: Number(video1Analysis.handRaising?.count) || 0, 
        percentage: Number(video1Analysis.handRaising?.percentage) || 0 
      },
      answerLength: { 
        average: Number(video1Analysis.answerLength?.average) || 0 
      },
      completeSentences: { 
        count: Number(video1Analysis.completeSentences?.count) || 0, 
        percentage: Number(video1Analysis.completeSentences?.percentage) || 0 
      },
      accuracy: { 
        correctRate: Number(video1Analysis.readingAccuracy?.correctRate) || 0 
      }
    };
    
    const video2Data = {
      handRaising: { 
        count: Number(video2Analysis.handRaising?.count) || 0, 
        percentage: Number(video2Analysis.handRaising?.percentage) || 0 
      },
      answerLength: { 
        average: Number(video2Analysis.answerLength?.average) || 0 
      },
      completeSentences: { 
        count: Number(video2Analysis.completeSentences?.count) || 0, 
        percentage: Number(video2Analysis.completeSentences?.percentage) || 0 
      },
      accuracy: { 
        correctRate: Number(video2Analysis.readingAccuracy?.correctRate) || 0 
      }
    };
    
    const dataChanges = {
      handRaising: {
        old: video1Data.handRaising.count,
        new: video2Data.handRaising.count,
        change: calculateChange(video1Data.handRaising.count, video2Data.handRaising.count)
      },
      answerLength: {
        old: video1Data.answerLength.average,
        new: video2Data.answerLength.average,
        change: calculateChange(video1Data.answerLength.average, video2Data.answerLength.average)
      },
      completeSentences: {
        old: video1Data.completeSentences.percentage,
        new: video2Data.completeSentences.percentage,
        change: calculatePercentageDiff(video1Data.completeSentences.percentage, video2Data.completeSentences.percentage)
      },
      accuracy: {
        old: video1Data.accuracy.correctRate,
        new: video2Data.accuracy.correctRate,
        change: calculatePercentageDiff(video1Data.accuracy.correctRate, video2Data.accuracy.correctRate)
      }
    };

    // 构建 prompt（简化版本，完整版本太长）
    const prompt = buildComparisonPrompt(
      studentInfo,
      video1Result,
      video2Result,
      video1Analysis,
      video2Analysis,
      video1Dialogues,
      video2Dialogues,
      dataChanges,
      allStudentWords,
      pronunciationFocusWords,
      allGrammarExamples
    );

    const model = getModelName(openai);
    const provider = getProviderInfo(openai);
    console.log(`${provider} 正在生成对比报告，模型: ${model}`);

    const aiCallConfig: AICallConfig = {
      maxRetries: 3,
      retryDelayBase: 2000,
      timeout: 180000,
      operationLabel: `对比报告生成(${studentInfo.studentName})`,
    };

    const response = await withRetry(
      () => openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: "你是一位专业的英语教学专家。你必须严格遵守用户提供的所有约束和规范。请以JSON格式返回详细的学习分析报告。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 5000
      }),
      aiCallConfig
    );

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
    
    // 首先规范化 learningData（处理对象类型的字段值）
    normalizeLearningData(analysisData);
    
    // 验证并修复数据
    validateAndFixPronunciationExamples(analysisData);
    validateAndFixGrammarExamples(analysisData);
    // overallSuggestions 已迁移至解读版生成，不再在报告中生成
    
    // 后处理 AI 调用使用量累加器
    let postProcessingUsage: PostProcessingUsage = createEmptyUsage();
    
    // 验证并修复负值百分比
    const negativeFixUsage = await validateAndFixNegativePercentages(analysisData, openai, model);
    postProcessingUsage.promptTokens += negativeFixUsage.promptTokens;
    postProcessingUsage.completionTokens += negativeFixUsage.completionTokens;
    postProcessingUsage.totalTokens += negativeFixUsage.totalTokens;
    postProcessingUsage.cost += negativeFixUsage.cost;
    postProcessingUsage.callCount += negativeFixUsage.callCount;
    
    // 验证并修复数据一致性
    const consistencyFixUsage = await validateAndFixDataConsistency(analysisData, openai, model);
    postProcessingUsage.promptTokens += consistencyFixUsage.promptTokens;
    postProcessingUsage.completionTokens += consistencyFixUsage.completionTokens;
    postProcessingUsage.totalTokens += consistencyFixUsage.totalTokens;
    postProcessingUsage.cost += consistencyFixUsage.cost;
    postProcessingUsage.callCount += consistencyFixUsage.callCount;
    
    // 输出后处理 AI 调用总使用量
    if (postProcessingUsage.callCount > 0) {
      console.log(`\n💰 ===== 后处理 AI 调用总使用量 =====`);
      console.log(`   调用次数: ${postProcessingUsage.callCount}`);
      console.log(`   Token 使用: ${postProcessingUsage.promptTokens} input + ${postProcessingUsage.completionTokens} output = ${postProcessingUsage.totalTokens} total`);
      console.log(`   成本: ¥${postProcessingUsage.cost.toFixed(4)}`);
      console.log(`======================================\n`);
    }
    
    // overallSuggestions 已迁移至解读版生成，删除报告中的该字段
    delete analysisData.overallSuggestions;
    
    // 提取对比报告的 token 使用量
    const comparisonUsage = response.usage;
    const comparisonPromptTokens = comparisonUsage?.prompt_tokens || 0;
    const comparisonCompletionTokens = comparisonUsage?.completion_tokens || 0;
    const comparisonTotalTokens = comparisonUsage?.total_tokens || 0;
    const comparisonCost = calculateAICost(model, comparisonPromptTokens, comparisonCompletionTokens);
    
    console.log(`💰 对比报告 Token 使用量: ${comparisonPromptTokens} input + ${comparisonCompletionTokens} output = ${comparisonTotalTokens} total`);
    console.log(`💰 对比报告成本: ¥${comparisonCost.toFixed(4)}`);
    
    // 汇总所有成本
    const video1Usage = video1Result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 };
    const video2Usage = video2Result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 };
    
    const totalAITokens = video1Usage.totalTokens + video2Usage.totalTokens + comparisonTotalTokens + postProcessingUsage.totalTokens;
    const totalAICost = video1Usage.cost + video2Usage.cost + comparisonCost + postProcessingUsage.cost;
    
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
    const costBreakdown: CostBreakdown = {
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
        provider: provider.replace(/[^\w\s-]/g, '').trim(),
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
        postProcessing: postProcessingUsage.callCount > 0 ? {
          promptTokens: postProcessingUsage.promptTokens,
          completionTokens: postProcessingUsage.completionTokens,
          totalTokens: postProcessingUsage.totalTokens,
          cost: postProcessingUsage.cost,
          callCount: postProcessingUsage.callCount
        } : undefined,
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
 * 构建对比报告的 prompt
 */
function buildComparisonPrompt(
  studentInfo: StudentInfo,
  video1Result: SingleVideoResult,
  video2Result: SingleVideoResult,
  video1Analysis: any,
  video2Analysis: any,
  video1Dialogues: string,
  video2Dialogues: string,
  dataChanges: any,
  allStudentWords: string[],
  pronunciationFocusWords: string[],
  allGrammarExamples: any[]
): string {
  return `你是一位在英语教学分析领域经验丰富的专家，专注于1对1教学场景的学生进步分析。

你将收到同一位学生在两个不同时间点的英语课堂数据。

**重要说明**：
- 第一个视频是**早期课堂**（学习初期的表现）
- 第二个视频是**最近课堂**（经过一段时间学习后的表现）
- 通常情况下，学生在第二个视频中的表现会比第一个视频有所进步
- 请基于这个时间顺序来分析学生的成长和变化

你的任务是：
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

**【关键数据摘要】**
1. 主动回答次数：${dataChanges.handRaising.old}次 → ${dataChanges.handRaising.new}次 (${dataChanges.handRaising.change})
2. 平均回答长度：${dataChanges.answerLength.old}词 → ${dataChanges.answerLength.new}词 (${dataChanges.answerLength.change})
3. 完整句输出比例：${dataChanges.completeSentences.old}% → ${dataChanges.completeSentences.new}% (${dataChanges.completeSentences.change})
4. 准确率：${dataChanges.accuracy.old}% → ${dataChanges.accuracy.new}% (${dataChanges.accuracy.change})

---

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

---

**请以JSON格式返回分析报告**：

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
      "example": "【早期课堂】\\n老师：'...'\\n学生：'...'\\n\\n【最近课堂】\\n老师：'...'\\n学生：'...'\\n\\n【对比分析】\\n..."
    },
    "confidence": {
      "analysis": "自信心与互动的深度分析（融入量化数据），至少${REPORT_WORD_COUNT.progressDimensions.confidence}词。",
      "example": "【早期课堂】\\n老师：'...'\\n学生：'...'\\n\\n【最近课堂】\\n老师：'...'\\n学生：'...'\\n\\n【对比分析】\\n..."
    },
    "languageApplication": {
      "analysis": "语言主动应用能力的深度分析（融入词汇和语法对比），至少${REPORT_WORD_COUNT.progressDimensions.languageApplication}词。",
      "example": "【早期课堂】\\n老师：'...'\\n学生：'...'\\n\\n【最近课堂】\\n老师：'...'\\n学生：'...'\\n\\n【对比分析】\\n..."
    },
    "sentenceComplexity": {
      "analysis": "句子复杂度及组织能力的深度分析（融入句型统计），至少${REPORT_WORD_COUNT.progressDimensions.sentenceComplexity}词。",
      "example": "【早期课堂】\\n老师：'...'\\n学生：'...'\\n\\n【最近课堂】\\n老师：'...'\\n学生：'...'\\n\\n【对比分析】\\n..."
    }
  },
  "improvementAreas": {
    "pronunciation": {
      "overview": "发音方面的整体评估和趋势总结（基于两次课堂对比）。至少${REPORT_WORD_COUNT.improvementAreas.overview}词。",
      "details": "详细的发音问题深度分析。至少${REPORT_WORD_COUNT.improvementAreas.details}词。",
      "examples": [
        {
          "word": "🔴必须从上方【学生说过的单词列表】中选择🔴 第1个发音错误的单词",
          "incorrect": "学生实际发出的错误发音的IPA音标",
          "correct": "该单词的标准正确发音的IPA音标（必须与incorrect不同）",
          "type": "问题类型（如：元音不准确、重音问题、辅音发音等）"
        },
        {
          "word": "第2个发音错误的单词",
          "incorrect": "错误音标",
          "correct": "正确音标（必须与incorrect不同）",
          "type": "问题类型"
        },
        {
          "word": "第3个发音错误的单词",
          "incorrect": "错误音标",
          "correct": "正确音标（必须与incorrect不同）",
          "type": "问题类型"
        }
      ],
      "suggestions": [
        {
          "title": "建议标题",
          "description": "详细的练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        },
        {
          "title": "第二个建议标题",
          "description": "第二个练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        }
      ]
    },
    "grammar": {
      "overview": "语法方面的整体评估和趋势总结。至少${REPORT_WORD_COUNT.improvementAreas.overview}词。",
      "details": "详细的语法问题深度分析。至少${REPORT_WORD_COUNT.improvementAreas.details}词。",
      "examples": [
        // 🔴 必须从上方【单视频分析提取的语法错误示例】中选择3个最有代表性的！
        // 🔴 如果上方列表为空，才可以根据转录文本自行识别
        // 🔴 category 和 explanation 必须是中文，incorrect 和 correct 是英文
        {
          "category": "中文错误类别（如：主谓一致、动词时态、冠词遗漏）",
          "incorrect": "学生实际说出的英文错误句子（必须是真实的！）",
          "correct": "正确的英文句子",
          "explanation": "中文错误解释和语法规则"
        },
        {
          "category": "第2个中文错误类别",
          "incorrect": "第2个英文错误句子",
          "correct": "正确的英文句子",
          "explanation": "中文错误解释"
        },
        {
          "category": "第3个中文错误类别",
          "incorrect": "第3个英文错误句子",
          "correct": "正确的英文句子",
          "explanation": "中文错误解释"
        }
      ],
      "suggestions": [
        {
          "title": "建议标题",
          "description": "详细的练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        },
        {
          "title": "第二个建议标题",
          "description": "第二个练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        }
      ]
    },
    "intonation": {
      "overview": "语调与节奏方面的整体评估和趋势总结。至少${REPORT_WORD_COUNT.improvementAreas.overview}词。",
      "details": "详细的语调与节奏深度分析。至少${REPORT_WORD_COUNT.improvementAreas.details}词。",
      "suggestions": [
        {
          "title": "建议标题",
          "description": "详细的练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        },
        {
          "title": "第二个建议标题",
          "description": "第二个练习建议和方法（至少${REPORT_WORD_COUNT.improvementAreas.suggestion}词）"
        }
      ]
    }
  },
}

**【发音重点关注单词】（共${pronunciationFocusWords.length}个，优先从这些单词中选择发音示例）**
${pronunciationFocusWords.join(', ') || '无'}

**【学生说过的所有单词】（用于验证，发音示例必须来自此列表）**
${allStudentWords.slice(0, 100).join(', ')}${allStudentWords.length > 100 ? '...(仅显示前100个)' : ''}

**【单视频分析提取的语法错误示例】（共${allGrammarExamples.length}个，请从中选择3个最有代表性的，最好是不同错误类型的）**
${allGrammarExamples.length > 0 ? allGrammarExamples.map((ex: any, i: number) => `${i + 1}. [${ex.category || '未分类'}] 错误: "${ex.incorrect}" → 正确: "${ex.correct}" (${ex.explanation || '无解释'})`).join('\n') : '无（AI将根据转录文本自行识别）'}

**learningData 的精确格式（必须严格遵守）**：
\`\`\`json
{
  "learningData": {
    "handRaising": {
      "trend": "提升",
      "percentage": "+15%",
      "analysis": "分析文字..."
    },
    "answerLength": {
      "trend": "提升",
      "percentage": "+20%",
      "analysis": "分析文字..."
    },
    "completeSentences": {
      "trend": "持平",
      "percentage": "0%",
      "analysis": "分析文字..."
    },
    "readingAccuracy": {
      "trend": "下降",
      "percentage": "-5%",
      "analysis": "分析文字..."
    }
  }
}
\`\`\`
- trend 必须是字符串，只能是 "提升"、"下降" 或 "持平" 三个值之一
- percentage 必须是字符串，格式为 "+数字%" 或 "-数字%" 或 "0%"，例如 "+15%"、"-8%"、"0%"
- analysis 必须是字符串，约50字的分析说明

**重要提示**：
1. 所有百分比必须基于实际数据计算，不要编造数字
2. 所有原文案例必须来自实际转录文本或对话记录
3. 每个analysis和example字段都要融入"对比"元素，突出变化
4. 基于阈值触发规则，在suggestions中智能添加相应建议
5. 确保返回有效的JSON格式，不要包含注释
6. 所有文字描述要详实、具体、有数据支撑
7. ⚠️ 发音示例（pronunciation.examples）的单词必须从【学生说过的单词列表】中选择
8. ⚠️ incorrect 和 correct 音标必须不同！
9. ⚠️ 语法示例（grammar.examples）必须优先从【单视频分析提取的语法错误示例】中选择3个最有代表性的！这些是学生真实说过的错误句子！

现在开始生成 JSON 响应...`;
}


