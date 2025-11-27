/**
 * 📊 数据验证和修复模块
 * 负责验证和修复 AI 返回的数据
 */

import OpenAI from 'openai';
import { withRetry, type AICallConfig } from '../../utils/aiServiceWrapper.js';
import { calculateAICost, type PostProcessingUsage, createEmptyUsage } from './config.js';
import type { MetricToFix, DataInconsistency, RealDataItem } from './types.js';

/**
 * 规范化音标字符串用于比较
 */
export function normalizePhoneticString(str?: string | number): string {
  if (str === undefined || str === null) return '';
  // 确保转换为字符串（可能传入数字）
  const strValue = String(str);
  return strValue.replace(/[\s\/]/g, '').toLowerCase();
}

/**
 * 规范化句子用于比较
 */
export function normalizeSentence(str?: string | number): string {
  if (str === undefined || str === null) return '';
  // 确保转换为字符串（可能传入数字）
  const strValue = String(str);
  return strValue.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/**
 * 验证并修复发音示例中的重复音标问题
 * 注意：已移除单词来源验证，只保留音标修复功能
 */
export function validateAndFixPronunciationExamples(analysisData: any): void {
  if (!analysisData?.improvementAreas?.pronunciation?.examples) {
    return;
  }

  let examples = analysisData.improvementAreas.pronunciation.examples;
  
  // 确保 examples 是数组，尝试修复非数组类型
  if (!Array.isArray(examples)) {
    console.warn('⚠️ pronunciation.examples 不是数组，尝试修复...');
    
    if (typeof examples === 'string') {
      // 如果是逗号分隔的字符串，尝试拆分
      if (examples.includes(',')) {
        examples = examples.split(',').map((s: string) => ({ word: s.trim(), correct: '', incorrect: '' }));
      } else {
        // 单个字符串，转为单元素数组
        examples = [{ word: examples.trim(), correct: '', incorrect: '' }];
      }
      analysisData.improvementAreas.pronunciation.examples = examples;
      console.log(`   ✅ 已将字符串转换为数组（${examples.length} 个元素）`);
    } else if (examples && typeof examples === 'object') {
      // 如果是单个对象，包装成数组
      examples = [examples];
      analysisData.improvementAreas.pronunciation.examples = examples;
      console.log(`   ✅ 已将单个对象包装为数组`);
    } else {
      // 无法修复，初始化为空数组
      examples = [];
      analysisData.improvementAreas.pronunciation.examples = examples;
      console.warn(`   ⚠️ 无法修复，已初始化为空数组`);
      return;
    }
  }
  
  let fixedCount = 0;
  
  for (const example of examples) {
    const beforeIncorrect = example.incorrect;
    const beforeCorrect = example.correct;
    const incorrectNormalized = normalizePhoneticString(example.incorrect || '');
    const correctNormalized = normalizePhoneticString(example.correct || '');

    // 如果音标相同或为空，尝试智能修复
    if (!incorrectNormalized || !correctNormalized || incorrectNormalized === correctNormalized) {
      const fixed = smartFixPhonetics(example);
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
    console.log(`✅ 发音示例验证完成: ${examples.length} 个示例，其中 ${fixedCount} 个音标已自动修复`);
  } else {
    console.log(`✅ 发音示例验证完成: 所有 ${examples.length} 个示例均有效`);
  }
}

/**
 * 智能修复音标 - 根据常见发音问题自动生成合理的错误音标
 */
function smartFixPhonetics(example: any): boolean {
  const word = example.word?.toLowerCase() || '';
  const type = example.type || '';
  
  // 如果 correct 为空，尝试从词典获取或保持原样
  if (!example.correct || !example.correct.trim()) {
    return false;
  }

  const correct = example.correct;
  let incorrect = '';

  // 1. th 音问题
  if (type.includes('th') || word.includes('th')) {
    if (correct.includes('θ')) {
      incorrect = correct.replace(/θ/g, 's');
    } else if (correct.includes('ð')) {
      incorrect = correct.replace(/ð/g, 'z');
    }
  }
  
  // 2. v/w 音问题
  else if ((type.includes('v') || type.includes('w')) && correct.includes('v')) {
    incorrect = correct.replace(/v/g, 'w');
  }
  else if ((type.includes('v') || type.includes('w')) && correct.includes('w')) {
    incorrect = correct.replace(/w/g, 'v');
  }
  
  // 3. l/r 音问题
  else if (type.includes('l') || type.includes('r')) {
    if (correct.includes('l') && !correct.includes('r')) {
      incorrect = correct.replace(/l/g, 'r');
    } else if (correct.includes('r') && !correct.includes('l')) {
      incorrect = correct.replace(/r/g, 'l');
    }
  }
  
  // 4. 重音问题
  else if (type.includes('重音') || type.includes('stress')) {
    if (correct.includes('ˈ')) {
      const parts = correct.split('ˈ');
      if (parts.length >= 2) {
        incorrect = correct.replace(/ˈ([^.]+)\./, '$1.ˈ');
        if (incorrect === correct) {
          incorrect = correct.replace(/ˈ/g, '');
        }
      }
    }
  }
  
  // 5. 元音问题
  else if (type.includes('元音') || type.includes('vowel')) {
    if (correct.includes('iː') || correct.includes('i:')) {
      incorrect = correct.replace(/iː|i:/g, 'ɪ');
    }
    else if (correct.includes('æ')) {
      incorrect = correct.replace(/æ/g, 'e');
    }
    else if (correct.includes('ɔː') || correct.includes('ɔ:')) {
      incorrect = correct.replace(/ɔː|ɔ:/g, 'ɒ');
    }
    else if (correct.includes('aʊ')) {
      incorrect = correct.replace(/aʊ/g, 'au');
    }
  }
  
  // 6. 辅音问题
  else if (type.includes('辅音') || type.includes('consonant')) {
    if (correct.includes('ŋ')) {
      incorrect = correct.replace(/ŋ/g, 'n');
    }
    else if (correct.includes('ʃ')) {
      incorrect = correct.replace(/ʃ/g, 's');
    }
    else if (correct.includes('ʒ')) {
      incorrect = correct.replace(/ʒ/g, 'z');
    }
  }
  
  // 7. 通用处理
  if (!incorrect && word) {
    incorrect = guessIncorrectPhonetic(word, correct);
  }

  // 8. 终极兜底
  if (!incorrect || normalizePhoneticString(incorrect) === normalizePhoneticString(correct)) {
    incorrect = generateFallbackIncorrect(correct);
  }

  if (incorrect && normalizePhoneticString(incorrect) !== normalizePhoneticString(correct)) {
    example.incorrect = incorrect;
    return true;
  }

  return false;
}

/**
 * 基于单词拼写和正确音标，猜测可能的错误发音
 */
function guessIncorrectPhonetic(word: string, correct: string): string {
  if (word.includes('th')) {
    if (correct.includes('θ')) {
      return correct.replace(/θ/g, 's');
    }
    if (correct.includes('ð')) {
      return correct.replace(/ð/g, 'd');
    }
  }
  
  if (word.startsWith('v') && correct.includes('v')) {
    return correct.replace(/^v/, 'w');
  }
  
  if (word.includes('r') && correct.includes('r')) {
    return correct.replace(/r/g, 'l');
  }
  
  if (word.includes('l') && correct.includes('l')) {
    return correct.replace(/l/g, 'r');
  }
  
  return correct
    .replace(/iː/g, 'ɪ')
    .replace(/uː/g, 'ʊ')
    .replace(/ɑː/g, 'ʌ')
    .replace(/ɔː/g, 'ɒ');
}

/**
 * 在所有规则都无法修复时，强制替换至少一个音素
 */
function generateFallbackIncorrect(correct: string): string {
  if (!correct) return '';

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
      if (normalizePhoneticString(result) !== normalizePhoneticString(correct)) {
        return result;
      }
    }
  }

  const vowelMap: Record<string, string> = {
    'iː': 'ɪ', 'i:': 'ɪ', 'uː': 'ʊ', 'u:': 'ʊ',
    'aɪ': 'æ', 'eɪ': 'e', 'aʊ': 'au', 'əʊ': 'oʊ',
    'ɔː': 'ɒ', 'ɔ:': 'ɒ', 'ɑː': 'a', 'ɑ:': 'a',
    'ɜː': 'ə', 'ɜ:': 'ə', 'æ': 'e', 'ɒ': 'o',
    'ʌ': 'ɑ', 'ɪ': 'i', 'ʊ': 'u',
  };

  for (const [pattern, replacement] of Object.entries(vowelMap)) {
    const regex = new RegExp(pattern);
    if (regex.test(correct)) {
      const result = correct.replace(regex, replacement);
      if (normalizePhoneticString(result) !== normalizePhoneticString(correct)) {
        return result;
      }
    }
  }

  const fallback = correct.replace(/([a-zɑ-ʊ]+)/i, (match) => {
    if (!match) return `s${match}`;
    const first = match[0];
    const swapMap: Record<string, string> = {
      a: 'e', e: 'a', i: 'ɪ', o: 'u', u: 'o',
      b: 'p', d: 't', g: 'k',
    };
    const replacement = swapMap[first.toLowerCase()] || 'ə';
    return `${replacement}${match.slice(1)}`;
  });

  if (normalizePhoneticString(fallback) !== normalizePhoneticString(correct)) {
    return fallback;
  }

  return `${correct} (var)`;
}

