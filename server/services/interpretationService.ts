/**
 * 📝 解读版生成服务
 * 通过 GLM API 生成完整的15分钟班主任演讲稿
 */

import OpenAI from 'openai';
import { AppError, ErrorType } from '../utils/errors.js';
import { calculateAICost } from './videoAnalysis/config.js';

// 解读版花费信息
export interface InterpretationCost {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;           // 花费（元）
  model: string;          // 使用的模型
  currency: string;       // 货币单位
}

// 解读版生成结果（包含内容和花费）
export interface InterpretationResult {
  content: SpeechContent;
  cost: InterpretationCost;
}

// 学习建议结构（完整段落形式）
export interface LearningRecommendation {
  content: string;            // 完整的建议段落，由AI直接生成
}

// 演讲稿内容结构
export interface SpeechContent {
  // 演讲稿标题
  title: string;
  
  // 预计时长（分钟）- 仅统计 sections 的时长，不包含学习建议
  estimatedDuration: number;
  
  // 演讲稿正文（完整的演讲内容，分段落）
  sections: {
    title: string;           // 段落标题
    content: string;         // 段落内容（完整的演讲文字）
    duration: number;        // 预计时长（分钟）
    notes?: string;          // 演讲备注/提示
  }[];
  
  // 学习建议（独立模块，不计入演讲时长）
  learningRecommendations?: LearningRecommendation[];
  
  // 关键要点提示
  keyPoints: string[];
  
  // 注意事项
  cautions: string[];
}

// 报告数据接口（直接使用前端的原始数据格式）
export interface ReportDataForInterpretation {
  studentName: string;
  studentId?: string;
  grade?: string;
  level?: string;
  unit?: string;
  
  // 学习数据（直接使用原始格式）
  learningData?: {
    handRaising?: { trend: string; percentage: string; analysis: string };
    answerLength?: { trend: string; percentage: string; analysis: string };
    completeSentences?: { trend: string; percentage: string; analysis: string };
    readingAccuracy?: { trend: string; percentage: string; analysis: string };
  };
  
  // 进步维度
  progressDimensions?: {
    fluency?: { analysis: string; example: string };
    confidence?: { analysis: string; example: string };
    languageApplication?: { analysis: string; example: string };
    sentenceComplexity?: { analysis: string; example: string };
  };
  
  // 待改进领域
  improvementAreas?: {
    pronunciation?: {
      overview: string;
      details?: string;
      examples?: { word: string; incorrect: string; correct: string }[];
    };
    grammar?: {
      overview: string;
      details?: string;
      examples?: { original: string; corrected: string; explanation: string }[];
    };
    intonation?: {
      overview: string;
      details?: string;
    };
  };
  
  // 整体建议已迁移至解读版生成，由 AI 基于以上数据自动生成
}

class InterpretationService {
  private openai: OpenAI | null = null;
  
