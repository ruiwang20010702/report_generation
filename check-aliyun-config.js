require('dotenv').config();

const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
const appKey = process.env.ALIYUN_NLS_APP_KEY;

console.log('\n🔍 检查阿里云配置：\n');
console.log('ALIYUN_ACCESS_KEY_ID:', accessKeyId ? `✅ SET (${accessKeyId.substring(0, 8)}...)` : '❌ NOT SET');
console.log('ALIYUN_ACCESS_KEY_SECRET:', accessKeySecret ? `✅ SET (${accessKeySecret.substring(0, 8)}...)` : '❌ NOT SET');
console.log('ALIYUN_NLS_APP_KEY:', appKey ? `✅ SET (${appKey})` : '❌ NOT SET');

if (appKey && !appKey.startsWith('nls-')) {
  console.log('\n⚠️  警告：AppKey 通常应该以 "nls-" 开头');
  console.log('   当前值：', appKey);
  console.log('   建议格式：nls-xxxxxxxxxxxxx');
  console.log('   如果您的 AppKey 确实不包含 "nls-" 前缀，请忽略此警告\n');
}

if (accessKeyId && accessKeySecret && appKey) {
  console.log('\n✅ 所有必需的配置都已设置！');
  console.log('💡 如果仍然看到错误，请重启后端服务：');
  console.log('   1. 停止当前运行的后端服务（Ctrl+C）');
  console.log('   2. 运行: npm run dev:server');
  console.log('   或: npm run dev:all\n');
} else {
  console.log('\n❌ 缺少必需的配置，请检查 .env 文件\n');
}
