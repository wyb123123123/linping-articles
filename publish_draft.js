const fs = require('fs');
const https = require('https');
const path = require('path');

// ===== Args =====
const args = process.argv.slice(2);
const draftOnly = args.includes('--draft-only');
const htmlFile = args.filter(a => a !== '--draft-only')[0] || 'articles/linping_daily_2026-05-22.html';
const imageFile = args.filter(a => a !== '--draft-only')[1] || null;

// ===== Config =====
let wechatConfig;
try {
  wechatConfig = JSON.parse(fs.readFileSync(
    path.join(process.env.HOME || process.env.USERPROFILE, '.workbuddy/wechat/config.json'), 'utf-8'
  ));
} catch (e) { console.error('Config error:', e.message); process.exit(1); }

// ===== Read HTML =====
let rawHtml;
try { rawHtml = fs.readFileSync(htmlFile, 'utf-8'); }
catch (e) { console.error('HTML read error:', e.message); process.exit(1); }

const titleMatch = rawHtml.match(/<title>(.*?)<\/title>/);
const title = titleMatch ? titleMatch[1] : path.basename(htmlFile, '.html');
const digestMatch = rawHtml.match(/<div class="item-desc">\s*(.*?)\s*<\/div>/);
const digest = digestMatch ? digestMatch[1].replace(/<[^>]+>/g, '').substring(0, 120) : '聚焦数据要素市场动态，洞察数字经济发展趋势';

// ===== Smart CSS Parser =====
function parseAndInlineCSS(html) {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!styleMatch) return html;
  const css = styleMatch[1];

  // Parse all rules, group by last class name in selector
  const rules = {};
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let rm;
  while ((rm = ruleRegex.exec(css)) !== null) {
    const selector = rm[1].trim();
    const props = rm[2].replace(/\/\*.*?\*\//g, '').trim();
    if (!props) continue;

    // Handle body element
    if (selector === 'body' || selector === '*') {
      const key = selector === 'body' ? '__body__' : '__all__';
      if (!rules[key]) rules[key] = [];
      rules[key].push(props);
      continue;
    }

    // Extract class names (last one is the target)
    const classNames = selector.match(/\.[a-zA-Z0-9_-]+/g);
    if (classNames) {
      const key = classNames[classNames.length - 1].substring(1);
      if (!rules[key]) rules[key] = [];
      rules[key].push(props);
    }
  }

  console.log(`  Parsed ${Object.keys(rules).length} style rules`);

  // Merge and inline
  for (const [cls, propsList] of Object.entries(rules)) {
    let styles = propsList.join(';');

    // WeChat cleanup
    styles = styles
      .replace(/linear-gradient\([^)]+\)/gi, (m) => {
        const c = m.match(/#[0-9a-fA-F]{3,8}/);
        return c ? c[0] : '#F5F1EA';
      })
      .replace(/box-shadow:\s*[^;]+;?/gi, '')
      .replace(/:hover\s*\{[^}]*\}/g, '')
      .replace(/display:\s*flex;?/g, '')
      .replace(/align-items:\s*[^;]+;?/g, '')
      .replace(/gap:\s*[^;]+;?/g, '')
      .replace(/flex-wrap:\s*[^;]+;?/g, '')
      .replace(/flex-shrink:\s*[^;]+;?/g, '')
      .replace(/justify-content:\s*[^;]+;?/g, '')
      .trim();

    if (!styles) continue;

    if (cls === '__body__') {
      html = html.replace(/<body([^>]*)>/, `<body$1 style="${styles}">`);
    } else if (cls === '__all__') {
      // Skip * rules - too broad for inline
    } else {
      const clsRegex = new RegExp(`class="([^"]*\\b${cls}\\b[^"]*)"`, 'g');
      html = html.replace(clsRegex, (m, classes) => {
        return `class="${classes}" style="${styles}"`;
      });
    }
  }

  // Strip <style> and meta viewport
  html = html.replace(/<style>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<meta[^>]*viewport[^>]*>/gi, '');
  // Fix any remaining max-width
  html = html.replace(/max-width:\s*\d+px;?/g, '');

  return html;
}

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

