const fs = require('fs');
const https = require('https');
const path = require('path');

// Support command-line arguments: node publish_draft.js <html_file> [image_file]
const args = process.argv.slice(2);
const htmlFile = args[0] || 'articles/linping_daily_2026-05-22.html';
const imageFile = args[1] || null;

// Read config
let wechatConfig;
try {
  wechatConfig = JSON.parse(fs.readFileSync(
    path.join(process.env.HOME || process.env.USERPROFILE, '.workbuddy/wechat/config.json'), 'utf-8'
  ));
} catch (e) {
  console.error('Failed to read wechat config:', e.message);
  process.exit(1);
}

// Read article HTML
let html;
try {
  html = fs.readFileSync(htmlFile, 'utf-8');
} catch (e) {
  console.error('Failed to read HTML file:', htmlFile);
  process.exit(1);
}

// Extract title from HTML
const titleMatch = html.match(/<title>(.*?)<\/title>/);
const cnTitleMatch = html.match(/<div class="cn-title">(.*?)<\/div>/);
const title = cnTitleMatch ? cnTitleMatch[1] + ' - ' + (titleMatch ? titleMatch[1].replace('数据资产日报 - ', '') : path.basename(htmlFile, '.html')) : (titleMatch ? titleMatch[1] : path.basename(htmlFile, '.html'));

// Extract digest from first news item
const digestMatch = html.match(/<div class="item-desc">\s*(.*?)\s*<\/div>/);
const digest = digestMatch ? digestMatch[1].replace(/<[^>]+>/g, '').substring(0, 120) : '聚焦数据要素市场动态，洞察数字经济发展趋势——临平数协数据资产日报';

function getToken() {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${wechatConfig.appid}&secret=${wechatConfig.appsecret}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.access_token) {
          resolve(result.access_token);
        } else {
          reject(new Error('Token error: ' + data));
        }
      });
    }).on('error', reject);
  });
}

function uploadImage(token, imagePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    const fileData = fs.readFileSync(imagePath);
    const filename = path.basename(imagePath);

    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

    const body = Buffer.concat([header, fileData, footer]);

    const req = https.request({
      hostname: 'api.weixin.qq.com',
      path: `/cgi-bin/material/add_material?access_token=${token}&type=image`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.media_id) {
          console.log('Image uploaded, media_id:', result.media_id);
          resolve(result.media_id);
        } else {
          reject(new Error('Image upload error: ' + data));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function createDraft(token, mediaId) {
  const body = JSON.stringify({
    articles: [{
      title: title,
      author: '临平数据产业协会',
      digest: digest,
      content: html,
      content_source_url: '',
      thumb_media_id: mediaId,
      need_open_comment: 0,
      only_fans_can_comment: 0,
      pic_crop: { left: 0, right: 1, top: 0, bottom: 1 }
    }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.weixin.qq.com',
      path: '/cgi-bin/draft/add?access_token=' + token,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    console.log('=== 临平数协公众号草稿箱推送 ===');
    console.log('HTML:', htmlFile);
    console.log('Title:', title);
    console.log('');

    const token = await getToken();
    console.log('Step 1: Token obtained');

    let mediaId;
    if (imageFile) {
      mediaId = await uploadImage(token, imageFile);
    } else {
      // Look for any png/jpg in articles dir as fallback
      const dir = path.dirname(htmlFile);
      const files = fs.readdirSync(dir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
      if (files.length > 0) {
        const fallback = path.join(dir, files[files.length - 1]);
        mediaId = await uploadImage(token, fallback);
      } else {
        console.error('No image file found and none specified');
        process.exit(1);
      }
    }
    console.log('Step 2: Image uploaded');

    const result = await createDraft(token, mediaId);
    console.log('Step 3: Draft created');
    console.log('Result:', result);

    const parsed = JSON.parse(result);
    if (parsed.media_id) {
      console.log('\n✅ 推送成功！草稿已存入公众号草稿箱');
    } else if (parsed.errmsg) {
      console.log('\n⚠️ ', parsed.errmsg);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
