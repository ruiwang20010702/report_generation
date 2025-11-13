import nodemailer from 'nodemailer';

// 邮件配置 - 使用函数获取，确保在运行时读取环境变量
function getEmailConfig() {
  return {
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
  };
}

// 创建邮件传输器
let transporter: nodemailer.Transporter | null = null;

/**
 * 初始化邮件传输器
 */
function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  const config = getEmailConfig();
  
  // 如果没有配置 SMTP，使用控制台模式（仅用于开发）
  if (!config.SMTP_USER || !config.SMTP_PASS) {
    console.warn('⚠️  邮件服务未配置，验证码将仅打印到控制台');
    console.warn('   请设置环境变量: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
    console.warn('   当前配置:', {
      SMTP_HOST: config.SMTP_HOST,
      SMTP_PORT: config.SMTP_PORT,
      SMTP_USER: config.SMTP_USER ? '已设置' : '未设置',
      SMTP_PASS: config.SMTP_PASS ? '已设置' : '未设置',
    });
    
    // 创建一个假的传输器，实际不会发送邮件
    transporter = nodemailer.createTransport({
      jsonTransport: true, // 仅用于测试，不会真正发送
    });
    return transporter;
  }

  console.log('✅ 正在初始化邮件服务:', {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    user: config.SMTP_USER,
  });

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
    connectionTimeout: 10000, // 10秒连接超时
    greetingTimeout: 10000, // 10秒问候超时
    socketTimeout: 10000, // 10秒 socket 超时
  });

  return transporter;
}

/**
 * 发送验证码邮件
 */
export async function sendVerificationEmail(
  to: string,
  code: string
): Promise<void> {
  const transporter = getTransporter();
  const config = getEmailConfig();

  const mailOptions = {
    from: `"51Talk Video Analysis" <${config.SMTP_FROM}>`,
    to,
    subject: '您的登录验证码',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">您的登录验证码</h2>
        <p style="color: #666; font-size: 16px;">您好，</p>
        <p style="color: #666; font-size: 16px;">您的登录验证码是：</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
          <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">此验证码将在 <strong>10分钟</strong> 后过期。</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">如果您没有请求此验证码，请忽略此邮件。</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">此邮件由 51Talk Video Analysis 系统自动发送，请勿回复。</p>
      </div>
    `,
    text: `您的登录验证码是：${code}，此验证码将在10分钟后过期。`,
  };

  try {
    // 如果没有配置 SMTP，只打印到控制台
    if (!config.SMTP_USER || !config.SMTP_PASS) {
      console.log(`\n📧 验证码邮件（未配置邮件服务，仅打印到控制台）:`);
      console.log(`   收件人: ${to}`);
      console.log(`   验证码: ${code}`);
      console.log(`   有效期: 10分钟\n`);
      return;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ 验证码邮件已发送: ${to} (Message ID: ${info.messageId})`);
  } catch (error: any) {
    console.error('❌ 发送邮件失败:', error);
    // 如果邮件发送失败，仍然打印到控制台以便调试
    console.log(`\n📧 验证码（邮件发送失败，打印到控制台）:`);
    console.log(`   收件人: ${to}`);
    console.log(`   验证码: ${code}`);
    console.log(`   有效期: 10分钟\n`);
    throw new Error('邮件发送失败，请检查邮件服务配置');
  }
}

/**
 * 通用邮件发送函数
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const transporter = getTransporter();
  const config = getEmailConfig();

  const mailOptions = {
    from: `"51Talk Video Analysis" <${config.SMTP_FROM}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ''), // 简单的 HTML 转文本
  };

  try {
    // 如果没有配置 SMTP，只打印到控制台
    if (!config.SMTP_USER || !config.SMTP_PASS) {
      console.log(`\n📧 邮件（未配置邮件服务，仅打印到控制台）:`);
      console.log(`   收件人: ${options.to}`);
      console.log(`   主题: ${options.subject}`);
      console.log(`   内容: ${mailOptions.text.substring(0, 100)}...\n`);
      return;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ 邮件已发送: ${options.to} (Message ID: ${info.messageId})`);
  } catch (error: any) {
    console.error('❌ 发送邮件失败:', error);
    // 如果邮件发送失败，仍然打印到控制台以便调试
    console.log(`\n📧 邮件（发送失败，打印到控制台）:`);
    console.log(`   收件人: ${options.to}`);
    console.log(`   主题: ${options.subject}\n`);
    throw new Error('邮件发送失败，请检查邮件服务配置');
  }
}

/**
 * 测试邮件服务配置
 */
export async function testEmailService(): Promise<boolean> {
  try {
    const config = getEmailConfig();
    const transporter = getTransporter();
    
    if (!config.SMTP_USER || !config.SMTP_PASS) {
      console.log('⚠️  邮件服务未配置，跳过测试');
      return false;
    }

    console.log('⏳ 正在验证邮件服务配置（最多等待10秒）...');
    
    // 添加超时包装，防止卡住
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('连接超时：无法在10秒内连接到SMTP服务器')), 10000);
    });

    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('✅ 邮件服务配置正确');
    return true;
  } catch (error: any) {
    console.error('❌ 邮件服务配置错误:', error.message);
    return false;
  }
}

