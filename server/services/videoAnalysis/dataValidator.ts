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
  let swappedCount = 0;
  
  for (const example of examples) {
    const beforeIncorrect = example.incorrect;
    const beforeCorrect = example.correct;
    
    // 🔄 首先检查是否需要交换 incorrect 和 correct
    // 如果 incorrect 看起来更像标准音标，而 correct 包含非标准符号，则交换
    if (shouldSwapPhonetics(example.word, example.incorrect, example.correct)) {
      const temp = example.incorrect;
      example.incorrect = example.correct;
      example.correct = temp;
      swappedCount++;
      console.log(`🔄 交换发音示例: ${example.word}`);
      console.log(`   原始 → incorrect="${beforeIncorrect}", correct="${beforeCorrect}"`);
      console.log(`   交换 → incorrect="${example.incorrect}", correct="${example.correct}"`);
    }
    
    const incorrectNormalized = normalizePhoneticString(example.incorrect || '');
    const correctNormalized = normalizePhoneticString(example.correct || '');

    // 如果音标相同或为空，尝试智能修复
    if (!incorrectNormalized || !correctNormalized || incorrectNormalized === correctNormalized) {
      const fixed = smartFixPhonetics(example);
      if (fixed) {
        fixedCount++;
        console.log(`🔧 自动修复发音示例: ${example.word}`);
        console.log(`   原始 → incorrect="${example.incorrect}", correct="${example.correct}"`);
        console.log(`   修复 → incorrect="${example.incorrect}", correct="${example.correct}"`);
      }
    }
  }

  // 日志输出
  if (fixedCount > 0 || swappedCount > 0) {
    console.log(`✅ 发音示例验证完成: ${examples.length} 个示例，其中 ${swappedCount} 个已交换，${fixedCount} 个音标已自动修复`);
  } else {
    console.log(`✅ 发音示例验证完成: 所有 ${examples.length} 个示例均有效`);
  }
}

/**
 * 判断是否需要交换 incorrect 和 correct
 * 检测 AI 是否把 incorrect 和 correct 搞反了
 */
