import { useState } from "react";
import { VideoAnalysisForm } from "@/components/VideoAnalysisForm";
import { LoadingState } from "@/components/LoadingState";
import { ReportDisplay } from "@/components/ReportDisplay";
import logo51Talk from "@/assets/51talk-logo.jpg";

type AppState = "form" | "loading" | "report";

interface FormData {
  video1: string;
  video2: string;
  studentName: string;
  grade: string;
  level: string;
  unit: string;
}

// Mock data for demonstration
const MOCK_REPORT_DATA = {
  learningData: {
    handRaising: {
      trend: "提升",
      percentage: "↑ 15%",
      analysis: "本周主动发言次数相比上周增加了15%，展现出更强的课堂参与意愿"
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
      analysis: "学生的语言流利度有明显提升，说话时停顿减少，能够更自然地表达想法。从视频中可以看出，回答问题时的思考时间缩短了约2秒。",
      example: "第二个视频中回答 'What did you do yesterday?' 时，能够流畅地说出完整句子：'I went to the park and played with my friends.'"
    },
    confidence: {
      analysis: "自信心增强明显，声音洪亮，眼神交流更加自然。主动发言频率提升，愿意主动参与课堂互动。",
      example: "主动要求回答老师提问，并在回答时面带微笑，姿态自信"
    },
    languageApplication: {
      analysis: "开始尝试使用课堂外学到的词汇和表达，语言运用更加灵活多样。能够将所学知识应用到实际对话中。",
      example: "使用了 'awesome'、'fantastic' 等课外词汇来形容周末活动"
    },
    sentenceComplexity: {
      analysis: "句型结构更加复杂，开始使用复合句和连接词。不再局限于简单的主谓宾结构。",
      example: "能够说出：'I like swimming because it makes me feel happy and healthy.'"
    }
  },
  improvementAreas: {
    pronunciation: {
      overview: "这是目前最需要关注的系统提升的方面。",
      details: "由于连读加快，一些单词的发音细节容易被忽略。",
      examples: [
        {
          word: "awfully",
          incorrect: "/ˈɔː.fəli/ (a-fol-y)",
          correct: "/ˈɔː.f**l*i/",
          type: "元音不准确"
        },
        {
          word: "ballet",
          incorrect: "/bæˈleɪ/ (ba-late)",
          correct: "/ˈbæl.eɪ/",
          type: "重音问题"
        },
        {
          word: "evening",
          incorrect: "/ˈiːˈvænɪŋ/ (even-ing)",
          correct: "",
          type: "已改善"
        }
      ],
      persistentIssues: {
        title: "持续性问题",
        items: [
          "shell, scale 等以 sh 或 sc 开头且包含 l 的单词发音有合唱倾向",
          "feather 中的 /ð/ 音不够清晰"
        ]
      },
      suggestions: [
        {
          title: "慢下来",
          description: "在连读新词或不确定的单词时，可以刻意放慢语速。确保每个音节都被清晰地表达出来。"
        },
        {
          title: "跟读模仿",
          description: "找到这些单词的标准发音，进行多次跟读模仿，直至可以以下自己的声音和标准进行对比。"
        },
        {
          title: "关注音标",
          description: "学习和掌握一些关键元音和辅音的发音规则，特别是容易混淆的音素的发音。"
        }
      ]
    },
    grammar: {
      overview: "您的整体语法很好，但在一些细节上可以做得更完美。",
      examples: [
        {
          category: "第三人称单数",
          incorrect: "She is feeds her cat",
          correct: "She feeds her cat",
          explanation: "应当使用动词原形加s的形式"
        },
        {
          category: "动词搭配",
          incorrect: "My sister want to eat my make soup",
          correct: "...eat the soup I make/made",
          explanation: "使用正确的表达方式"
        },
        {
          category: "介词使用",
          incorrect: "feeding for his dog",
          correct: "feeding his dog",
          explanation: "介词选择使用"
        }
      ],
      suggestions: [
        {
          point: "在口语练习前，可以进行简短的语法复习，思考句子的构造规则，思考对于英语还原的习惯。"
        },
        {
          point: "针对性地做一些第三人称单数'喂养基础练习'等基础语法点，并通过句型练习巩固。"
        }
      ]
    },
    intonation: {
      observation: "在7月7日的课程中，由于环境原因和阅读紧张，她的语调起伏较少，听起来略显平淡。",
      suggestions: [
        {
          point: "多听一些自然的英语对话或故事（非正式演讲、生活化的内容），感受和模仿说话者的语调变化，让英语更富有生活情绪。"
        }
      ]
    }
  }
};

const Index = () => {
  const [appState, setAppState] = useState<AppState>("form");
  const [formData, setFormData] = useState<FormData | null>(null);

  const handleFormSubmit = (data: FormData) => {
    setFormData(data);
    setAppState("loading");
    
    // Simulate API call
    setTimeout(() => {
      setAppState("report");
    }, 8000);
  };

  const handleBackToForm = () => {
    setAppState("form");
    setFormData(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {appState === "form" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl mb-8 text-center">
            <img 
              src={logo51Talk} 
              alt="51Talk Logo" 
              className="h-16 mx-auto mb-4 bg-white p-2 rounded shadow-md"
            />
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-2">
              51Talk 学习分析
            </h1>
            <p className="text-lg text-muted-foreground">
              AI驱动的英语学习进步追踪系统
            </p>
          </div>
          <VideoAnalysisForm onSubmit={handleFormSubmit} />
        </div>
      )}

      {appState === "loading" && <LoadingState />}

      {appState === "report" && formData && (
        <ReportDisplay
          data={{
            studentName: formData.studentName,
            grade: formData.grade,
            level: formData.level,
            unit: formData.unit,
            ...MOCK_REPORT_DATA
          }}
          onBack={handleBackToForm}
        />
      )}
    </div>
  );
};

export default Index;
