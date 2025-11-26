/**
 * 📝 Mock 数据模块
 * 用于开发和测试的模拟分析方法
 */

import type { VideoAnalysisRequest, VideoAnalysisResponse } from '../../types/index.js';

/**
 * 用于开发和测试的模拟分析方法
 */
export async function analyzeMock(request: VideoAnalysisRequest): Promise<VideoAnalysisResponse> {
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
            description: "建议小明在回答问题时，首先圈出主要条件，然后画出关系，最后估计答案。这种方法有助于提高他的发音准确性和语言理解能力。"
          },
          {
            title: "音标学习与跟读模仿",
            description: "建议系统学习国际音标（IPA），掌握每个音素的正确发音方法。可以使用在线词典或APP查询单词的标准发音，进行多次跟读模仿。"
          }
        ]
      },
      grammar: {
        overview: "Leo在语法方面整体表现良好，在两次课堂中都能基本掌握简单句的结构。然而，在第三人称单数、动词搭配和介词使用等细节方面仍有提升空间。",
        details: "对比两次课堂的语法表现，Leo在基础句型的掌握上较为稳定，但在动词变化和时态一致性方面偶尔出现小错误。",
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
            explanation: "主语是第三人称单数时动词要加-s，定语从句的语序需要调整。"
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
            description: "在口语练习前，可以进行简短的语法复习。建议每次课前花5分钟回顾本节课重点语法规则。"
          },
          {
            title: "实时纠错与反馈",
            description: "在口语表达过程中，及时纠正语法错误并给予正面反馈。建议使用「三明治反馈法」。"
          }
        ]
      },
      intonation: {
        overview: "Leo在语调与节奏方面表现出积极的进步。对比两次课堂，Leo的语调从较为平淡、缺乏起伏变化，逐步发展为能够自然地使用升调和降调。",
        details: "在早期课堂中，Leo的语调较为平淡，缺乏起伏变化，句子节奏也不够自然。在最近课堂中，Leo的语调开始有更多的变化。",
        suggestions: [
          {
            title: "语调模仿练习",
            description: "建议通过模仿和重复练习来提高小明的语调变化，特别是通过听力材料和跟读练习。"
          },
          {
            title: "句子重音训练",
            description: "针对句子中的重点词汇进行重音标记和练习。建议在朗读句子时，先标出需要强调的关键词。"
          }
        ]
      }
    },
    overallSuggestions: [
      {
        title: "综合提升学习积极性与参与度",
        performanceSummary: "主动回答次数和课堂参与度较为稳定，建议通过目标设定和反馈机制进一步激发学习热情。",
        description: "基于两次课堂的对比分析，建议家长重点关注学生的学习积极性提升。通过设置课前小目标、及时给予正面反馈和奖励机制，鼓励学生主动参与课堂互动。"
      },
      {
        title: "加强语言表达完整性与准确性",
        performanceSummary: "完整句输出比例和语法准确率有待提升，特别是第三人称单数和时态变化方面。",
        description: "建议在日常练习中，鼓励学生使用完整句子进行表达，而非简单的单词或短语。可以通过角色扮演、情景对话等方式，帮助学生逐步提升语言表达的完整性和准确性。"
      },
      {
        title: "持续关注发音准确性与语调自然度",
        performanceSummary: "发音准确性和语调自然度有进步空间，特别是元音、辅音细节和句子重音方面。",
        description: "建议通过跟读练习、模仿标准发音等方式，持续提升学生的发音准确性和语调自然度。可以选择适合年龄段的英语动画片或儿歌进行跟读练习。"
      }
    ]
  };
}

