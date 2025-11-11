/**
 * 通义听悟服务测试脚本
 * 用于验证通义听悟配置和功能是否正常
 */

import dotenv from 'dotenv';
dotenv.config();

import { tingwuTranscriptionService } from './server/services/tingwuTranscriptionService.js';

// 测试视频URL（使用一个公开的测试音频/视频）
// 这是一个简短的测试音频，用于验证转写功能
const TEST_VIDEO_URL = 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav';

async function testTingwuService() {
  console.log('\n🧪 开始测试通义听悟服务...\n');
  console.log('='.repeat(60));

  // 测试1: 检查配置
  console.log('\n📋 测试1: 检查服务配置');
  console.log('-'.repeat(60));
  
  const isAvailable = tingwuTranscriptionService.isAvailable();
  console.log(`服务可用性: ${isAvailable ? '✅ 可用' : '❌ 不可用'}`);
  
  if (!isAvailable) {
    console.log('\n❌ 服务不可用，请检查：');
    console.log('   1. ALIYUN_ACCESS_KEY_ID 是否配置');
    console.log('   2. ALIYUN_ACCESS_KEY_SECRET 是否配置');
    console.log('   3. ALIYUN_TINGWU_APP_KEY 是否配置（可选）');
    console.log('   4. 免费额度是否充足');
    return;
  }

  // 显示配置信息
  const stats = tingwuTranscriptionService.getStats();
  console.log('\n📊 服务统计信息:');
  console.log(`   每日免费额度: ${stats.freeMinutesLimit} 分钟`);
  console.log(`   已使用: ${stats.totalMinutesUsed} 分钟`);
  console.log(`   剩余额度: ${stats.remainingMinutes} 分钟`);
  console.log(`   使用率: ${stats.usagePercentage}%`);

  // 检查环境变量
  console.log('\n🔑 环境变量检查:');
  console.log(`   ALIYUN_ACCESS_KEY_ID: ${process.env.ALIYUN_ACCESS_KEY_ID ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`   ALIYUN_ACCESS_KEY_SECRET: ${process.env.ALIYUN_ACCESS_KEY_SECRET ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`   ALIYUN_TINGWU_APP_KEY: ${process.env.ALIYUN_TINGWU_APP_KEY ? '✅ 已配置 (' + process.env.ALIYUN_TINGWU_APP_KEY.substring(0, 10) + '...)' : '⚠️  未配置（可选）'}`);

  // 测试2: 测试转写功能（如果用户提供测试URL）
  console.log('\n📋 测试2: 转写功能测试');
  console.log('-'.repeat(60));
  
  const testUrl = process.argv[2] || TEST_VIDEO_URL;
  const testMode = process.argv[3] || 'basic'; // 'basic' 或 'education'
  
  console.log(`测试视频URL: ${testUrl}`);
  console.log(`测试模式: ${testMode === 'education' ? '🎓 教育场景（说话人分离+教育模型）' : '📝 基础模式'}`);
  console.log('\n💡 提示: 可以传入自定义测试URL和模式作为参数');
  console.log('   例如: npm run test:tingwu "https://your-video-url.mp4" education');
  console.log('   例如: npm run test:tingwu "https://your-video-url.mp4" basic');
  
  console.log('\n⏳ 开始转写测试（这可能需要1-2分钟）...');
  
  try {
    const startTime = Date.now();
    
    // 根据模式选择不同的配置
    const transcriptionOptions = testMode === 'education' 
      ? {
          language: 'cn', // 教育网课通常使用中文
          speakerLabels: true, // 启用说话人分离
          speakerCount: 2, // 2个说话人（老师+学生）
          transcriptionModel: 'domain-education', // 使用教育领域专属模型
          onProgress: (progress: any) => {
            if (progress.status === 'processing' || progress.status === 'queued') {
              console.log(`   进度: ${progress.progress}% (${progress.status})`);
            }
          },
        }
      : {
          language: 'en',
          speakerLabels: false, // 测试时先不启用说话人分离，加快速度
          onProgress: (progress: any) => {
            if (progress.status === 'processing' || progress.status === 'queued') {
              console.log(`   进度: ${progress.progress}% (${progress.status})`);
            }
          },
        };
    
    console.log('\n📋 转写配置:');
    if (testMode === 'education') {
      console.log('   ✅ 语言: 中文 (cn)');
      console.log('   ✅ 说话人分离: 启用');
      console.log('   ✅ 说话人数量: 2 (老师+学生)');
      console.log('   ✅ 领域模型: domain-education (教育网课)');
    } else {
      console.log('   ✅ 语言: 英语 (en)');
      console.log('   ⚪ 说话人分离: 未启用');
    }
    
    const result = await tingwuTranscriptionService.transcribeFromURL(testUrl, transcriptionOptions);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n✅ 转写成功！');
    console.log(`   耗时: ${duration} 秒`);
    console.log(`   转写文本长度: ${result.text.length} 字符`);
    console.log(`   转写文本预览: ${result.text.substring(0, 200)}${result.text.length > 200 ? '...' : ''}`);
    
    if (result.duration) {
      console.log(`   音频时长: ${result.duration} 秒`);
    }
    
    if (result.words && result.words.length > 0) {
      console.log(`   词级别信息: ${result.words.length} 个词`);
    }
    
    if (result.utterances && result.utterances.length > 0) {
      console.log(`   语句数量: ${result.utterances.length} 条`);
      if (testMode === 'education') {
        // 显示说话人信息
        const speakers = new Set(result.utterances.map((u: any) => u.speaker).filter(Boolean));
        console.log(`   说话人数量: ${speakers.size} 人`);
        if (speakers.size > 0) {
          console.log(`   说话人标签: ${Array.from(speakers).join(', ')}`);
        }
      }
    }

    // 显示更新后的统计
    const updatedStats = tingwuTranscriptionService.getStats();
    console.log('\n📊 更新后的统计信息:');
    console.log(`   已使用: ${updatedStats.totalMinutesUsed} 分钟`);
    console.log(`   剩余额度: ${updatedStats.remainingMinutes} 分钟`);
    console.log(`   使用率: ${updatedStats.usagePercentage}%`);

  } catch (error: any) {
    console.error('\n❌ 转写失败:');
    console.error(`   错误信息: ${error.message}`);
    console.error(`   错误详情: ${error.stack || error}`);
    
    // 提供故障排除建议
    console.log('\n💡 故障排除建议:');
    if (error.message?.includes('quota') || error.message?.includes('额度')) {
      console.log('   1. 免费额度已用完，请等待明天重置（每天0点重置）');
      console.log('   2. 或者检查账户是否有付费额度');
    } else if (error.message?.includes('URL') || error.message?.includes('url')) {
      console.log('   1. 检查视频URL是否可公开访问');
      console.log('   2. 使用 curl 测试URL: curl -I "你的URL"');
      console.log('   3. 确保URL是直接的视频/音频文件链接');
    } else if (error.message?.includes('配置') || error.message?.includes('config')) {
      console.log('   1. 检查 .env 文件中的配置');
      console.log('   2. 确保 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET 正确');
      console.log('   3. 确保 ALIYUN_TINGWU_APP_KEY 已配置（如果API版本需要）');
    } else {
      console.log('   1. 查看上面的错误信息');
      console.log('   2. 检查网络连接');
      console.log('   3. 检查通义听悟服务状态');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 测试完成！\n');
}

// 运行测试
testTingwuService().catch((error) => {
  console.error('\n❌ 测试脚本执行失败:');
  console.error(error);
  process.exit(1);
});

