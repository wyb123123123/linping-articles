/**
 * mass_send_existing.js
 * 用已有草稿 media_id 直接群发，不重新创建草稿。
 * Usage: node mass_send_existing.js <media_id>
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const mediaId = process.argv[2];
if (!mediaId) {
  console.error('Usage: node mass_send_existing.js <media_id>');
  process.exit(1);
}

let wechatConfig;
try {
  wechatConfig = JSON.parse(fs.readFileSync(
    path.join(process.env.HOME || process.env.USERPROFILE, '.workbuddy/wechat/config.json'), 'utf-8'
  ));
} catch (e) { console.error('Config error:', e.message); process.exit(1); }

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data.substring(0, 200))); }
      });
    }).on('error', reject);
  });
}

function httpsPost(hostname, urlPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname, path: urlPath, method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('=== 临平数协公众号 - 已有草稿群发 ===');
  console.log('Target media_id:', mediaId);

  // Step 1: Get token
  const tokenResult = await httpsGet(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${wechatConfig.appid}&secret=${wechatConfig.appsecret}`
  );
  if (!tokenResult.access_token) {
    console.error('Token error:', JSON.stringify(tokenResult));
    process.exit(1);
  }
  const token = tokenResult.access_token;
  console.log('Step 1: Token obtained ✓');

  // Step 2: Try mass/sendall first
  console.log('Step 2: Attempting mass/sendall...');
  const massResult = await httpsPost('api.weixin.qq.com',
    `/cgi-bin/message/mass/sendall?access_token=${token}`,
    {
      filter: { is_to_all: true },
      mpnews: { media_id: mediaId },
      msgtype: 'mpnews',
      send_ignore_reprint: 0
    }
  );
  console.log('  mass/sendall response:', JSON.stringify(massResult));

  if (massResult.errcode === 0 || massResult.msg_id) {
    console.log('\n✅ 群发成功！');
    console.log('  msg_id:', massResult.msg_id || 'N/A');
    console.log('  msg_data_id:', massResult.msg_data_id || 'N/A');
    return;
  }

  // If mass/sendall fails, try freepublish/submit
  console.log('\n⚠️  mass/sendall 失败（errcode:', massResult.errcode, '）');
  console.log('  回退到 freepublish/submit...');
  const pubResult = await httpsPost('api.weixin.qq.com',
    `/cgi-bin/freepublish/submit?access_token=${token}`,
    { media_id: mediaId }
  );
  console.log('  freepublish/submit response:', JSON.stringify(pubResult));

  if (pubResult.errcode === 0 || pubResult.publish_id) {
    console.log('\n✅ freepublish/submit 发布成功！');
    console.log('  publish_id:', pubResult.publish_id || 'N/A');
  } else {
    console.log('\n❌ 两种方式均失败。');
    console.log('  freepublish response:', pubResult.errmsg || JSON.stringify(pubResult));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