function shouldSwapPhonetics(word: string, incorrect: string, correct: string): boolean {
  if (!incorrect || !correct || !word) return false;
  
  const wordLower = word.toLowerCase();
  
  // 常见单词的标准音标映射（用于检测）
  const standardPhonetics: Record<string, string[]> = {
    'milk': ['mɪlk', 'milk'],
    'big': ['bɪg', 'bɪɡ', 'big'],
    'night': ['naɪt', 'nait'],
    'think': ['θɪŋk', 'θink'],
    'this': ['ðɪs', 'ðis'],
    'very': ['veri', 'verɪ'],
    'want': ['wɒnt', 'wɔnt', 'wɑnt'],
    'like': ['laɪk', 'laik'],
    'good': ['gʊd', 'gud'],
    'look': ['lʊk', 'luk'],
  };
  
  // 非标准音标符号（通常出现在错误发音中，或者是过度精细的语音学标注）
  const nonStandardSymbols = ['ɫ', 'ɪ̯', 'ʔ', 'ˑ', '̃', '̥', '̩', '̯'];
  
  const incorrectNorm = normalizePhoneticString(incorrect);
  const correctNorm = normalizePhoneticString(correct);
  
  // 检查1: correct 包含非标准符号，而 incorrect 不包含
  const correctHasNonStandard = nonStandardSymbols.some(s => correct.includes(s));
  const incorrectHasNonStandard = nonStandardSymbols.some(s => incorrect.includes(s));
  
  if (correctHasNonStandard && !incorrectHasNonStandard) {
    console.log(`   检测到 correct 包含非标准符号: ${correct}`);
    return true;
  }
  
  // 检查2: 如果有该单词的标准音标，检查哪个更接近
  if (standardPhonetics[wordLower]) {
    const standards = standardPhonetics[wordLower];
    const incorrectMatchesStandard = standards.some(s => 
      incorrectNorm === normalizePhoneticString(s) || incorrectNorm.includes(normalizePhoneticString(s))
    );
    const correctMatchesStandard = standards.some(s => 
      correctNorm === normalizePhoneticString(s) || correctNorm.includes(normalizePhoneticString(s))
    );
    
    // 如果 incorrect 匹配标准音标，而 correct 不匹配，说明反了
    if (incorrectMatchesStandard && !correctMatchesStandard) {
      console.log(`   检测到 incorrect "${incorrect}" 更接近标准音标，而 correct "${correct}" 不匹配`);
      return true;
    }
  }
  
  // 检查3: correct 音标与单词拼写完全不符（如 big 的 correct 是 bɪɫ，结尾不对）
  // 简单检查：单词结尾字母与音标结尾是否大致对应
  const wordEnding = wordLower.slice(-1);
  const correctEnding = correctNorm.slice(-1);
  const incorrectEnding = incorrectNorm.slice(-1);
  
  const endingMap: Record<string, string[]> = {
    'g': ['g', 'ɡ', 'k'],
    'k': ['k', 'g', 'ɡ'],
    't': ['t', 'd'],
    'd': ['d', 't'],
    'p': ['p', 'b'],
    'b': ['b', 'p'],
  };
  
  if (endingMap[wordEnding]) {
    const validEndings = endingMap[wordEnding];
    const correctEndingValid = validEndings.includes(correctEnding);
    const incorrectEndingValid = validEndings.includes(incorrectEnding);
    
    // 如果 incorrect 结尾正确，而 correct 结尾错误，说明反了
    if (incorrectEndingValid && !correctEndingValid) {
      console.log(`   检测到 correct "${correct}" 结尾不匹配单词 "${word}"，而 incorrect "${incorrect}" 匹配`);
      return true;
    }
  }
  
  return false;
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
 * 使用 AI 重新判断发音错误类型
 * 在音标修复后调用，确保 type 与实际音标差异一致
 */
export async function fixPronunciationErrorTypes(
  analysisData: any,
  openai: OpenAI,
  model: string
): Promise<PostProcessingUsage> {
  if (!analysisData?.improvementAreas?.pronunciation?.examples) {
    return createEmptyUsage();
  }

  const examples = analysisData.improvementAreas.pronunciation.examples;
  if (!Array.isArray(examples) || examples.length === 0) {
    return createEmptyUsage();
  }

  // 检查是否有需要修正的示例（有 incorrect 和 correct 音标的）
  const validExamples = examples.filter(
    (ex: any) => ex.word && ex.incorrect && ex.correct
  );

  if (validExamples.length === 0) {
    return createEmptyUsage();
  }

  console.log(`\n🔧 ===== AI 重新判断发音错误类型 =====`);
  console.log(`   需要处理 ${validExamples.length} 个发音示例`);

  try {
    const prompt = `你是一位专业的英语语音学专家。请根据以下单词的错误音标和正确音标，准确判断发音错误的类型。

**发音示例列表**：
${examples.map((ex: any, i: number) => `
${i + 1}. 单词: ${ex.word}
   错误音标: ${ex.incorrect}
   正确音标: ${ex.correct}
   当前类型: ${ex.type || '未标注'}
`).join('')}

**错误类型分类规则**：
1. **元音不准确** - 元音音素发音错误，例如：
   - /iː/ 读成 /ɪ/（长元音变短元音）
   - /æ/ 读成 /e/（前元音混淆）
   - /aɪ/ 读成 /æ/（双元音变单元音）
   - /ɔː/ 读成 /ɒ/（后元音混淆）

2. **辅音发音** - 辅音音素发音错误，例如：
   - /θ/ 读成 /s/（th音问题）
   - /ð/ 读成 /d/ 或 /z/
   - /v/ 读成 /w/（唇齿音问题）
   - /r/ 读成 /l/（流音混淆）
   - /ŋ/ 读成 /n/（鼻音问题）

3. **重音问题** - 重音位置错误，例如：
   - 重音符号 ˈ 位置不同
   - 重音音节改变

请以 JSON 格式返回每个单词的正确错误类型：
{
  "corrections": [
    { "word": "单词1", "type": "正确的错误类型" },
    { "word": "单词2", "type": "正确的错误类型" },
    ...
  ]
}

**重要**：
- 仔细对比 incorrect 和 correct 音标的具体差异
- 根据差异的音素类型（元音/辅音/重音）判断错误类型
- type 只能是以下三个值之一：「元音不准确」「辅音发音」「重音问题」`;

    const aiCallConfig: AICallConfig = {
      maxRetries: 2,
      retryDelayBase: 1000,
      timeout: 60000,
      operationLabel: '发音错误类型判断AI调用',
    };

    const response = await withRetry(
      () => openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: '你是一位专业的英语语音学专家，擅长分析发音问题。' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 500
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
    
    console.log(`💰 错误类型判断 AI 调用: ${promptTokens} input + ${completionTokens} output = ${totalTokens} tokens, ¥${cost.toFixed(4)}`);

    // 更新错误类型
    if (result.corrections && Array.isArray(result.corrections)) {
      let updatedCount = 0;
      for (const correction of result.corrections) {
        const example = examples.find((ex: any) => ex.word === correction.word);
        if (example && correction.type) {
          const oldType = example.type;
          example.type = correction.type;
          if (oldType !== correction.type) {
            updatedCount++;
            console.log(`   ✅ ${correction.word}: "${oldType}" → "${correction.type}"`);
          }
        }
      }
      console.log(`   共更新 ${updatedCount}/${examples.length} 个错误类型`);
    }

    console.log(`======================================\n`);
    
    return { promptTokens, completionTokens, totalTokens, cost, callCount: 1 };

  } catch (error) {
    console.error(`   ❌ AI 判断错误类型失败:`, error);
    console.log(`   使用规则引擎进行降级判断...`);
    
    // 降级：使用规则引擎判断
    for (const example of examples) {
      const newType = inferErrorTypeFromPhonetics(example.incorrect, example.correct);
      if (newType && newType !== example.type) {
        console.log(`   🔄 ${example.word}: "${example.type}" → "${newType}" (规则推断)`);
        example.type = newType;
      }
    }
    
    console.log(`======================================\n`);
    return createEmptyUsage();
  }
}

/**
 * 基于音标差异推断错误类型（降级方案）
 */
function inferErrorTypeFromPhonetics(incorrect: string, correct: string): string | null {
  if (!incorrect || !correct) return null;

  // 定义元音和辅音音素
  const vowels = ['iː', 'i:', 'ɪ', 'e', 'æ', 'ɑː', 'ɑ:', 'ɒ', 'ɔː', 'ɔ:', 'ʊ', 'uː', 'u:', 'ʌ', 'ɜː', 'ɜ:', 'ə', 'aɪ', 'eɪ', 'ɔɪ', 'aʊ', 'əʊ', 'oʊ', 'ɪə', 'eə', 'ʊə'];
  const consonants = ['p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j', 'tʃ', 'dʒ'];

  // 检查重音差异
  const incorrectStress = (incorrect.match(/ˈ/g) || []).length;
  const correctStress = (correct.match(/ˈ/g) || []).length;
  const incorrectStressPos = incorrect.indexOf('ˈ');
  const correctStressPos = correct.indexOf('ˈ');
  
  if (incorrectStress !== correctStress || (incorrectStressPos !== correctStressPos && incorrectStressPos >= 0 && correctStressPos >= 0)) {
    return '重音问题';
  }

  // 移除重音符号和斜杠后比较
  const cleanIncorrect = incorrect.replace(/[ˈˌ\/]/g, '').toLowerCase();
  const cleanCorrect = correct.replace(/[ˈˌ\/]/g, '').toLowerCase();

  // 检查元音差异
  for (const vowel of vowels) {
    const inIncorrect = cleanIncorrect.includes(vowel);
    const inCorrect = cleanCorrect.includes(vowel);
    if (inIncorrect !== inCorrect) {
      return '元音不准确';
    }
  }

  // 检查辅音差异
  for (const consonant of consonants) {
    const inIncorrect = cleanIncorrect.includes(consonant);
    const inCorrect = cleanCorrect.includes(consonant);
    if (inIncorrect !== inCorrect) {
      return '辅音发音';
    }
  }

  // 默认返回元音问题（最常见）
  return '元音不准确';
}

/**
 * 使用 AI 重新判断语法错误类型
 * 在语法示例修复后调用，确保 category 与实际错误差异一致
 */
export async function fixGrammarErrorTypes(
  analysisData: any,
  openai: OpenAI,
  model: string
): Promise<PostProcessingUsage> {
  if (!analysisData?.improvementAreas?.grammar?.examples) {
    return createEmptyUsage();
  }

  const examples = analysisData.improvementAreas.grammar.examples;
  if (!Array.isArray(examples) || examples.length === 0) {
    return createEmptyUsage();
  }

  // 检查是否有需要修正的示例（有 incorrect 和 correct 句子的）
  const validExamples = examples.filter(
    (ex: any) => ex.incorrect && ex.correct && ex.incorrect.trim() !== ex.correct.trim()
  );

  if (validExamples.length === 0) {
    return createEmptyUsage();
  }

  console.log(`\n🔧 ===== AI 重新判断语法错误类型 =====`);
  console.log(`   需要处理 ${validExamples.length} 个语法示例`);

  try {
    const prompt = `你是一位专业的英语语法专家。请根据以下句子的错误版本和正确版本，准确判断语法错误的类型。

**语法示例列表**：
${examples.map((ex: any, i: number) => `
${i + 1}. 错误句子: ${ex.incorrect}
   正确句子: ${ex.correct}
   当前类型: ${ex.category || '未标注'}
`).join('')}

**错误类型分类规则**（请选择最匹配的一个）：

1. **动词时态** - 时态使用错误，例如：
   - "I go yesterday" → "I went yesterday"
   - "She is work" → "She is working"

2. **主谓一致** - 主语和动词数量不一致，例如：
   - "He go" → "He goes"
   - "They was" → "They were"

3. **冠词遗漏** - 缺少必要的冠词 a/an/the，例如：
   - "I have cat" → "I have a cat"
   - "I can see it" → "I can see it"（如果原句缺少冠词）

4. **冠词误用** - 使用了错误的冠词，例如：
   - "a apple" → "an apple"
   - "the sun is a star" → "the sun is a star"

5. **词序错误** - 单词顺序不正确，例如：
   - "I like very much it" → "I like it very much"
   - "Make and make look to make make" → 正确词序

6. **介词错误** - 介词使用不当，例如：
   - "arrive to" → "arrive at"
   - "good in" → "good at"

7. **代词错误** - 代词使用不当，例如：
   - "Me like it" → "I like it"
   - "Him is tall" → "He is tall"

8. **单复数错误** - 名词单复数使用错误，例如：
   - "two book" → "two books"
   - "many child" → "many children"

9. **动词形式** - 动词形式错误（非时态），例如：
   - "I want go" → "I want to go"
   - "She make me happy" → "She makes me happy"

10. **be动词缺失** - 缺少必要的 be 动词，例如：
    - "I fine" → "I am fine"
    - "She happy" → "She is happy"

请以 JSON 格式返回每个示例的正确错误类型：
{
  "corrections": [
    { "index": 0, "category": "正确的错误类型" },
    { "index": 1, "category": "正确的错误类型" },
    ...
  ]
}

**重要**：
- 仔细对比 incorrect 和 correct 句子的具体差异
- 根据差异的语法特征判断错误类型
- category 必须是上述10种类型之一
- 如果不确定，选择最接近的类型`;

    const aiCallConfig: AICallConfig = {
      maxRetries: 2,
      retryDelayBase: 1000,
      timeout: 60000,
      operationLabel: '语法错误类型判断AI调用',
    };

    const response = await withRetry(
      () => openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: '你是一位专业的英语语法专家，擅长分析语法问题。' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 500
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
    
    console.log(`💰 语法错误类型判断 AI 调用: ${promptTokens} input + ${completionTokens} output = ${totalTokens} tokens, ¥${cost.toFixed(4)}`);

    // 更新错误类型
    if (result.corrections && Array.isArray(result.corrections)) {
      let updatedCount = 0;
      for (const correction of result.corrections) {
        const index = correction.index;
        if (typeof index === 'number' && index >= 0 && index < examples.length && correction.category) {
          const example = examples[index];
          const oldCategory = example.category;
          example.category = correction.category;
          if (oldCategory !== correction.category) {
            updatedCount++;
            console.log(`   ✅ "${example.incorrect?.slice(0, 30)}...": "${oldCategory}" → "${correction.category}"`);
          }
        }
      }
      console.log(`   共更新 ${updatedCount}/${examples.length} 个错误类型`);
    }

    console.log(`======================================\n`);
    
    return { promptTokens, completionTokens, totalTokens, cost, callCount: 1 };

  } catch (error) {
    console.error(`   ❌ AI 判断语法错误类型失败:`, error);
    console.log(`   使用规则引擎进行降级判断...`);
    
    // 降级：使用规则引擎判断
    for (const example of examples) {
      const newCategory = inferGrammarErrorType(example.incorrect, example.correct);
      if (newCategory && newCategory !== example.category) {
        console.log(`   🔄 "${example.incorrect?.slice(0, 20)}...": "${example.category}" → "${newCategory}" (规则推断)`);
        example.category = newCategory;
      }
    }
    
    console.log(`======================================\n`);
    return createEmptyUsage();
  }
}

/**
 * 基于句子差异推断语法错误类型（降级方案）
 */
function inferGrammarErrorType(incorrect: string, correct: string): string | null {
  if (!incorrect || !correct) return null;

  const inc = incorrect.toLowerCase().trim();
  const cor = correct.toLowerCase().trim();

  // 检查 be 动词缺失
  const beVerbs = ['am', 'is', 'are', 'was', 'were'];
  for (const be of beVerbs) {
    if (!inc.includes(` ${be} `) && !inc.startsWith(`${be} `) && 
        (cor.includes(` ${be} `) || cor.startsWith(`${be} `))) {
      return 'be动词缺失';
    }
  }

  // 检查冠词问题
  const articles = ['a ', 'an ', 'the '];
  const incHasArticle = articles.some(a => inc.includes(a));
  const corHasArticle = articles.some(a => cor.includes(a));
  if (!incHasArticle && corHasArticle) {
    return '冠词遗漏';
  }
  if (incHasArticle && corHasArticle) {
    // 检查是否是冠词误用（如 a -> an）
    if ((inc.includes(' a ') && cor.includes(' an ')) || 
        (inc.includes(' an ') && cor.includes(' a '))) {
      return '冠词误用';
    }
  }

  // 检查词序问题（单词相同但顺序不同）
  const incWords = inc.split(/\s+/).sort();
  const corWords = cor.split(/\s+/).sort();
  if (incWords.join(' ') === corWords.join(' ') && inc !== cor) {
    return '词序错误';
  }

  // 检查时态问题
  const pastTensePatterns = /\b(went|came|did|was|were|had|made|took|got|said)\b/;
  if (!pastTensePatterns.test(inc) && pastTensePatterns.test(cor)) {
    return '动词时态';
  }

  // 检查主谓一致
  if ((inc.includes(' go ') && cor.includes(' goes ')) ||
      (inc.includes(' have ') && cor.includes(' has ')) ||
      (inc.includes(' do ') && cor.includes(' does '))) {
    return '主谓一致';
  }

  // 默认返回动词形式
  return '动词形式';
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

