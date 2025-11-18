/**
 * 📚 课程知识库服务测试脚本
 * 
 * 用于验证 curriculumService 的功能是否正常
 */

import { curriculumService } from '../server/services/curriculumService.js';

console.log('🧪 开始测试课程知识库服务...\n');

// 测试1: 检查数据加载
console.log('📊 测试1: 检查数据加载状态');
console.log('─'.repeat(50));
const loadedLevels = curriculumService.getLoadedLevels();
console.log(`✅ 已加载 ${loadedLevels.length} 个级别:`);
loadedLevels.forEach(level => {
  const units = curriculumService.getUnitsForLevel(level);
  console.log(`   ${level}: ${units.length} 个单元 (Unit ${units.join(', ')})`);
});
console.log('');

// 测试2: 查询 Level 1, Unit 1
console.log('📖 测试2: 查询 Level 1, Unit 1');
console.log('─'.repeat(50));
const context1 = curriculumService.getCurriculumContext('Level 1', '1');
if (context1) {
  console.log(`✅ 查询成功!`);
  console.log(`   主题: ${context1.theme}`);
  console.log(`   目标: ${context1.goals}`);
  console.log(`   词汇数量: ${context1.vocabulary.length}`);
  console.log(`   词汇示例: ${context1.vocabulary.slice(0, 5).join(', ')}...`);
  console.log(`   句式数量: ${context1.sentences.length}`);
  if (context1.sentences.length > 0) {
    console.log(`   句式示例: ${context1.sentences[0]}`);
  }
  console.log(`   拼读内容: ${context1.phonics.join(', ')}`);
} else {
  console.log('❌ 查询失败');
}
console.log('');

// 测试3: 查询 Level 3, Unit 5
console.log('📖 测试3: 查询 Level 3, Unit 5');
console.log('─'.repeat(50));
const context2 = curriculumService.getCurriculumContext('Level 3', 5);
if (context2) {
  console.log(`✅ 查询成功!`);
  console.log(`   主题: ${context2.theme}`);
  console.log(`   目标: ${context2.goals}`);
  console.log(`   词汇数量: ${context2.vocabulary.length}`);
  console.log(`   句式数量: ${context2.sentences.length}`);
} else {
  console.log('❌ 查询失败');
}
console.log('');

// 测试4: 测试不同的 Level 格式
console.log('📖 测试4: 测试不同的 Level 格式');
console.log('─'.repeat(50));
const formats = ['Level 1', 'L1', 'L 1', 'level 1'];
formats.forEach(format => {
  const result = curriculumService.getCurriculumContext(format, 1);
  console.log(`   ${format.padEnd(10)} → ${result ? '✅ 成功' : '❌ 失败'}`);
});
console.log('');

// 测试5: 格式化输出（用于AI提示）
console.log('📝 测试5: 格式化输出（用于AI提示）');
console.log('─'.repeat(50));
const context3 = curriculumService.getCurriculumContext('Level 1', 1);
if (context3) {
  const formatted = curriculumService.formatForImprovementSuggestions(context3);
  console.log('格式化结果:');
  console.log(formatted);
} else {
  console.log('❌ 无法格式化');
}
console.log('');

// 测试6: 测试边界情况
console.log('🔍 测试6: 测试边界情况');
console.log('─'.repeat(50));

// 不存在的 Level
const invalidLevel = curriculumService.getCurriculumContext('Level 99', 1);
console.log(`   不存在的Level (Level 99, Unit 1): ${invalidLevel ? '❌ 应该返回null' : '✅ 正确返回null'}`);

// 不存在的 Unit
const invalidUnit = curriculumService.getCurriculumContext('Level 1', 999);
console.log(`   不存在的Unit (Level 1, Unit 999): ${invalidUnit ? '❌ 应该返回null' : '✅ 正确返回null'}`);

// 空字符串
const emptyLevel = curriculumService.getCurriculumContext('', 1);
console.log(`   空Level ("", Unit 1): ${emptyLevel ? '❌ 应该返回null' : '✅ 正确返回null'}`);

// 无效的 Unit 格式
const invalidUnitFormat = curriculumService.getCurriculumContext('Level 1', 'abc');
console.log(`   无效的Unit格式 (Level 1, Unit "abc"): ${invalidUnitFormat ? '❌ 应该返回null' : '✅ 正确返回null'}`);

console.log('');

// 测试7: 测试 Level 7-9 的合并文件
console.log('📖 测试7: 测试 Level 7-9 的合并文件');
console.log('─'.repeat(50));
['Level 7', 'Level 8', 'Level 9'].forEach(level => {
  const units = curriculumService.getUnitsForLevel(level);
  console.log(`   ${level}: ${units.length > 0 ? `✅ ${units.length}个单元` : '❌ 无数据'}`);
  if (units.length > 0) {
    const sampleContext = curriculumService.getCurriculumContext(level, units[0]);
    if (sampleContext) {
      console.log(`      示例: Unit ${sampleContext.unit} - ${sampleContext.theme}`);
    }
  }
});
console.log('');

console.log('✅ 测试完成!\n');

// 输出统计信息
console.log('📊 统计信息');
console.log('─'.repeat(50));
let totalUnits = 0;
loadedLevels.forEach(level => {
  const units = curriculumService.getUnitsForLevel(level);
  totalUnits += units.length;
});
console.log(`总级别数: ${loadedLevels.length}`);
console.log(`总单元数: ${totalUnits}`);
console.log('');

