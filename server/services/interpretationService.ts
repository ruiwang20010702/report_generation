/**
 * 📝 解读版生成服务
 * 通过 GLM API 生成完整的15分钟销售演讲稿
 */

import OpenAI from 'openai';
import { AppError, ErrorType } from '../utils/errors.js';

// 演讲稿内容结构
export interface SpeechContent {
  // 演讲稿标题
  title: string;
  
  // 预计时长（分钟）
  estimatedDuration: number;
  
  // 演讲稿正文（完整的演讲内容，分段落）
  sections: {
    title: string;           // 段落标题
    content: string;         // 段落内容（完整的演讲文字）
    duration: number;        // 预计时长（分钟）
    notes?: string;          // 演讲备注/提示
  }[];
  
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
  
  // 整体建议
  overallSuggestions?: { title: string; description: string }[];
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
   * 生成完整的15分钟演讲稿
   */
  async generateInterpretation(reportData: ReportDataForInterpretation): Promise<SpeechContent> {
    if (!this.openai) {
      throw new AppError(
        ErrorType.API_KEY_ERROR,
        'GLM API Key 未配置',
        { userMessage: '无法生成解读版：GLM API Key 未配置' }
      );
    }
    
    console.log(`\n📝 开始生成15分钟演讲稿 - 学生: ${reportData.studentName}`);
    const startTime = Date.now();
    
    try {
      const prompt = this.buildPrompt(reportData);
      
      const response = await this.openai.chat.completions.create({
        model: 'glm-4-plus',
        messages: [
          {
            role: 'system',
            content: `你是51Talk的资深销售培训师，专门帮助销售人员准备与家长沟通的演讲稿。

你的任务是根据学生的学习报告，撰写一份完整的、约15分钟的演讲稿。这份演讲稿将用于销售人员与家长进行一对一沟通。

演讲稿要求：
1. 总时长约15分钟（按正常语速，每分钟约200字计算，总字数约3000字）
2. 内容要完整、连贯，像一篇真正的演讲稿，而不是要点提示
3. 语言要自然、亲切、有感染力，像朋友间的真诚交流
4. 要有清晰的结构：开场、数据解读、亮点展示、改进建议、套餐升级引导、结束
5. 每个部分都要有具体的话术，不是概括性的要点
6. 要结合具体的学生数据，让内容有针对性
7. 在适当的地方加入停顿、互动提示
8. 最后要自然地引导升级套餐，说明更高级套餐的优势

写作风格：
- 专业但不生硬
- 真诚而有说服力
- 以学生利益为出发点
- 自然地引导升级套餐，不要过度推销`
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
      
      if (response.usage) {
        console.log(`   Token 使用: ${response.usage.total_tokens} (输入: ${response.usage.prompt_tokens}, 输出: ${response.usage.completion_tokens})`);
      }
      
      // 解析 JSON 响应
      return this.parseResponse(content, reportData.studentName);
      
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
    
    // 整体建议
    if (data.overallSuggestions && data.overallSuggestions.length > 0) {
      const suggestionsText = data.overallSuggestions.map((s, i) => 
        `${i + 1}. ${s.title}: ${s.description}`
      ).join('\n');
      sections.push(`## 学习建议\n${suggestionsText}`);
    }
    
    return `请根据以下学生学习报告，撰写一份完整的15分钟销售演讲稿。

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
      "content": "完整的开场演讲内容，约2分钟，400字左右。包括问候、自我介绍、说明来意、建立亲和感。要写成完整的话术，不是要点。",
      "duration": 2,
      "notes": "保持微笑，语速适中"
    },
    {
      "title": "二、学习数据解读",
      "content": "完整的数据解读演讲内容，约4分钟，800字左右。逐一解读每个学习指标的变化，用家长能理解的语言解释数据含义，突出进步的地方。",
      "duration": 4,
      "notes": "可以配合展示报告图表"
    },
    {
      "title": "三、亮点展示与表扬",
      "content": "完整的亮点展示演讲内容，约3分钟，600字左右。详细描述学生的优秀表现，给出具体例子，让家长感到欣慰和自豪。",
      "duration": 3,
      "notes": "语气要热情，表达真诚的赞赏"
    },
    {
      "title": "四、改进空间与建议",
      "content": "完整的改进建议演讲内容，约3分钟，600字左右。委婉地指出需要改进的地方，强调这是成长机会而非问题，给出具体的改进建议。",
      "duration": 3,
      "notes": "语气要积极正面，强调潜力"
    },
    {
      "title": "五、升级套餐引导",
      "content": "完整的升级套餐引导演讲内容，约2分钟，400字左右。自然地引导升级话题，介绍更高级套餐的优势（如更多课时、更丰富的课程内容、专属学习顾问等），说明升级对孩子学习的帮助。",
      "duration": 2,
      "notes": "不要太强势，以孩子学习需求为出发点"
    },
    {
      "title": "六、结束语与后续跟进",
      "content": "完整的结束演讲内容，约1分钟，200字左右。总结本次沟通要点，表达感谢，说明后续跟进安排。",
      "duration": 1,
      "notes": "留下良好印象，为后续沟通铺垫"
    }
  ],
  "keyPoints": [
    "本次沟通的3-5个关键要点，帮助销售人员把握重点"
  ],
  "cautions": [
    "3-5条注意事项，如敏感话题、沟通禁忌、家长可能的反应等"
  ]
}
\`\`\`

重要提示：
1. 每个 section 的 content 必须是完整的演讲文字，不是要点或提纲
2. 总字数应在2500-3500字之间，确保能讲15分钟左右
3. 内容要结合具体的学生数据，有针对性
4. 语言要自然流畅，像真实的对话
5. 升级套餐的引导要自然，强调对孩子学习的帮助`;
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
      
      const parsed = JSON.parse(jsonStr);
      
      console.log('✅ JSON 解析成功');
      console.log('   - title:', parsed.title ? '有' : '无');
      console.log('   - sections 数量:', parsed.sections?.length || 0);
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
      
      // 验证必要字段并提供默认值
      const result: SpeechContent = {
        title: parsed.title || `${studentName}学习情况解读演讲稿`,
        estimatedDuration: parsed.estimatedDuration || 15,
        sections: hasValidSections ? parsed.sections : this.getDefaultSections(studentName),
        keyPoints: (parsed.keyPoints && parsed.keyPoints.length > 0) ? parsed.keyPoints : [
          '强调学生的进步和潜力',
          '用数据说话，增强说服力',
          '自然引导升级套餐，不要强推',
        ],
        cautions: (parsed.cautions && parsed.cautions.length > 0) ? parsed.cautions : [
          '本演讲稿仅供销售人员内部使用',
          '根据家长反应灵活调整内容',
          '注意观察家长的情绪变化',
        ],
      };
      
      // 计算总字数
      const totalWords = result.sections.reduce((sum, s) => sum + (s.content?.length || 0), 0);
      console.log(`✅ 演讲稿解析完成，共 ${result.sections.length} 个段落，总字数约 ${totalWords}`);
      
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
        content: `您好！非常感谢您抽出宝贵的时间来了解${studentName}的学习情况。我是51Talk的学习顾问，今天想和您分享一下孩子最近的学习表现。`,
        duration: 2,
        notes: '保持微笑，建立亲和感',
      },
      {
        title: '二、学习数据解读',
        content: `让我们一起来看看${studentName}的学习数据。从报告中可以看到，孩子在各方面都有不同程度的进步...`,
        duration: 4,
        notes: '配合展示报告',
      },
      {
        title: '三、亮点展示',
        content: `特别值得一提的是，${studentName}在课堂上表现出了很强的学习积极性...`,
        duration: 3,
        notes: '语气热情',
      },
      {
        title: '四、改进建议',
        content: `当然，每个孩子都有继续进步的空间。我注意到${studentName}在某些方面还可以做得更好...`,
        duration: 3,
        notes: '语气积极正面',
      },
      {
        title: '五、升级套餐引导',
        content: `为了帮助${studentName}取得更大的进步，我想和您介绍一下我们的升级套餐。升级后，孩子可以享受更多的课时、更丰富的课程内容，还有专属的学习顾问一对一跟进...`,
        duration: 2,
        notes: '以孩子学习需求为出发点',
      },
      {
        title: '六、结束语',
        content: `再次感谢您的时间。如果您有任何问题，随时可以联系我。祝${studentName}学习进步！`,
        duration: 1,
        notes: '留下联系方式',
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
      keyPoints: [
        '强调学生的进步和潜力',
        '用数据说话，增强说服力',
        '自然引导升级套餐，不要强推',
      ],
      cautions: [
        '本演讲稿仅供销售人员内部使用',
        '根据家长反应灵活调整内容',
        '注意观察家长的情绪变化',
      ],
    };
  }
}

// 导出单例
export const interpretationService = new InterpretationService();
