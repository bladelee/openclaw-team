// Casdoor 集成测试脚本
// 这是一个独立的测试脚本，用于验证 Casdoor 集成是否正常工作

const CASDOOR_ENDPOINT = process.env.CASDOOR_ENDPOINT || 'http://localhost:8000';
const CASDOOR_CLIENT_ID = process.env.CASDOOR_CLIENT_ID || '0294ba9030008945af29';
const CASDOOR_CLIENT_SECRET = process.env.CASDOOR_CLIENT_SECRET || '5c8988d3022668d880070f36c1000000aa66d0d5';
const CASDOOR_ORGANIZATION = process.env.CASDOOR_ORGANIZATION || 'openclaw';
const CASDOOR_APPLICATION = process.env.CASDOOR_APPLICATION || 'app-openclaw';
const CASDOOR_REDIRECT_URI = process.env.CASDOOR_REDIRECT_URI || 'http://localhost:3001/api/auth/casdoor/callback';

// 生成 PKCE code_verifier 和 code_challenge
function generateCodeVerifier() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomValues, b => chars[b % chars.length]).join('');
}

function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

async function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// 测试函数
async function testCasdoorIntegration() {
  console.log('='.repeat(60));
  console.log('Casdoor SSO 集成测试');
  console.log('='.repeat(60));
  console.log('');

  console.log('配置信息:');
  console.log(`  端点: ${CASDOOR_ENDPOINT}`);
  console.log(`  客户端 ID: ${CASDOOR_CLIENT_ID}`);
  console.log(`  组织: ${CASDOOR_ORGANIZATION}`);
  console.log(`  应用: ${CASDOOR_APPLICATION}`);
  console.log(`  回调 URL: ${CASDOOR_REDIRECT_URI}`);
  console.log('');

  // 1. 生成授权 URL
  console.log('1. 生成 OAuth 授权 URL...');
  const state = Math.random().toString(36).substring(2);
  const codeVerifier = generateCodeVerifier();
  const hashBuffer = await sha256(codeVerifier);
  const codeChallenge = await base64UrlEncode(hashBuffer);

  const authParams = new URLSearchParams({
    client_id: CASDOOR_CLIENT_ID,
    response_type: 'code',
    redirect_uri: CASDOOR_REDIRECT_URI,
    scope: 'openid profile email',
    state: state,
    organization: CASDOOR_ORGANIZATION,
    application: CASDOOR_APPLICATION,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `${CASDOOR_ENDPOINT}/login/oauth/authorize?${authParams.toString()}`;
  console.log(`   授权 URL: ${authUrl}`);
  console.log(`   State: ${state}`);
  console.log(`   Code Challenge: ${codeChallenge.substring(0, 20)}...`);
  console.log('');

  // 2. 测试 Casdoor 连接
  console.log('2. 测试 Casdoor 服务连接...');
  try {
    const healthResponse = await fetch(`${CASDOOR_ENDPOINT}/api/login/oauth/health`, {
      method: 'GET',
    });
    if (healthResponse.ok) {
      console.log('   ✅ Casdoor 服务连接正常');
    } else {
      console.log('   ⚠️  Casdoor 服务响应异常:', healthResponse.status);
    }
  } catch (error) {
    console.log('   ❌ 无法连接到 Casdoor:', error.message);
  }
  console.log('');

  // 3. 测试获取应用信息
  console.log('3. 测试获取应用信息...');
  try {
    const appParams = new URLSearchParams({
      id: CASDOOR_CLIENT_ID,
      organization: CASDOOR_ORGANIZATION,
    });
    const appResponse = await fetch(`${CASDOOR_ENDPOINT}/api/get-application?${appParams.toString()}`);
    if (appResponse.ok) {
      const app = await appResponse.json();
      console.log('   ✅ 应用信息获取成功');
      console.log(`      名称: ${app.name || app.displayName}`);
      console.log(`      组织: ${app.organization}`);
      console.log(`      回调 URLs: ${(app.redirectUris || []).join(', ')}`);
    } else {
      console.log('   ⚠️  应用信息获取失败:', appResponse.status);
      const errorText = await appResponse.text();
      console.log(`      错误: ${errorText}`);
    }
  } catch (error) {
    console.log('   ❌ 获取应用信息失败:', error.message);
  }
  console.log('');

  // 4. 显示手动测试步骤
  console.log('4. 手动测试步骤:');
  console.log('   1. 访问以下 URL 进行登录:');
  console.log(`      ${authUrl}`);
  console.log('   2. 在 Casdoor 登录页面输入凭据:');
  console.log('      用户名: admin');
  console.log('      密码: 123');
  console.log('   3. 授权后，观察浏览器重定向到回调 URL');
  console.log('   4. 回调 URL 应该包含 code 和 state 参数');
  console.log('');

  // 5. 显示环境变量配置
  console.log('5. 后端环境变量配置:');
  console.log('   CASDOOR_ENABLED=true');
  console.log(`   CASDOOR_ENDPOINT=${CASDOOR_ENDPOINT}`);
  console.log(`   CASDOOR_CLIENT_ID=${CASDOOR_CLIENT_ID}`);
  console.log(`   CASDOOR_CLIENT_SECRET=${CASDOOR_CLIENT_SECRET}`);
  console.log(`   CASDOOR_ORGANIZATION=${CASDOOR_ORGANIZATION}`);
  console.log(`   CASDOOR_APPLICATION=${CASDOOR_APPLICATION}`);
  console.log(`   CASDOOR_REDIRECT_URI=${CASDOOR_REDIRECT_URI}`);
  console.log(`   FRONTEND_URL=http://localhost:3001`);
  console.log('');

  // 6. 显示前端环境变量配置
  console.log('6. 前端环境变量配置:');
  console.log('   NEXT_PUBLIC_API_URL=http://localhost:3000/api');
  console.log(`   NEXT_PUBLIC_CASDOOR_ENABLED=true`);
  console.log(`   NEXT_PUBLIC_CASDOOR_ENDPOINT=${CASDOOR_ENDPOINT}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('测试完成!');
  console.log('='.repeat(60));
}

// 运行测试
testCasdoorIntegration().catch(console.error);
