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
  validateAndFixDataConsistency
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
 * 计算变化百分比
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
        change: calculateChange(video1Data.completeSentences.percentage, video2Data.completeSentences.percentage)
      },
      accuracy: {
        old: video1Data.accuracy.correctRate,
        new: video2Data.accuracy.correctRate,
        change: calculateChange(video1Data.accuracy.correctRate, video2Data.accuracy.correctRate)
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
      pronunciationFocusWords
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
  pronunciationFocusWords: string[]
): string {
  return `你是一位在英语教学分析领域经验丰富的专家，专注于1对1教学场景的学生进步分析。

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

**【关键数据摘要】**
1. 主动回答次数：${dataChanges.handRaising.old}次 → ${dataChanges.handRaising.new}次 (${dataChanges.handRaising.change})
2. 平均回答长度：${dataChanges.answerLength.old}词 → ${dataChanges.answerLength.new}词 (${dataChanges.answerLength.change})
3. 完整句输出比例：${dataChanges.completeSentences.old}% → ${dataChanges.completeSentences.new}% (${dataChanges.completeSentences.change})
4. 准确率：${dataChanges.accuracy.old}% → ${dataChanges.accuracy.new}% (${dataChanges.accuracy.change})

**【早期课堂数据】**
转录文本：${video1Result.transcription.text.substring(0, 2000)}${video1Result.transcription.text.length > 2000 ? '...(已截断)' : ''}
${video1Dialogues}
分析结果：${JSON.stringify(video1Analysis, null, 2)}

**【最近课堂数据】**
转录文本：${video2Result.transcription.text.substring(0, 2000)}${video2Result.transcription.text.length > 2000 ? '...(已截断)' : ''}
${video2Dialogues}
分析结果：${JSON.stringify(video2Analysis, null, 2)}

**【发音重点关注单词】（共${pronunciationFocusWords.length}个，优先从这些单词中选择发音示例）**
${pronunciationFocusWords.join(', ') || '无'}

**【学生说过的所有单词】（用于验证，发音示例必须来自此列表）**
${allStudentWords.slice(0, 100).join(', ')}${allStudentWords.length > 100 ? '...(仅显示前100个)' : ''}

请以JSON格式返回分析报告，包含以下字段：
- learningData: 学习数据分析（handRaising, answerLength, completeSentences, readingAccuracy）
- progressDimensions: 进步维度分析（fluency, confidence, languageApplication, sentenceComplexity）
- improvementAreas: 改进领域（pronunciation, grammar, intonation）

每个字段的具体要求：
1. learningData 中每个指标需要包含 trend、percentage、analysis
2. progressDimensions 中每个维度需要包含 analysis 和 example
3. improvementAreas 中的 pronunciation 需要包含 overview、details、examples（3个发音示例）、suggestions
4. improvementAreas 中的 grammar 需要包含 overview、details、examples（3个语法示例）、suggestions

**重要提示**：
- 发音示例的单词必须优先从【发音重点关注单词】中选择（这些是 AI 在单视频分析时识别出的发音难点词）
- 如果【发音重点关注单词】不足 3 个，可以从【学生说过的所有单词】中补充
- incorrect 和 correct 音标必须不同
- 所有百分比必须基于实际数据计算
- 所有原文案例必须来自实际转录文本`;
}


