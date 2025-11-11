/**
 * QQ邮箱配置检查脚本
 * 帮助诊断QQ邮箱SMTP配置问题
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import nodemailer from 'nodemailer';

// 加载环境变量
config({ path: resolve(process.cwd(), '.env') });

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

async function checkQQEmailConfig() {
  console.log('🔍 QQ邮箱配置检查\n');
  console.log('='.repeat(50));
  
  // 1. 检查基本配置
  console.log('\n📋 1. 基本配置检查:');
  console.log(`   SMTP_HOST: ${SMTP_HOST || '❌ 未设置'}`);
  console.log(`   SMTP_PORT: ${SMTP_PORT || '❌ 未设置'}`);
  console.log(`   SMTP_USER: ${SMTP_USER || '❌ 未设置'}`);
  console.log(`   SMTP_PASS: ${SMTP_PASS ? '✅ 已设置（长度: ' + SMTP_PASS.length + '）' : '❌ 未设置'}`);
  
  // 2. 验证配置值
  console.log('\n📋 2. 配置值验证:');
  
  if (SMTP_HOST !== 'smtp.qq.com') {
    console.log(`   ⚠️  SMTP_HOST 应该是 'smtp.qq.com'，当前是 '${SMTP_HOST}'`);
  } else {
    console.log('   ✅ SMTP_HOST 正确');
  }
  
  if (SMTP_PORT !== 587 && SMTP_PORT !== 465) {
    console.log(`   ⚠️  SMTP_PORT 应该是 587 或 465，当前是 ${SMTP_PORT}`);
  } else {
    console.log(`   ✅ SMTP_PORT 正确 (${SMTP_PORT})`);
  }
  
  if (!SMTP_USER.endsWith('@qq.com')) {
    console.log(`   ⚠️  SMTP_USER 应该是QQ邮箱格式 (xxx@qq.com)，当前是 '${SMTP_USER}'`);
  } else {
    console.log('   ✅ SMTP_USER 格式正确');
  }
  
  // 3. 检查授权码特征
  console.log('\n📋 3. 授权码检查:');
  if (SMTP_PASS) {
    if (SMTP_PASS.length < 10) {
      console.log('   ⚠️  授权码长度过短，QQ邮箱授权码通常是16位字符');
    } else if (SMTP_PASS.length === 16) {
      console.log('   ✅ 授权码长度正确（16位）');
    } else {
      console.log(`   ⚠️  授权码长度异常（${SMTP_PASS.length}位），QQ邮箱授权码通常是16位`);
    }
    
    // 检查是否可能是QQ密码（包含中文或特殊字符）
    if (/[\u4e00-\u9fa5]/.test(SMTP_PASS)) {
      console.log('   ❌ 授权码包含中文字符，这可能是QQ密码而不是授权码！');
      console.log('   💡 请使用QQ邮箱生成的授权码，而不是QQ密码');
    } else {
      console.log('   ✅ 授权码格式看起来正确（不包含中文）');
    }
  } else {
    console.log('   ❌ 未设置授权码');
  }
  
  // 4. 测试连接
  console.log('\n📋 4. SMTP连接测试:');
  if (!SMTP_USER || !SMTP_PASS) {
    console.log('   ⚠️  跳过连接测试（配置不完整）');
    return;
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    
    console.log('   ⏳ 正在连接SMTP服务器（最多等待10秒）...');
    
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('连接超时')), 10000);
    });
    
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('   ✅ SMTP连接成功！配置正确。');
    
  } catch (error: any) {
    console.log('   ❌ SMTP连接失败');
    console.log(`   📝 错误信息: ${error.message}`);
    
    // 根据错误信息给出建议
    if (error.message.includes('535') || error.message.includes('Login fail')) {
      console.log('\n   💡 可能的解决方案:');
      console.log('   1. 确认使用的是"授权码"而不是QQ密码');
      console.log('   2. 登录QQ邮箱网页版 → 设置 → 账户');
      console.log('   3. 开启"POP3/SMTP服务"或"IMAP/SMTP服务"');
      console.log('   4. 点击"生成授权码"，使用新生成的授权码');
      console.log('   5. 如果提示"登录频率受限"，请等待10-30分钟后重试');
    } else if (error.message.includes('超时') || error.message.includes('timeout')) {
      console.log('\n   💡 可能的解决方案:');
      console.log('   1. 检查网络连接');
      console.log('   2. 检查防火墙设置');
      console.log('   3. 尝试使用端口 465（SSL）');
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📚 详细配置指南请查看: docs/getting-started/EMAIL_SETUP.md');
}

checkQQEmailConfig().catch(console.error);