function httpsPost(hostname, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(bodyStr),
      ...extraHeaders
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

function uploadMaterial(token, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----Wx' + Math.random().toString(36).substring(2);
    const fileData = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`);
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileData, footer]);

    const req = https.request({
      hostname: 'api.weixin.qq.com',
      path: `/cgi-bin/material/add_material?access_token=${token}&type=image`,
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.media_id) resolve(result);
          else reject(new Error('Upload failed: ' + data));
        } catch (e) { reject(new Error('Upload parse error: ' + data.substring(0, 150))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Upload timeout')); });
    req.write(body);
    req.end();
  });
}

// ===== Find local images =====
function findLocalImages(html) {
  const imgs = new Set();
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (!m[1].startsWith('http') && !m[1].startsWith('//')) imgs.add(m[1]);
  }
  return [...imgs];
}

// ===== Main =====
async function main() {
  try {
    console.log('=== 临平数协公众号' + (draftOnly ? '草稿箱推送' : '自动发布') + ' ===');
    console.log('HTML:', htmlFile);
    console.log('Title:', title);

    // Step 1: Token
    const tokenResult = await httpsGet(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${wechatConfig.appid}&secret=${wechatConfig.appsecret}`);
    if (!tokenResult.access_token) throw new Error('Token error: ' + JSON.stringify(tokenResult));
    const token = tokenResult.access_token;
    console.log('Step 1: Token obtained');

    // Step 2: Upload images + replace URLs
    const localImages = findLocalImages(rawHtml);
    console.log(`Step 2: Found ${localImages.length} local image(s)`);
    let html = rawHtml;
    const dir = path.dirname(path.resolve(htmlFile));
    for (const src of localImages) {
      const fullPath = path.join(dir, src);
      if (fs.existsSync(fullPath)) {
        try {
          const result = await uploadMaterial(token, fullPath);
          html = html.replace(new RegExp(`src=["']${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g'), `src="${result.url}"`);
          console.log(`  ✓ ${src}`);
        } catch (e) {
          console.log(`  ✗ ${src}: ${e.message}`);
        }
      } else {
        console.log(`  ✗ ${src}: not found`);
      }
    }

    // Step 3: Inline CSS for WeChat
    console.log('Step 3: Inlining CSS...');
    html = parseAndInlineCSS(html);
    const size = Buffer.byteLength(html, 'utf-8');
    console.log(`  Final HTML: ${size} bytes`);

    // Step 4: Cover image
    const coverPath = imageFile ? path.resolve(imageFile) : path.join(dir, 'banner_final.png');
    if (!fs.existsSync(coverPath)) { console.error('Cover not found:', coverPath); process.exit(1); }
    const coverResult = await uploadMaterial(token, coverPath);
    const coverMediaId = coverResult.media_id;
    console.log('Step 4: Cover image ready');

    // Step 5: Create draft
    console.log('Step 5: Creating draft...');
    const draftResult = await httpsPost('api.weixin.qq.com', `/cgi-bin/draft/add?access_token=${token}`, {
      articles: [{
        title, author: '临平数据产业协会', digest,
        content: html,
        content_source_url: '',
        thumb_media_id: coverMediaId,
        need_open_comment: 0,
        only_fans_can_comment: 0,
        pic_crop: { left: 0, right: 1, top: 0, bottom: 1 }
      }]
    });

    if (!draftResult.media_id) {
      console.log('\n\u26a0\ufe0f Draft failed:', draftResult.errmsg || JSON.stringify(draftResult));
      process.exit(1);
    }
    const draftMediaId = draftResult.media_id;
    console.log('  Draft media_id:', draftMediaId);

    if (draftOnly) {
      console.log('\n\u2705 草稿已存入草稿箱（未自动发布）');
    } else {
      console.log('Step 6: Auto-publishing...');
      const pubResult = await httpsPost('api.weixin.qq.com', `/cgi-bin/freepublish/submit?access_token=${token}`, { media_id: draftMediaId });
      if (pubResult.errcode === 0 || pubResult.publish_id) {
        console.log('\n\u2705 自动发布成功！Publish ID:', pubResult.publish_id || 'N/A');
      } else {
        console.log('\n\u26a0\ufe0f ', pubResult.errmsg || JSON.stringify(pubResult));
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
