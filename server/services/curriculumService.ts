import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CurriculumContext,
  CurriculumDataRow,
  LEVEL_FILE_MAP,
  normalizeLevel
} from '../types/curriculum.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 📚 课程知识库服务
 * 
 * 功能：
 * 1. 加载所有课程JSON文件到内存
 * 2. 根据Level和Unit查询课程内容
 * 3. 格式化课程内容用于AI提示增强
 */
class CurriculumService {
  private curriculumData: Map<string, CurriculumDataRow[]> = new Map();
  private dataDirectory: string;
  private isLoaded: boolean = false;

  constructor() {
    // JSON文件存放在 docs 目录下
    this.dataDirectory = path.join(__dirname, '../../docs');
  }

  /**
   * 加载所有课程数据到内存
   */
  loadCurriculum(): void {
    if (this.isLoaded) {
      console.log('📚 课程数据已加载，跳过重复加载');
      return;
    }

    console.log('📚 开始加载课程知识库...');
    console.log(`📁 数据目录: ${this.dataDirectory}`);

    let loadedCount = 0;
    let errorCount = 0;

    for (const [level, fileName] of Object.entries(LEVEL_FILE_MAP)) {
      try {
        const filePath = path.join(this.dataDirectory, fileName);
        
        if (!fs.existsSync(filePath)) {
          console.warn(`⚠️  文件不存在: ${fileName}`);
          errorCount++;
          continue;
        }

        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent) as CurriculumDataRow[];
        
        this.curriculumData.set(level, data);
        loadedCount++;
        console.log(`✅ ${level}: 加载 ${data.length} 条数据`);
      } catch (error) {
        console.error(`❌ 加载 ${fileName} 失败:`, error);
        errorCount++;
      }
    }