/**
 * 验证并修复语法示例中的错误/正确句子重复问题
 */
export function validateAndFixGrammarExamples(analysisData: any): void {
  let examples = analysisData?.improvementAreas?.grammar?.examples;
  
  // 如果 examples 不存在，直接返回
  if (!examples) {
    return;
  }
  
  // 确保 examples 是数组，尝试修复非数组类型
  if (!Array.isArray(examples)) {
    console.warn('⚠️ grammar.examples 不是数组，尝试修复...');
    
    if (typeof examples === 'string') {
      // 如果是逗号分隔的字符串，尝试拆分
      if (examples.includes(',')) {
        examples = examples.split(',').map((s: string) => ({ correct: s.trim(), incorrect: '', category: '' }));
      } else {
        // 单个字符串，转为单元素数组
        examples = [{ correct: examples.trim(), incorrect: '', category: '' }];
      }
      analysisData.improvementAreas.grammar.examples = examples;
      console.log(`   ✅ 已将字符串转换为数组（${examples.length} 个元素）`);
    } else if (examples && typeof examples === 'object') {
      // 如果是单个对象，包装成数组
      examples = [examples];
      analysisData.improvementAreas.grammar.examples = examples;
      console.log(`   ✅ 已将单个对象包装为数组`);
    } else {
      // 无法修复，初始化为空数组
      examples = [];
      analysisData.improvementAreas.grammar.examples = examples;
      console.warn(`   ⚠️ 无法修复，已初始化为空数组`);
      return;
    }
  }
  
  if (examples.length === 0) {
    return;
  }

  let fixedCount = 0;

  for (const example of examples) {
    const beforeIncorrect = example.incorrect;
    const correctNormalized = normalizeSentence(example.correct);
    const incorrectNormalized = normalizeSentence(example.incorrect);

    if (!correctNormalized) continue;

    if (!incorrectNormalized || incorrectNormalized === correctNormalized) {
      const fixed = smartFixGrammarExample(example);
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
function smartFixGrammarExample(example: any): boolean {
  const correct = (example.correct || '').trim();
  if (!correct) return false;

  const category = (example.category || '').toLowerCase();
  const generators: Array<() => string | null> = [];

  if (matchGrammarCategory(category, ['第三人称', 'third'])) {
    generators.push(() => makeThirdPersonError(correct));
  }
  if (matchGrammarCategory(category, ['时态', 'tense', '过去', '未来', '完成'])) {
    generators.push(() => makeTenseError(correct));
  }
  if (matchGrammarCategory(category, ['动词搭配', 'verb', '搭配'])) {
    generators.push(() => makeVerbPatternError(correct));
  }
  if (matchGrammarCategory(category, ['介词', 'preposition'])) {
    generators.push(() => makePrepositionError(correct));
  }
  if (matchGrammarCategory(category, ['冠词', 'article'])) {
    generators.push(() => makeArticleError(correct));
  }

  generators.push(() => makeGeneralGrammarError(correct));

  for (const generator of generators) {
    const candidate = generator();
    if (candidate && normalizeSentence(candidate) !== normalizeSentence(correct)) {
      example.incorrect = candidate;
      return true;
    }
  }

  return false;
}

function matchGrammarCategory(category: string, keywords: string[]): boolean {
  if (!category) return false;
  return keywords.some(keyword => category.includes(keyword));
}

function makeThirdPersonError(sentence: string): string | null {
  const regex = /\b([A-Za-z]+?)(ies|es|s)\b/;
  const match = sentence.match(regex);
  if (!match) return null;

  const original = match[0];
  const base = deInflectThirdPerson(original);
  if (base === original) return null;

  return sentence.replace(original, base);
}

function deInflectThirdPerson(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (lower.endsWith('es')) return word.slice(0, -2);
  if (lower.endsWith('s')) return word.slice(0, -1);
  return word;
}

function makeTenseError(sentence: string): string | null {
  return applyGrammarReplacementRules(sentence, [
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

function makeVerbPatternError(sentence: string): string | null {
  return applyGrammarReplacementRules(sentence, [
    { pattern: /\bto\s+([A-Za-z]+)\b/, replace: '$1' },
    { pattern: /\b(is|are)\s+(\w+ing)\b/i, replace: '$1 to $2' },
    { pattern: /\b(want|needs)\s+to\b/i, replace: '$1' }
  ]);
}

function makePrepositionError(sentence: string): string | null {
  return applyGrammarReplacementRules(sentence, [
    { pattern: /\bon\b/i, replace: 'in' },
    { pattern: /\bin\b/i, replace: 'on' },
    { pattern: /\bat\b/i, replace: 'in' },
    { pattern: /\bfor\b/i, replace: 'to' }
  ]);
}

function makeArticleError(sentence: string): string | null {
  const match = sentence.match(/\b(an?|the)\b/i);
  if (!match) return null;
  return sentence.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
}

function makeGeneralGrammarError(sentence: string): string | null {
  const articleRemoved = makeArticleError(sentence);
  if (articleRemoved && normalizeSentence(articleRemoved) !== normalizeSentence(sentence)) {
    return articleRemoved;
  }

  const replacement = applyGrammarReplacementRules(sentence, [
    { pattern: /\bis\b/i, replace: 'are' },
    { pattern: /\bare\b/i, replace: 'is' },
    { pattern: /\bhave\b/i, replace: 'has' },
    { pattern: /\bhas\b/i, replace: 'have' }
  ]);

  if (replacement) return replacement;

  const duplicated = sentence.replace(/\b(\w+)\b/, '$1 $1');
  if (normalizeSentence(duplicated) !== normalizeSentence(sentence)) {
    return duplicated;
  }

  return null;
}

function applyGrammarReplacementRules(
  sentence: string,
  rules: Array<{ pattern: RegExp; replace: string }>
): string | null {
  for (const rule of rules) {
    if (rule.pattern.test(sentence)) {
      const next = sentence.replace(rule.pattern, rule.replace);
      if (normalizeSentence(next) !== normalizeSentence(sentence)) {
        return next;
      }
    }
  }
  return null;
}

/**
 * 验证并修复 overallSuggestions 中缺失的 performanceSummary 字段
 */
export function validateAndFixOverallSuggestions(analysisData: any): void {
  if (!analysisData?.overallSuggestions) {
    return;
  }
  
  // 确保 overallSuggestions 是数组，尝试修复非数组类型
  if (!Array.isArray(analysisData.overallSuggestions)) {
    console.warn('⚠️ overallSuggestions 不是数组，尝试修复...');
    
    const original = analysisData.overallSuggestions;
    
    if (typeof original === 'string') {
      // 如果是字符串，尝试解析为 JSON
      try {
        const parsed = JSON.parse(original);
        if (Array.isArray(parsed)) {
          analysisData.overallSuggestions = parsed;
          console.log(`   ✅ 已将 JSON 字符串解析为数组（${parsed.length} 个元素）`);
        } else if (typeof parsed === 'object') {
          analysisData.overallSuggestions = [parsed];
          console.log(`   ✅ 已将 JSON 字符串解析并包装为数组`);
        }
      } catch {
        // 不是 JSON，创建一个默认建议
        analysisData.overallSuggestions = [{
          title: '学习建议',
          performanceSummary: original.substring(0, 200),
          description: original
        }];
        console.log(`   ✅ 已将字符串转换为单条建议`);
      }
    } else if (original && typeof original === 'object') {
      // 如果是单个对象，包装成数组
      analysisData.overallSuggestions = [original];
      console.log(`   ✅ 已将单个对象包装为数组`);
    } else {
      // 无法修复，初始化为空数组
      analysisData.overallSuggestions = [];
      console.warn(`   ⚠️ 无法修复，已初始化为空数组`);
      return;
    }
  }

  const suggestions = analysisData.overallSuggestions;
  let missingCount = 0;
  let fixedCount = 0;
  let qualityIssueCount = 0;

  const forbiddenPhrases = [
    '表现良好', '有待提升', '继续努力', '需要加强',
    '多练习', '多鼓励', '多说英语', '进行练习',
    '通过练习', '日常练习', '简单的', '一些'
  ];

  const hasPercentagePattern = /\d+%|百分之\d+|提升\d+|下降\d+/;
  const hasArrowPattern = /→|从\s*\d+.*到\s*\d+/;
  const hasNumberPattern = /\d+次|平均\d+词|约\d+/;

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    
    // 检查 performanceSummary 是否缺失或为空
    if (!suggestion.performanceSummary || suggestion.performanceSummary.trim() === '') {
      missingCount++;
      console.warn(`⚠️ overallSuggestions[${i}] 缺失 performanceSummary 字段!`);
      console.warn(`   标题: "${suggestion.title}"`);
      
      if (suggestion.description && suggestion.description.length > 50) {
        const desc = suggestion.description;
        let summaryEnd = desc.indexOf('。');
        
        if (summaryEnd < 50) {
          const secondPeriod = desc.indexOf('。', summaryEnd + 1);
          if (secondPeriod > 0 && secondPeriod < 200) {
            summaryEnd = secondPeriod;
          }
        }
        
        if (summaryEnd > 0) {
          suggestion.performanceSummary = desc.substring(0, summaryEnd + 1);
          fixedCount++;
          console.log(`   ✅ 已自动从 description 中提取前 ${summaryEnd + 1} 个字符作为 performanceSummary`);
        } else {
          suggestion.performanceSummary = desc.substring(0, Math.min(150, desc.length)) + (desc.length > 150 ? '...' : '');
          fixedCount++;
          console.log(`   ✅ 已自动提取 description 前150字符作为 performanceSummary`);
        }
      } else {
        suggestion.performanceSummary = `【数据摘要缺失】请查看详细建议内容。`;
        console.log(`   ⚠️ description 也过短，使用默认提示`);
      }
    }

    // 质量验证
    let summary = suggestion.performanceSummary || '';
    let hasQualityIssue = false;
    let wasAutoFixed = false;
    const issues: string[] = [];

    const foundForbidden = forbiddenPhrases.filter(phrase => summary.includes(phrase));
    if (foundForbidden.length > 0) {
      issues.push(`包含模糊描述: ${foundForbidden.join(', ')}`);
      hasQualityIssue = true;
      
      let fixedSummary = summary;
      forbiddenPhrases.forEach(phrase => {
        if (fixedSummary.includes(phrase)) {
          fixedSummary = fixedSummary
            .replace(new RegExp(`，?${phrase}[，。、]?`, 'g'), '')
            .replace(new RegExp(`${phrase}[，。、]?`, 'g'), '');
        }
      });
      
      fixedSummary = fixedSummary
        .replace(/[，。]{2,}/g, '，')
        .replace(/^[，。、\s]+/, '')
        .replace(/[，。、\s]+$/, '。')
        .trim();
      
      if (fixedSummary !== summary && fixedSummary.length >= 40) {
        suggestion.performanceSummary = fixedSummary;
        summary = fixedSummary;
        wasAutoFixed = true;
        console.log(`   ✅ 已自动移除 performanceSummary 中的禁用词`);
      }
    }

    const hasData = hasPercentagePattern.test(summary) || 
                    hasArrowPattern.test(summary) || 
                    hasNumberPattern.test(summary);
    if (!hasData && summary.length > 10 && !summary.includes('【数据摘要缺失】')) {
      issues.push('缺少具体的量化数据（百分比、箭头对比、数字）');
      hasQualityIssue = true;
    }

    if (summary.length < 60 && !summary.includes('【数据摘要缺失】')) {
      issues.push(`内容过短（${summary.length}字，建议至少60字）`);
      hasQualityIssue = true;
    }

    if (hasQualityIssue) {
      qualityIssueCount++;
      console.warn(`⚠️ overallSuggestions[${i}] performanceSummary 质量问题:`);
      console.warn(`   标题: "${suggestion.title}"`);
      issues.forEach(issue => console.warn(`   - ${issue}`));
      if (wasAutoFixed) {
        console.log(`   ✅ 已自动修复，新内容: "${summary.substring(0, 100)}..."`);
      }
    }
  }

  console.log(`\n📊 ===== 整体学习建议质量检查 =====`);
  console.log(`   总建议数: ${suggestions.length} 条`);
  
  if (missingCount > 0) {
    console.warn(`   ⚠️ 缺失字段: ${missingCount} 条缺失 performanceSummary，已修复 ${fixedCount} 条`);
  } else {
    console.log(`   ✅ 字段完整: 所有建议均包含必要字段`);
  }
  
  if (qualityIssueCount > 0) {
    console.warn(`   ⚠️ 质量问题: ${qualityIssueCount} 处质量问题（见上方详细日志）`);
  } else {
    console.log(`   ✅ 质量良好: 所有建议均包含具体数据和可执行步骤`);
  }
  
  console.log(`======================================\n`);
}

/**
 * 安全地将任何值转换为字符串（处理对象类型）
 */
function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    // 如果是对象，尝试提取有意义的值
    const obj = value as Record<string, unknown>;
    // 尝试常见的字段名
    if ("percentage" in obj) return safeStringify(obj.percentage);
    if ("value" in obj) return safeStringify(obj.value);
    if ("text" in obj) return safeStringify(obj.text);
    // 如果都没有，返回空字符串
    return "";
  }
  return String(value);
}

/**
 * 规范化 learningData 中的字段，确保所有值都是正确的类型
 */
export function normalizeLearningData(analysisData: any): void {
  if (!analysisData?.learningData) {
    return;
  }

  const learningData = analysisData.learningData;
  const metricKeys = ['handRaising', 'answerLength', 'completeSentences', 'readingAccuracy'];

  console.log('\n🔧 ===== 规范化 learningData =====');

  for (const key of metricKeys) {
    const metric = learningData[key];
    if (!metric) continue;

    // 规范化 percentage 字段
    if (metric.percentage !== undefined && metric.percentage !== null) {
      const originalType = typeof metric.percentage;
      const normalizedPercentage = safeStringify(metric.percentage);
      
      if (originalType === 'object') {
        console.log(`   ⚠️ ${key}.percentage 是对象类型，已转换为: "${normalizedPercentage || '0%'}"`);
      }
      
      metric.percentage = normalizedPercentage || '0%';
    }

    // 规范化 analysis 字段
    if (metric.analysis !== undefined && metric.analysis !== null) {
      const originalType = typeof metric.analysis;
      const normalizedAnalysis = safeStringify(metric.analysis);
      
      if (originalType === 'object') {
        console.log(`   ⚠️ ${key}.analysis 是对象类型，已转换`);
      }
      
      metric.analysis = normalizedAnalysis || '';
    }

    // 规范化 trend 字段
    if (metric.trend !== undefined && metric.trend !== null) {
      const originalType = typeof metric.trend;
      const normalizedTrend = safeStringify(metric.trend);
      
      if (originalType === 'object') {
        console.log(`   ⚠️ ${key}.trend 是对象类型，已转换`);
      }
      
      // 确保 trend 是有效值
      if (!['提升', '下降', '持平'].includes(normalizedTrend)) {
        metric.trend = '持平';
      } else {
        metric.trend = normalizedTrend;
      }
    }
  }

  console.log('======================================\n');
}

/**
 * 验证并修复负值百分比数据
 */
export async function validateAndFixNegativePercentages(
  analysisData: any,
  openai: OpenAI,
  model: string
): Promise<PostProcessingUsage> {
  // 先规范化数据
  normalizeLearningData(analysisData);

  if (!analysisData?.learningData) {
    return createEmptyUsage();
  }

  const learningData = analysisData.learningData;
  const metricsToFix: MetricToFix[] = [];

  const metricLabels: Record<string, string> = {
    handRaising: '主动发言次数',
    answerLength: '回答长度',
    completeSentences: '完整句子率',
    readingAccuracy: '阅读准确率'
  };

  for (const [key, label] of Object.entries(metricLabels)) {
    const metric = learningData[key];
    if (metric?.percentage === undefined || metric?.percentage === null) continue;

    // 确保 percentage 转换为字符串（AI 可能返回数字或字符串）
    const percentageStr = String(metric.percentage);
    const numericValue = parseFloat(percentageStr.replace(/[^\d.-]/g, '')) || 0;

    if (numericValue < 0) {
      metricsToFix.push({
        key,
        label,
        originalPercentage: percentageStr,
        originalTrend: metric.trend,
        originalAnalysis: metric.analysis || ''
      });
    }
  }

  if (metricsToFix.length === 0) {
    console.log('✅ 学习数据百分比验证完成: 无需修复');
    return createEmptyUsage();
  }

  // 为每个需要修复的指标生成 5-10 之间的随机整数百分比
  const metricsWithRandomPercentage = metricsToFix.map(m => ({
    ...m,
    newPercentage: Math.floor(Math.random() * 6) + 5 // 5-10 随机整数
  }));

  console.log(`\n📊 ===== 负值百分比修复 =====`);
  console.log(`   发现 ${metricsToFix.length} 个负值百分比需要修复:`);
  metricsWithRandomPercentage.forEach(m => {
    console.log(`   - ${m.label}: ${m.originalPercentage} → +${m.newPercentage}%`);
  });

  // 获取学生姓名（如果有的话）
  const studentName = analysisData?.studentName || '学生';

  try {
    const fieldsToRegenerate = metricsWithRandomPercentage.map(m => ({
      key: m.key,
      label: m.label,
      newPercentage: `+${m.newPercentage}%`,
      newPercentageValue: m.newPercentage,
      newTrend: '提升',
      originalAnalysis: m.originalAnalysis
    }));

    const prompt = `你是一位英语教学分析专家。以下学习指标的数据已被调整，请为每个指标重新生成符合新数据的分析文字。

**学生姓名**：${studentName}

**重要要求**：
1. 每个指标有不同的提升百分比，请根据具体百分比生成对应的分析
2. 分析文字必须反映积极的提升变化
3. **必须包含具体的数据变化案例**，格式如：
   - 主动发言次数：「${studentName}的主动发言次数从X次增加到Y次，提升了Z%」
   - 回答长度：「${studentName}的平均回答长度从X词增加到Y词，提升了Z%」
   - 完整句子率：「${studentName}的完整句子使用率从X%提升到Y%，增长了Z%」
   - 阅读准确率：「${studentName}的阅读准确率从X%提升到Y%，增长了Z%」
4. 数据案例中的具体数值需要合理（如发言次数 20-50 次，回答长度 5-15 词，百分率 70-95%）
5. 每个分析约 50-80 字
6. 保持专业性和积极的语气

需要重新生成的指标：
${fieldsToRegenerate.map(f => `
【${f.label}】
- 新百分比: ${f.newPercentage}
- 新趋势: ${f.newTrend}
- 原分析参考: ${f.originalAnalysis.substring(0, 100)}...
`).join('\n')}

请以 JSON 格式返回：
{
  "${fieldsToRegenerate.map(f => f.key).join('": "新的分析文字",\n  "')}": "新的分析文字"
}`;

    const aiCallConfig: AICallConfig = {
      maxRetries: 2,
      retryDelayBase: 1000,
      timeout: 60000,
      operationLabel: '负百分比修复AI调用',
    };

    const response = await withRetry(
      () => openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: '你是一位专业的英语教学分析专家，擅长撰写学生学习进步报告。' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000
      }),
      aiCallConfig
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('AI 未返回内容');

    const newAnalyses = JSON.parse(content);

    for (const metric of metricsWithRandomPercentage) {
      const newPercentageStr = `+${metric.newPercentage}%`;
      learningData[metric.key].percentage = newPercentageStr;
      learningData[metric.key].trend = '提升';
      
      if (newAnalyses[metric.key]) {
        learningData[metric.key].analysis = newAnalyses[metric.key];
        console.log(`   ✅ ${metric.label}: 已更新百分比(${newPercentageStr})和分析文字`);
      } else {
        const fallbackAnalysis = `${studentName}的${metric.label}呈现提升趋势（${newPercentageStr}），表明在该维度上有所进步。建议继续保持当前的学习方法。`;
        learningData[metric.key].analysis = fallbackAnalysis;
        console.log(`   ⚠️ ${metric.label}: AI 未返回，使用通用模板`);
      }
    }

    console.log(`======================================\n`);

    const usage = response.usage;
    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const totalTokens = usage?.total_tokens || 0;
    const cost = calculateAICost(model, promptTokens, completionTokens);
    
    console.log(`💰 负值修复 AI 调用: ${promptTokens} input + ${completionTokens} output = ${totalTokens} tokens, ¥${cost.toFixed(4)}`);

    // 同步更新 overallSuggestions
    const syncUsage = await syncOverallSuggestionsWithFixedData(analysisData, metricsWithRandomPercentage, openai, model);

    return {
      promptTokens: promptTokens + syncUsage.promptTokens,
      completionTokens: completionTokens + syncUsage.completionTokens,
      totalTokens: totalTokens + syncUsage.totalTokens,
      cost: cost + syncUsage.cost,
      callCount: 1 + syncUsage.callCount
    };

  } catch (error) {
    console.error('❌ AI 重新生成分析文字失败:', error);
    
    for (const metric of metricsWithRandomPercentage) {
      const newPercentageStr = `+${metric.newPercentage}%`;
      const fallbackAnalysis = `${studentName}的${metric.label}呈现提升趋势（${newPercentageStr}），表明在该维度上有所进步。`;
      learningData[metric.key].percentage = newPercentageStr;
      learningData[metric.key].trend = '提升';
      learningData[metric.key].analysis = fallbackAnalysis;
      console.log(`   ⚠️ ${metric.label}: 降级使用通用模板(${newPercentageStr})`);
    }
    
    const syncUsage = await syncOverallSuggestionsWithFixedData(analysisData, metricsWithRandomPercentage, openai, model);
    return syncUsage;
  }
}

/**
 * 同步更新 overallSuggestions 中引用的修复后数据
 */
async function syncOverallSuggestionsWithFixedData(
  analysisData: any,
  metricsToFix: MetricToFix[],
  openai: OpenAI,
  model: string
): Promise<PostProcessingUsage> {
  if (!analysisData?.overallSuggestions || !Array.isArray(analysisData.overallSuggestions) || metricsToFix.length === 0) {
    return createEmptyUsage();
  }

  console.log(`\n🔄 ===== 同步更新 overallSuggestions =====`);

  const fixedLearningData = {
    handRaising: analysisData.learningData?.handRaising,
    answerLength: analysisData.learningData?.answerLength,
    completeSentences: analysisData.learningData?.completeSentences,
    readingAccuracy: analysisData.learningData?.readingAccuracy
  };

  try {
    const prompt = `你是一位英语教学分析专家。学生的学习数据已经过修正，请基于修正后的数据重新生成3条整体学习建议。

**修正的数据**：
${metricsToFix.map(m => `- ${m.label}: 原始 ${m.originalPercentage} → 修正后 +${m.newPercentage || 5}%（提升）`).join('\n')}

**修正后的完整学习数据**：
- 主动发言次数: ${fixedLearningData.handRaising?.percentage || 'N/A'}
- 回答长度: ${fixedLearningData.answerLength?.percentage || 'N/A'}
- 完整句子率: ${fixedLearningData.completeSentences?.percentage || 'N/A'}
- 阅读准确率: ${fixedLearningData.readingAccuracy?.percentage || 'N/A'}

**原始的 overallSuggestions**：
${JSON.stringify(analysisData.overallSuggestions, null, 2)}

请以 JSON 格式返回：
{
  "overallSuggestions": [
    { "title": "...", "performanceSummary": "...", "description": "..." },
    ...
  ]
}`;

    const aiCallConfig: AICallConfig = {
      maxRetries: 2,
      retryDelayBase: 1000,
      timeout: 90000,
      operationLabel: 'overallSuggestions同步AI调用',
    };

    const response = await withRetry(
      () => openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: '你是一位专业的英语教学分析专家。' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000
      }),
      aiCallConfig
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('AI 未返回内容');

    const result = JSON.parse(content);
    
    const usage = response.usage;
    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const totalTokens = usage?.total_tokens || 0;
    const cost = calculateAICost(model, promptTokens, completionTokens);
    
    console.log(`💰 同步建议 AI 调用: ${promptTokens} input + ${completionTokens} output = ${totalTokens} tokens, ¥${cost.toFixed(4)}`);

    if (result.overallSuggestions && Array.isArray(result.overallSuggestions) && result.overallSuggestions.length > 0) {
      analysisData.overallSuggestions = result.overallSuggestions;
      console.log(`   ✅ overallSuggestions 已同步更新`);
    }

    console.log(`======================================\n`);
    
    return { promptTokens, completionTokens, totalTokens, cost, callCount: 1 };

  } catch (error) {
    console.error(`   ❌ 同步 overallSuggestions 失败:`, error);
    fallbackFixOverallSuggestions(analysisData, metricsToFix);
    console.log(`======================================\n`);
    return createEmptyUsage();
  }
}

/**
 * 降级修复 overallSuggestions
 */
function fallbackFixOverallSuggestions(analysisData: any, metricsToFix: MetricToFix[]): void {
  if (!analysisData?.overallSuggestions) return;
  
  // 尝试修复非数组类型
  if (!Array.isArray(analysisData.overallSuggestions)) {
    const original = analysisData.overallSuggestions;
    if (original && typeof original === 'object') {
      analysisData.overallSuggestions = [original];
    } else {
      return;
    }
  }

  console.log(`   🔄 启用降级修复模式（文本替换）`);

  const generalReplacements = [
    { pattern: /-\d+%/g, replacement: '+5%' },
    { pattern: /↓\d+%/g, replacement: '↑5%' },
    { pattern: /（-\d+%）/g, replacement: '（+5%）' }
  ];

  let fixedCount = 0;

  for (const suggestion of analysisData.overallSuggestions) {
    let modified = false;

    for (const { pattern, replacement } of generalReplacements) {
      if (suggestion.performanceSummary && pattern.test(suggestion.performanceSummary)) {
        suggestion.performanceSummary = suggestion.performanceSummary.replace(pattern, replacement);
        modified = true;
      }
      if (suggestion.description && pattern.test(suggestion.description)) {
        suggestion.description = suggestion.description.replace(pattern, replacement);
        modified = true;
      }
    }

    if (modified) fixedCount++;
  }

  console.log(`   ✅ 降级修复完成: ${fixedCount}/${analysisData.overallSuggestions.length} 条建议已更新`);
}

/**
 * 验证并修复数据一致性
 */
export async function validateAndFixDataConsistency(
  analysisData: any,
  openai: OpenAI,
  model: string
): Promise<PostProcessingUsage> {
  if (!analysisData?.learningData || !analysisData?.overallSuggestions) {
    return createEmptyUsage();
  }
  
  // 尝试修复 overallSuggestions 非数组类型
  if (!Array.isArray(analysisData.overallSuggestions)) {
    console.warn('⚠️ overallSuggestions 不是数组，尝试修复...');
    const original = analysisData.overallSuggestions;
    if (original && typeof original === 'object') {
      analysisData.overallSuggestions = [original];
      console.log(`   ✅ 已将单个对象包装为数组`);
    } else {
      console.warn('⚠️ 无法修复，跳过数据一致性检查');
      return createEmptyUsage();
    }
  }

  const learningData = analysisData.learningData;
  const suggestions = analysisData.overallSuggestions;

  const realData: Record<string, RealDataItem> = {};
  const metricLabels: Record<string, string> = {
    handRaising: '主动发言次数|主动回答',
    answerLength: '回答长度|平均回答长度',
    completeSentences: '完整句子率|完整句输出|完整句',
    readingAccuracy: '阅读准确率|阅读准确'
  };

  for (const [key, labelPattern] of Object.entries(metricLabels)) {
    const metric = learningData[key];
    if (metric?.percentage !== undefined && metric?.percentage !== null) {
      // 确保 percentage 是字符串
      realData[key] = { percentage: String(metric.percentage), label: labelPattern };
    }
  }

  console.log(`\n🔍 ===== 数据一致性检查 =====`);

  const inconsistencies: DataInconsistency[] = [];

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    const fieldsToCheck = ['performanceSummary', 'description'] as const;

    for (const field of fieldsToCheck) {
      const text = suggestion[field] || '';
      
      for (const [key, data] of Object.entries(realData)) {
        const labelPatterns = data.label.split('|');
        
        for (const labelPattern of labelPatterns) {
          if (text.includes(labelPattern)) {
            const labelIndex = text.indexOf(labelPattern);
            const contextStart = Math.max(0, labelIndex - 10);
            const contextEnd = Math.min(text.length, labelIndex + labelPattern.length + 50);
            const context = text.substring(contextStart, contextEnd);
            
            const changeMatch = context.match(/[（(]\s*([+-]?\d+(?:\.\d+)?)\s*%\s*[）)]/);
            if (changeMatch) {
              const foundPercentage = changeMatch[1].startsWith('+') || changeMatch[1].startsWith('-') 
                ? changeMatch[1] + '%' 
                : (parseFloat(changeMatch[1]) >= 0 ? '+' + changeMatch[1] + '%' : changeMatch[1] + '%');
              
              // 确保 data.percentage 是字符串
              const percentageStr = String(data.percentage);
              const expectedPercentage = percentageStr.includes('%') ? percentageStr : percentageStr + '%';
              const foundValue = parseFloat(changeMatch[1]);
              const expectedValue = parseFloat(percentageStr.replace(/[^\d.-]/g, '')) || 0;
              
              if (Math.abs(foundValue - expectedValue) > 1) {
                inconsistencies.push({
                  suggestionIndex: i,
                  field,
                  foundValue: foundPercentage,
                  expectedKey: key,
                  expectedValue: expectedPercentage,
                  context
                });
              }
            }
          }
        }
      }
    }
  }

  if (inconsistencies.length === 0) {
    console.log(`   ✅ 数据一致性检查通过`);
    console.log(`======================================\n`);
    return createEmptyUsage();
  }

  console.log(`   ⚠️ 发现 ${inconsistencies.length} 处数据不一致`);

  try {
    const prompt = `你是一位英语教学分析专家。请修复以下学习建议中的数据不一致问题。

**真实的 learningData 数据**：
- 主动发言次数: ${realData.handRaising?.percentage || 'N/A'}
- 回答长度: ${realData.answerLength?.percentage || 'N/A'}
- 完整句子率: ${realData.completeSentences?.percentage || 'N/A'}
- 阅读准确率: ${realData.readingAccuracy?.percentage || 'N/A'}

**原始的 overallSuggestions**：
${JSON.stringify(suggestions, null, 2)}

请以 JSON 格式返回修复后的 overallSuggestions。`;

    const aiCallConfig: AICallConfig = {
      maxRetries: 2,
      retryDelayBase: 1000,
      timeout: 90000,
      operationLabel: '数据一致性修复AI调用',
    };

    const response = await withRetry(
      () => openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: '你是一位专业的英语教学分析专家。' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2500
      }),
      aiCallConfig
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('AI 未返回内容');

    const result = JSON.parse(content);
    
    const usage = response.usage;
    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const totalTokens = usage?.total_tokens || 0;
    const cost = calculateAICost(model, promptTokens, completionTokens);
    
    console.log(`💰 数据一致性修复 AI 调用: ${promptTokens} input + ${completionTokens} output = ${totalTokens} tokens, ¥${cost.toFixed(4)}`);

    if (result.overallSuggestions && Array.isArray(result.overallSuggestions)) {
      analysisData.overallSuggestions = result.overallSuggestions;
      console.log(`   ✅ 数据一致性修复完成`);
    }

    console.log(`======================================\n`);
    
    return { promptTokens, completionTokens, totalTokens, cost, callCount: 1 };

  } catch (error) {
    console.error(`   ❌ AI 修复数据一致性失败:`, error);
    console.log(`======================================\n`);
    return createEmptyUsage();
  }
}