  constructor() {
    if (process.env.GLM_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.GLM_API_KEY,
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      });
      console.log('📝 解读版服务初始化成功 (GLM-4-Plus)');
    } else {
      console.log('⚠️ 解读版服务: GLM_API_KEY 未配置');
    }
  }
  
  /**
   * 生成完整的15分钟班主任演讲稿
   * 返回内容和花费信息
   */
  async generateInterpretation(reportData: ReportDataForInterpretation): Promise<InterpretationResult> {
    if (!this.openai) {
      throw new AppError(
        ErrorType.API_KEY_ERROR,
        'GLM API Key 未配置',
        { userMessage: '无法生成解读版：GLM API Key 未配置' }
      );
    }
    
    const model = 'glm-4-plus';
    console.log(`\n📝 开始生成15分钟班主任演讲稿 - 学生: ${reportData.studentName}`);
    const startTime = Date.now();
    
    try {
      const prompt = this.buildPrompt(reportData);
      
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `你是51Talk的资深班主任，拥有10年以上少儿英语教育经验，专门负责与家长沟通学生的学习情况。

你的任务是根据学生的学习报告，撰写一份完整的、约15分钟的演讲稿。这份演讲稿将用于班主任与家长进行一对一沟通。

【核心原则：个性化深度解读】
你的价值不是复述报告数据，而是用你的专业经验解读这些数据。家长已经看过报告，他们需要的是：
1. 专业视角：这个数据在同龄孩子中处于什么水平？意味着什么学习阶段？
2. 背后原因：为什么会有这样的表现？可能的学习习惯或心理因素是什么？
3. 发展预判：按这个趋势发展下去会怎样？需要注意什么？
4. 个性化建议：针对这个孩子的具体情况，有什么独特的建议？

【严禁的写法】
❌ "主动发言次数保持不变，都是25次，这表明参与意愿没有显著变化"（这是复述报告）
❌ "回答长度从4.5词提升到4.7词，这一小幅提升表明..."（这是换个说法复述）
❌ 直接引用报告中的分析句子

【推荐的写法】
✅ "25次主动发言，在我带过的同级别学生中属于中上水平。不过我注意到一个有趣的现象..."
✅ "4.7个词的平均回答长度，说明孩子已经开始尝试用短语而非单词来表达了。这是语言输出从'词汇期'向'句子期'过渡的典型特征..."
✅ 用故事、类比、场景描述来解释数据
✅ 分享你观察到的细节、孩子的学习特点
✅ 提出家长可能没想到的角度

演讲稿要求：
1. 总时长约15分钟（按正常语速，每分钟约200字计算，总字数约3000字）
2. 内容要完整、连贯，像一篇真正的演讲稿，而不是要点提示
3. 语言要自然、亲切、有感染力，体现班主任的专业和对孩子的关怀
4. 要有清晰的结构：开场、关键学习数据、四大维度进步分析、待提升点详细分析、结束
5. 每个部分都要有具体的话术，不是概括性的要点
6. 必须严格基于提供的学生数据进行解读，确保内容真实准确
7. 在适当的地方加入停顿、互动提示
8. 要像一个真正了解这个孩子的老师在分享观察和见解，而不是在读报告

写作风格：
- 专业、温暖、负责任
- 真诚而有说服力
- 站在教育者的角度，以学生成长为中心
- 善于用比喻和生活化的例子解释专业概念
- 展现对孩子的细致观察和真诚关怀`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 8000,
        temperature: 0.7,
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('GLM API 返回内容为空');
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ 演讲稿生成完成，耗时 ${elapsed} 秒`);
      
      // 计算花费
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const totalTokens = response.usage?.total_tokens || 0;
      const cost = calculateAICost(model, promptTokens, completionTokens);
      
      console.log(`   Token 使用: ${totalTokens} (输入: ${promptTokens}, 输出: ${completionTokens})`);
      console.log(`   💰 花费: ¥${cost.toFixed(4)}`);
      
      // 解析 JSON 响应
      const speechContent = this.parseResponse(content, reportData.studentName);
      
      return {
        content: speechContent,
        cost: {
          promptTokens,
          completionTokens,
          totalTokens,
          cost,
          model,
          currency: 'CNY',
        },
      };
      
    } catch (error) {
      console.error('❌ 演讲稿生成失败:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        ErrorType.AI_ANALYSIS_ERROR,
        error instanceof Error ? error.message : '演讲稿生成失败',
        { 
          userMessage: '生成演讲稿时出错，请稍后重试',
          originalError: error instanceof Error ? error : undefined,
        }
      );
    }
  }
  
  /**
   * 构建提示词
   */
  private buildPrompt(data: ReportDataForInterpretation): string {
    const sections: string[] = [];
    
    // 学生基本信息
    sections.push(`## 学生信息
- 姓名: ${data.studentName}
- 学生ID: ${data.studentId || '未知'}
- 年级: ${data.grade || '未知'}
- 当前级别: ${data.level || '未知'}
- 当前单元: ${data.unit || '未知'}`);
    
    // 学习数据（使用原始数据格式）
    if (data.learningData) {
      const ld = data.learningData;
      const metricsLines: string[] = [];
      
      if (ld.handRaising) {
        metricsLines.push(`- 主动发言次数: ${ld.handRaising.percentage} (${ld.handRaising.trend})`);
        metricsLines.push(`  分析: ${ld.handRaising.analysis}`);
      }
      if (ld.answerLength) {
        metricsLines.push(`- 回答完整度: ${ld.answerLength.percentage} (${ld.answerLength.trend})`);
        metricsLines.push(`  分析: ${ld.answerLength.analysis}`);
      }
      if (ld.completeSentences) {
        metricsLines.push(`- 完整句子使用: ${ld.completeSentences.percentage} (${ld.completeSentences.trend})`);
        metricsLines.push(`  分析: ${ld.completeSentences.analysis}`);
      }
      if (ld.readingAccuracy) {
        metricsLines.push(`- 朗读准确率: ${ld.readingAccuracy.percentage} (${ld.readingAccuracy.trend})`);
        metricsLines.push(`  分析: ${ld.readingAccuracy.analysis}`);
      }
      
      if (metricsLines.length > 0) {
        sections.push(`## 学习数据变化（对比两次课堂表现）
${metricsLines.join('\n')}`);
      }
    }
    
    // 进步维度
    if (data.progressDimensions) {
      const pd = data.progressDimensions;
      const dimensionLines: string[] = [];
      
      if (pd.fluency) {
        dimensionLines.push(`- 表达流利度: ${pd.fluency.analysis}`);
        if (pd.fluency.example) dimensionLines.push(`  示例: ${pd.fluency.example}`);
      }
      if (pd.confidence) {
        dimensionLines.push(`- 自信心: ${pd.confidence.analysis}`);
        if (pd.confidence.example) dimensionLines.push(`  示例: ${pd.confidence.example}`);
      }
      if (pd.languageApplication) {
        dimensionLines.push(`- 语言应用能力: ${pd.languageApplication.analysis}`);
        if (pd.languageApplication.example) dimensionLines.push(`  示例: ${pd.languageApplication.example}`);
      }
      if (pd.sentenceComplexity) {
        dimensionLines.push(`- 句子复杂度: ${pd.sentenceComplexity.analysis}`);
        if (pd.sentenceComplexity.example) dimensionLines.push(`  示例: ${pd.sentenceComplexity.example}`);
      }
      
      if (dimensionLines.length > 0) {
        sections.push(`## 进步维度分析
${dimensionLines.join('\n')}`);
      }
    }
    
    // 待改进领域
    if (data.improvementAreas) {
      const ia = data.improvementAreas;
      const improvementLines: string[] = [];
      
      if (ia.pronunciation) {
        improvementLines.push(`### 发音问题`);
        improvementLines.push(`概述: ${ia.pronunciation.overview}`);
        if (ia.pronunciation.details) {
          improvementLines.push(`详情: ${ia.pronunciation.details}`);
        }
        if (ia.pronunciation.examples && ia.pronunciation.examples.length > 0) {
          improvementLines.push(`具体示例:`);
          ia.pronunciation.examples.forEach(ex => {
            improvementLines.push(`  - 单词"${ex.word}": 学生读作"${ex.incorrect}"，正确应为"${ex.correct}"`);
          });
        }
      }
      
      if (ia.grammar) {
        improvementLines.push(`### 语法问题`);
        improvementLines.push(`概述: ${ia.grammar.overview}`);
        if (ia.grammar.details) {
          improvementLines.push(`详情: ${ia.grammar.details}`);
        }
        if (ia.grammar.examples && ia.grammar.examples.length > 0) {
          improvementLines.push(`具体示例:`);
          ia.grammar.examples.forEach(ex => {
            improvementLines.push(`  - 原句: "${ex.original}" → 正确: "${ex.corrected}"`);
            if (ex.explanation) improvementLines.push(`    说明: ${ex.explanation}`);
          });
        }
      }
      
      if (ia.intonation) {
        improvementLines.push(`### 语调问题`);
        improvementLines.push(`概述: ${ia.intonation.overview}`);
        if (ia.intonation.details) {
          improvementLines.push(`详情: ${ia.intonation.details}`);
        }
      }
      
      if (improvementLines.length > 0) {
        sections.push(`## 待改进领域
${improvementLines.join('\n')}`);
      }
    }
    
    // 整体建议（已迁移至解读版生成，由 AI 基于以上数据自动生成）
    
    return `请根据以下学生学习报告，撰写一份完整的15分钟班主任演讲稿。

${sections.join('\n\n')}

---

请严格按照以下 JSON 格式返回结果（注意：只返回 JSON，不要有其他文字）：

\`\`\`json
{
  "title": "演讲稿标题（包含学生姓名）",
  "estimatedDuration": 15,
  "sections": [
    {
      "title": "一、开场问候与建立信任",
      "content": "完整的开场演讲内容，约2分钟，400字左右。包括问候、自我介绍（班主任身份）、说明来意、建立亲和感。要写成完整的话术，不是要点。",
      "duration": 2,
      "notes": "保持微笑，语速适中"
    },
    {
      "title": "二、关键学习数据",
      "content": "完整的数据解读演讲内容，约4分钟，800字左右。【重点】不要复述报告中的数据和分析！要用你的专业经验解读：1）这些数据在同龄孩子中处于什么水平；2）数据背后反映了什么学习特点或习惯；3）用生活化的比喻帮助家长理解；4）分享你作为老师观察到的细节。例如：'25次主动发言，在我带过的L3级别学生中属于活跃型。我注意到艺馨有个特点，她特别喜欢在老师提问后第一时间回答...'",
      "duration": 4,
      "notes": "配合展示报告图表，用故事和比喻解释数据"
    },
    {
      "title": "三、四大维度进步分析",
      "content": "完整的进步分析演讲内容，约4分钟，800字左右。围绕表达流利度、自信心、语言应用能力、句子复杂度这四大维度，结合具体例子（如报告中的示例），详细描述孩子的进步。要让家长感受到班主任对孩子的细致观察。",
      "duration": 4,
      "notes": "语气要热情，表达真诚的赞赏"
    },
    {
      "title": "四、待提升点详细分析",
      "content": "完整的提升建议演讲内容，约4分钟，800字左右。针对发音、语法、语调等具体问题，给出专业的分析和建议。指出问题不是为了批评，而是为了明确努力方向。要给出具体的练习方法。",
      "duration": 4,
      "notes": "语气要积极正面，强调成长空间"
    },
    {
      "title": "五、结束语与后续跟进",
      "content": "完整的结束演讲内容，约1分钟，200字左右。总结本次沟通要点，表达感谢，说明后续班主任的辅导计划。",
      "duration": 1,
      "notes": "留下良好印象，增强家校配合信心"
    }
  ],
  "learningRecommendations": [
    {
      "content": "完整的学习建议段落，每条建议是一段完整流畅的话，自然地包含针对的问题、具体方法、频次和预期效果。不要使用模板化的格式，要像班主任真正在给家长提建议一样自然表达。"
    }
  ],
  "keyPoints": [
    "本次沟通的3-5个关键要点，帮助班主任把握重点"
  ],
  "cautions": [
    "3-5条注意事项，如家长关注点、沟通策略等"
  ]
}
\`\`\`

重要提示：
1. 每个 section 的 content 必须是完整的演讲文字，不是要点或提纲
2. sections 部分总时长约15分钟（按每分钟200字计算，总字数约3000字），estimatedDuration 只统计 sections 的时长
3. 时间分配：开场2分钟(400字) + 数据4分钟(800字) + 进步分析4分钟(800字) + 待提升点4分钟(800字) + 结束语1分钟(200字) = 15分钟
4. 必须严格基于提供的学生数据，不要编造数据
5. 内容要有深度，体现班主任的专业性
6. 语言要自然流畅，像真实的对话
7. learningRecommendations 是独立的学习建议模块，放在演讲稿之后，需要生成3条具体、可操作的学习建议。每条建议是一段完整流畅的话（约100-150字），自然地融入针对的问题、具体方法、频次和预期效果，不要使用"针对...建议..."这种模板化表达，要像班主任真正在给家长提建议一样自然表达。这是本次沟通的核心价值输出。

【最重要】绝对禁止直接复述或改写报告中的分析文字！报告中的"分析"字段只是给你参考的原始数据，你需要用自己的专业视角重新解读。检查你的输出：如果某段话和报告原文相似度超过50%，必须重写。`;
  }
  
  /**
   * 修复 JSON 字符串中的控制字符（如未转义的换行符）
   */
  private sanitizeJson(str: string): string {
    let result = '';
    let inString = false;
    let isEscaping = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (inString) {
        if (char === '\\') {
          if (isEscaping) {
            // 这是一个被转义的反斜杠：\\
            isEscaping = false;
          } else {
            // 开始转义序列
            isEscaping = true;
          }
          result += char;
        } else {
          if (isEscaping) {
            // 这是一个被转义的字符（如 \" 或 \n）
            isEscaping = false;
            result += char;
          } else {
            if (char === '"') {
              // 字符串结束
              inString = false;
              result += char;
            } else if (char === '\n') {
              // 字符串内的未转义换行 -> 替换为 \n
              result += '\\n';
            } else if (char === '\r') {
              // 字符串内的未转义回车 -> 忽略或替换
              // 这里选择忽略，因为通常跟随 \n，或者被上面的 \n 处理逻辑覆盖
            } else if (char === '\t') {
              // 字符串内的未转义制表符 -> 替换为 \t
              result += '\\t';
            } else if (char.charCodeAt(0) <= 0x1F) {
              // 其他控制字符 -> 忽略或替换为空格
              result += ' ';
            } else {
              // 普通字符
              result += char;
            }
          }
        }
      } else {
        // 字符串外
        if (char === '"') {
          inString = true;
        }
        result += char;
      }
    }
    return result;
  }

  /**
   * 解析 GLM 响应
   */
  private parseResponse(content: string, studentName: string): SpeechContent {
    try {
      // 尝试提取 JSON 内容
      let jsonStr = content;
      
      console.log('📝 开始解析 GLM 响应，原始内容长度:', content.length);
      
      // 移除可能的 markdown 代码块标记
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
        console.log('📝 从 markdown 代码块中提取 JSON，长度:', jsonStr.length);
      } else {
        console.log('📝 未找到 markdown 代码块，尝试直接解析');
      }

      // 修复 JSON 字符串中的非法控制字符
      jsonStr = this.sanitizeJson(jsonStr);
      
      const parsed = JSON.parse(jsonStr);
      
      console.log('✅ JSON 解析成功');
      console.log('   - title:', parsed.title ? '有' : '无');
      console.log('   - sections 数量:', parsed.sections?.length || 0);
      console.log('   - learningRecommendations 数量:', parsed.learningRecommendations?.length || 0);
      console.log('   - keyPoints 数量:', parsed.keyPoints?.length || 0);
      
      // 验证 sections 是否有效（非空数组且每个 section 有内容）
      const hasValidSections = parsed.sections && 
        Array.isArray(parsed.sections) && 
        parsed.sections.length > 0 &&
        parsed.sections.every((s: any) => s.title && s.content && s.content.length > 50);
      
      if (!hasValidSections) {
        console.log('⚠️ sections 无效或内容过短，使用默认内容');
        if (parsed.sections) {
          console.log('   sections 详情:', parsed.sections.map((s: any) => ({
            title: s.title,
            contentLength: s.content?.length || 0
          })));
        }
      }
      
      // 验证 learningRecommendations 是否有效
      const hasValidRecommendations = parsed.learningRecommendations && 
        Array.isArray(parsed.learningRecommendations) && 
        parsed.learningRecommendations.length > 0 &&
        parsed.learningRecommendations.every((r: any) => r.content && r.content.length > 20);
      
      // 验证必要字段并提供默认值
      const result: SpeechContent = {
        title: parsed.title || `${studentName}学习情况解读演讲稿`,
        estimatedDuration: parsed.estimatedDuration || 12,
        sections: hasValidSections ? parsed.sections : this.getDefaultSections(studentName),
        learningRecommendations: hasValidRecommendations ? parsed.learningRecommendations : this.getDefaultRecommendations(),
        keyPoints: (parsed.keyPoints && parsed.keyPoints.length > 0) ? parsed.keyPoints : [
          '强调学生的进步和潜力',
          '用数据说话，增强说服力',
        ],
        cautions: (parsed.cautions && parsed.cautions.length > 0) ? parsed.cautions : [
          '本演讲稿仅供班主任内部使用',
          '根据家长反应灵活调整内容',
          '注意观察家长的情绪变化',
        ],
      };
      
      // 计算总字数
      const totalWords = result.sections.reduce((sum, s) => sum + (s.content?.length || 0), 0);
      console.log(`✅ 演讲稿解析完成，共 ${result.sections.length} 个段落，${result.learningRecommendations?.length || 0} 条学习建议，总字数约 ${totalWords}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ 解析 GLM 响应失败:', error);
      console.log('原始响应前500字符:', content.substring(0, 500));
      console.log('原始响应后500字符:', content.substring(content.length - 500));
      
      // 返回默认内容
      return this.getDefaultContent(studentName);
    }
  }
  
  /**
   * 获取默认段落内容
   */
  private getDefaultSections(studentName: string): SpeechContent['sections'] {
    return [
      {
        title: '一、开场问候',
        content: `您好！非常感谢您抽出宝贵的时间来了解${studentName}的学习情况。我是51Talk的班主任，今天想和您分享一下孩子最近的学习表现。`,
        duration: 2,
        notes: '保持微笑，建立亲和感',
      },
      {
        title: '二、关键学习数据',
        content: `让我们一起来看看${studentName}的关键学习数据。从报告中可以看到，孩子在各方面都有不同程度的进步...`,
        duration: 4,
        notes: '配合展示报告',
      },
      {
        title: '三、四大维度进步分析',
        content: `特别值得一提的是，${studentName}在表达流利度、自信心、语言应用和句子复杂度这四大维度上表现出了...`,
        duration: 4,
        notes: '语气热情',
      },
      {
        title: '四、待提升点详细分析',
        content: `当然，每个孩子都有继续进步的空间。我注意到${studentName}在发音和语法方面还可以做得更好...`,
        duration: 4,
        notes: '语气积极正面',
      },
      {
        title: '五、结束语',
        content: `再次感谢您的时间。如果您有任何问题，随时可以联系我。祝${studentName}学习进步！`,
        duration: 1,
        notes: '留下联系方式',
      },
    ];
  }
  
  /**
   * 获取默认学习建议
   */
  private getDefaultRecommendations(): LearningRecommendation[] {
    return [
      {
        content: '关于发音练习，我建议您每天抽出15分钟左右的时间，和孩子一起选择2-3个课文中的句子进行跟读。重点是让孩子模仿老师的语音语调，不用太在意速度，慢慢来。坚持一个月左右，您会发现孩子的发音会有明显的进步。',
      },
      {
        content: '在日常生活中，可以有意识地引导孩子用完整的句子来回答问题。比如问"你想吃什么"的时候，鼓励孩子说"I want to eat an apple"，而不是只说"apple"。这个习惯的养成需要时间，但对孩子的表达能力提升非常有帮助。',
      },
      {
        content: '课后复习也很重要。每次上完课，花10-15分钟帮孩子回顾一下今天学的单词和句型，可以通过简单的问答或者小游戏的方式。及时复习能帮助孩子更好地记住所学内容，上课的效果也会更好。',
      },
    ];
  }
  
  /**
   * 获取默认内容（当解析失败时使用）
   */
  private getDefaultContent(studentName: string): SpeechContent {
    return {
      title: `${studentName}学习情况解读演讲稿`,
      estimatedDuration: 15,
      sections: this.getDefaultSections(studentName),
      learningRecommendations: this.getDefaultRecommendations(),
      keyPoints: [
        '强调学生的进步和潜力',
        '用数据说话，增强说服力',
      ],
      cautions: [
        '本演讲稿仅供班主任内部使用',
        '根据家长反应灵活调整内容',
        '注意观察家长的情绪变化',
      ],
    };
  }
}

// 导出单例
export const interpretationService = new InterpretationService();