    this.isLoaded = true;
    console.log(`\n📊 课程数据加载完成: ${loadedCount} 个级别成功, ${errorCount} 个失败\n`);
  }

  /**
   * 查询指定单元的课程内容
   * @param level 级别，如 "Level 3" 或 "L3"
   * @param unit 单元号，如 5、"5" 或 "Unit 5"
   * @returns 课程上下文信息，如果找不到返回 null
   */
  getCurriculumContext(level: string, unit: string | number): CurriculumContext | null {
    // 确保数据已加载
    if (!this.isLoaded) {
      this.loadCurriculum();
    }

    // 标准化输入
    const normalizedLevel = normalizeLevel(level);
    
    // 🔧 兼容 "Unit 2" 和 "2" 两种格式
    let unitNumber: number;
    if (typeof unit === 'string') {
      // 移除 "Unit " 前缀（不区分大小写）
      const cleanUnit = unit.replace(/^unit\s+/i, '').trim();
      unitNumber = parseInt(cleanUnit, 10);
    } else {
      unitNumber = unit;
    }

    if (isNaN(unitNumber)) {
      console.warn(`⚠️  无效的 Unit 值: ${unit}`);
      return null;
    }

    // 查找对应级别的数据
    const levelData = this.curriculumData.get(normalizedLevel);
    if (!levelData) {
      console.warn(`⚠️  找不到 ${normalizedLevel} 的课程数据`);
      return null;
    }

    // 筛选出对应的 Unit（可能有多行）
    const unitData = levelData.filter(row => {
      const rowUnit = row.Unit ?? row['Unit\n'];
      return rowUnit === unitNumber;
    });

    if (unitData.length === 0) {
      console.warn(`⚠️  ${normalizedLevel} 中找不到 Unit ${unitNumber}`);
      return null;
    }

    // 提取课程信息
    const context = this.extractCurriculumContext(normalizedLevel, unitNumber, unitData);
    
    console.log(`✅ 找到课程内容: ${normalizedLevel} Unit ${unitNumber} - ${context.theme}`);
    
    return context;
  }

  /**
   * 从原始数据行中提取课程上下文
   */
  private extractCurriculumContext(
    level: string,
    unit: number,
    rows: CurriculumDataRow[]
  ): CurriculumContext {
    const firstRow = rows[0];

    // 提取基本信息（考虑字段名可能带换行符）
    const theme = (firstRow.单元主题 ?? firstRow['单元主题\n'] ?? '').trim();
    const goals = (firstRow.单元知识目标 ?? firstRow['单元知识目标\n'] ?? '').trim();
    const lessonInfo = (firstRow.课程内容 ?? firstRow['课程内容\n'] ?? '').trim();
    const standard = (firstRow.匹配新课标 ?? firstRow['匹配新课标\n'] ?? '').trim();

    // 从 __EMPTY 字段提取词汇和句式
    const emptyContent = rows.map(row => row.__EMPTY ?? row['__EMPTY\n'] ?? '').join('\n');
    
    const vocabulary = this.extractVocabulary(emptyContent);
    const sentences = this.extractSentences(emptyContent);
    const phonics = this.extractPhonics(emptyContent);

    return {
      level,
      unit,
      theme,
      vocabulary,
      sentences,
      phonics,
      goals,
      lessonInfo,
      standard
    };
  }

  /**
   * 从文本中提取词汇列表
   */
  private extractVocabulary(text: string): string[] {
    const vocabulary: string[] = [];
    
    // 匹配 "词汇：" 后面的内容
    const vocabMatch = text.match(/词汇[：:]([\s\S]*?)(?=\n\n|句式|句子|拼读|绘本|$)/i);
    if (vocabMatch) {
      const vocabText = vocabMatch[1];
      // 分割词汇（可能用逗号、顿号、空格等分隔）
      const words = vocabText
        .split(/[,，、\s]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0 && w !== '等' && !/^\d+个$/.test(w));
      
      vocabulary.push(...words);
    }

    return vocabulary;
  }

  /**
   * 从文本中提取句式列表
   */
  private extractSentences(text: string): string[] {
    const sentences: string[] = [];
    
    // 匹配 "句式：" 或 "句子：" 后面的内容
    const sentenceMatch = text.match(/(?:句式|句子)[：:]([\s\S]*?)(?=\n\n|拼读|绘本|$)/i);
    if (sentenceMatch) {
      const sentenceText = sentenceMatch[1];
      // 按换行符分割句子
      const lines = sentenceText
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('—'));
      
      sentences.push(...lines);
    }

    // 也尝试匹配 —句式 格式
    const dashSentences = text.match(/—[^—\n]+/g);
    if (dashSentences) {
      sentences.push(...dashSentences.map(s => s.substring(1).trim()));
    }

    return sentences;
  }

  /**
   * 从文本中提取拼读内容
   */
  private extractPhonics(text: string): string[] {
    const phonics: string[] = [];
    
    // 匹配 "拼读：" 后面的内容
    const phonicsMatch = text.match(/拼读[：:]([\s\S]*?)(?=\n\n|绘本|$)/i);
    if (phonicsMatch) {
      const phonicsText = phonicsMatch[1];
      const items = phonicsText
        .split(/[,，、\s\n]+/)
        .map(p => p.trim())
        .filter(p => p.length > 0 && !/^\d+个$/.test(p));
      
      phonics.push(...items);
    }

    return phonics;
  }

  /**
   * 格式化课程内容，用于注入到AI提示中
   * 专门为"提升建议"部分优化
   */
  formatForImprovementSuggestions(context: CurriculumContext): string {
    const sections: string[] = [];

    // 标题
    sections.push(`## 📚 课程大纲参考 (${context.level} Unit ${context.unit})`);
    sections.push('');

    // 主题
    if (context.theme) {
      sections.push(`**单元主题**: ${context.theme}`);
      sections.push('');
    }

    // 学习目标
    if (context.goals) {
      sections.push(`**学习目标**: ${context.goals}`);
      sections.push('');
    }

    // 核心词汇（显示前15个）
    if (context.vocabulary.length > 0) {
      const vocabList = context.vocabulary.slice(0, 15).join(', ');
      sections.push(`【核心词汇】: ${vocabList}${context.vocabulary.length > 15 ? ', ...' : ''}`);
      sections.push('');
    }

    // 核心句式（显示前8个）
    if (context.sentences.length > 0) {
      sections.push('【核心句式】:');
      context.sentences.slice(0, 8).forEach((sentence, index) => {
        sections.push(`  ${index + 1}. ${sentence}`);
      });
      if (context.sentences.length > 8) {
        sections.push('  ...');
      }
      sections.push('');
    }

    // 拼读内容
    if (context.phonics.length > 0) {
      sections.push(`【拼读内容】: ${context.phonics.join(', ')}`);
      sections.push('');
    }

    // 使用说明
    sections.push('---');
    sections.push('**🔥 重要使用说明**:');
    sections.push('');
    sections.push('在生成"提升建议"(suggestions)时，你**必须**：');
    sections.push('1. **强制引用**上述课程内容中的具体词汇和句式');
    sections.push('2. 从【核心词汇】中选择2-3个单词作为练习例子');
    sections.push('3. 从【核心句式】中选择1-2个句子作为练习例子');
    sections.push('4. 说明具体的练习方法和步骤');
    sections.push('5. 确保两个建议标题和内容有明显差异（一个聚焦单词，一个聚焦句子）');
    sections.push('6. **🚨 关键要求**：在同一份报告的所有建议中（pronunciation、grammar、intonation），**必须使用不同的单词和句子**，避免重复引用相同的课程内容');
    sections.push('');
    sections.push('【示例格式】：');
    sections.push('"建议Leo进行单词跟读练习。从本单元的核心词汇中，可以选择以下单词进行重点练习：');
    sections.push('');
    sections.push('1) family /ˈfæməli/ - 注意 a 的发音');
    sections.push('2) brother /ˈbrʌðər/ - 注意 th 的发音');
    sections.push('');
    sections.push('练习建议：每天跟读5-10遍，注意模仿正确发音。"');
    sections.push('');
    sections.push('🚨 重要：在生成建议时，请直接引用单词和句子，不要使用任何 markdown 格式符号（如 ** 或 - 等），保持纯文本格式。');
    sections.push('');
    sections.push('【单词和句子分配建议】（确保不重复）：');
    sections.push('• 发音维度：选择包含特定音标的单词（如含th/r/l的单词）和基础句式');
    sections.push('• 语法维度：选择体现语法规则的单词（如动词、名词）和包含目标语法的句式');
    sections.push('• 语调维度：选择多音节单词和较长的表达性句式');
    sections.push('');

    return sections.join('\n');
  }

  /**
   * 格式化为简洁版本（用于prompt开头的上下文说明）
   */
  formatCompact(context: CurriculumContext): string {
    return `当前学习单元: ${context.level} Unit ${context.unit} - ${context.theme}`;
  }

  /**
   * 获取已加载的级别列表
   */
  getLoadedLevels(): string[] {
    return Array.from(this.curriculumData.keys());
  }

  /**
   * 获取指定级别的所有单元号
   */
  getUnitsForLevel(level: string): number[] {
    const normalizedLevel = normalizeLevel(level);
    const levelData = this.curriculumData.get(normalizedLevel);
    
    if (!levelData) {
      return [];
    }

    const units = new Set<number>();
    levelData.forEach(row => {
      const unitNum = row.Unit ?? row['Unit\n'];
      if (typeof unitNum === 'number') {
        units.add(unitNum);
      }
    });

    return Array.from(units).sort((a, b) => a - b);
  }
}

// 导出单例实例
export const curriculumService = new CurriculumService();

// 应用启动时加载数据
curriculumService.loadCurriculum();

