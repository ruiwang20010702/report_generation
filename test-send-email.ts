// 测试发送邮件到指定邮箱
import { config } from 'dotenv';
import { resolve } from 'path';

// 显式加载 .env 文件
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  // 从命令行参数获取邮箱地址，如果没有则使用默认的51talk邮箱
  const email = process.argv[2] || '51wangrui003@51talk.com';
  
  console.log('📧 准备发送测试邮件...\n');
  console.log('📋 当前配置:');
  console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || '未设置'}`);
  console.log(`   SMTP_PORT: ${process.env.SMTP_PORT || '未设置'}`);
  console.log(`   SMTP_USER: ${process.env.SMTP_USER || '未设置'}`);
  console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? '已设置（已隐藏）' : '未设置'}`);
  console.log(`   收件人: ${email}\n`);
  
  // 使用动态导入，确保环境变量已加载
  const { sendVerificationEmail } = await import('./server/services/emailService');
  
  // 生成一个测试验证码
  const testCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  try {
    console.log('⏳ 正在发送邮件...');
    await sendVerificationEmail(email, testCode);
    console.log(`\n✅ 测试邮件已成功发送到: ${email}`);
    console.log(`📝 验证码: ${testCode}`);
    console.log('\n💡 请检查您的邮箱收件箱（包括垃圾邮件文件夹）');
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ 发送邮件失败:`, error.message);
    process.exit(1);
  }
}

main().catch(console.error);

