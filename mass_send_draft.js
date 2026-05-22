const fs = require('fs');
const https = require('https');
const path = require('path');

// ===== Args =====
const args = process.argv.slice(2);
const latestOnly = args.includes('--latest');
const draftMediaId = args.find(a => !a.startsWith('--')); // optional: specific draft to send

// ===== Config =====
let wechatConfig;
try {
  wechatConfig = JSON.parse(fs.readFileSync(
    path.join(process.env.HOME || process.env.USERPROFILE, '.workbuddy/wechat/config.json'), 'utf-8'
  ));
} catch (e) { console.error('Config error:', e.message); process.exit(1); }

// ===== API helpers =====
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data.substring(0, 150))); }
      });
    }).on('error', reject);
  });
}

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(bodyStr)
    };
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data.substring(0, 150))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

// ===== Main =====
async function main() {
  try {
    console.log('=== 临平数协公众号 — 群发草稿 ===');
    const startTime = new Date().toISOString();
    console.log('Time:', startTime);

    // Step 1: Token
    const tokenResult = await httpsGet(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${wechatConfig.appid}&secret=${wechatConfig.appsecret}`);
    if (!tokenResult.access_token) throw new Error('Token error: ' + JSON.stringify(tokenResult));
    const token = tokenResult.access_token;
    console.log('Step 1: Token obtained');

    let mediaId = draftMediaId;

    if (!mediaId) {
      // Step 2: Get latest draft from draft box
      console.log('Step 2: Fetching drafts from draft box...');
      const draftList = await httpsPost('api.weixin.qq.com', `/cgi-bin/draft/batchget?access_token=${token}`, {
        offset: 0,
        count: 10,
        no_content: 0
      });

      if (!draftList.item || draftList.item.length === 0) {
        console.log('\n\u26a0\ufe0f 草稿箱为空，无需群发');
        process.exit(0);
      }

      // Sort by update_time descending, pick the latest
      const sorted = draftList.item.sort((a, b) => b.update_time - a.update_time);
      const latest = sorted[0];
      mediaId = latest.media_id;
      console.log(`  Found ${draftList.item.length} draft(s), latest: ${mediaId}`);
      console.log(`  Title: ${(latest.content?.news_item || [])[0]?.title || 'N/A'}`);
      console.log(`  Update time: ${new Date(latest.update_time * 1000).toISOString()}`);
    }

    // Step 3: Mass-send the draft
    console.log('Step 3: Mass-sending draft...');
    const massBody = {
      filter: { is_to_all: true },
      mpnews: { media_id: mediaId },
      msgtype: 'mpnews',
      send_ignore_reprint: 0
    };

    const massResult = await httpsPost('api.weixin.qq.com', `/cgi-bin/message/mass/sendall?access_token=${token}`, massBody);

    if (massResult.errcode === 0 || massResult.msg_id) {
      console.log('\n\u2705 群发成功！');
      console.log('  Msg ID:', massResult.msg_id || 'N/A');
      console.log('  Draft ID:', mediaId);
      console.log('  Time:', new Date().toISOString());
    } else {
      console.log('\n\u274c 群发失败:', massResult.errmsg || JSON.stringify(massResult), '(errcode:', massResult.errcode, ')');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
