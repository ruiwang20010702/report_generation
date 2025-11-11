// 使用同步方式加载环境变量
import { config } from 'dotenv';
import { resolve } from 'path';

// 显式加载 .env 文件
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  console.log('🔍 正在测试邮件服务配置...\n');
  console.log('📋 当前配置:');
  console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || '未设置'}`);
  console.log(`   SMTP_PORT: ${process.env.SMTP_PORT || '未设置'}`);
  console.log(`   SMTP_USER: ${process.env.SMTP_USER || '未设置'}`);
  console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? '已设置（已隐藏）' : '未设置'}\n`);
  
  // 使用动态导入，确保环境变量已加载
  const { testEmailService } = await import('./server/services/emailService');
  
  const result = await testEmailService();
  
  if (result) {
    console.log('\n✅ 邮件服务配置测试通过！');
    console.log('📧 您现在可以使用邮件验证码功能了。');
    process.exit(0);
  } else {
    console.log('\n❌ 邮件服务配置测试失败。');
    console.log('请检查 .env 文件中的 SMTP 配置是否正确。');
    process.exit(1);
  }
}

main().catch(console.error);
