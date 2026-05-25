const fs = require('fs');
const https = require('https');
const path = require('path');
const juice = require('juice');

// ===== Args =====
const args = process.argv.slice(2);
const draftOnly = args.includes('--draft-only');
const htmlFile = args.filter(a => a !== '--draft-only')[0] || 'articles/linping_daily_2026-05-22.html';
const imageFile = args.filter(a => a !== '--draft-only')[1] || null;

// ===== Config =====
let wechatConfig;
try {
  wechatConfig = JSON.parse(fs.readFileSync(
    path.join(process.env.HOME || process.env.USERPROFILE, '.workbuddy/wechat/houri_config.json'), 'utf-8'
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

// ===== CSS handling: inline ALL styles, then strip <style> =====
// WeChat draft editor does NOT reliably support <style> tags.
// juice inlines all CSS into style="" attributes for 100% consistent rendering.
function prepareCSS(html) {
  // Strip meta viewport (WeChat ignores it)
  html = html.replace(/<meta[^>]*viewport[^>]*>/gi, '');

  // First, strip truly incompatible CSS rules that juice can't handle
  html = html.replace(/<style>([\s\S]*?)<\/style>/gi, (match, css) => {
    css = css
      .replace(/[^}]*:hover\s*\{[^}]*\}/g, '')        // WeChat不支持:hover
      .replace(/position:\s*(?:fixed|sticky);?/gi, '') // 不支持fixed/sticky
      .replace(/animation:[^;]+;?/gi, '')               // 不支持animation
      .replace(/@keyframes\s+[^{]*\{[^}]*\}/gi, '');    // 不支持@keyframes
    return '<style>' + css + '</style>';
  });

  // Use juice to inline all CSS into style="" attributes
  html = juice(html, {
    removeStyleTags: true,        // Remove <style> after inlining
    preserveImportant: true,
    applyStyleTags: true,
    applyWidthAttributes: true,
    applyHeightAttributes: true,
    xmlMode: false,
  });

  return html;
}

// ===== WeChat HTML compatibility: div→section, extract body content =====
// WeChat draft/add API DESTROYS <div> tags and their styles.
// Only <section>, <span>, <img>, <strong>, <br> survive with styles intact.
function wechatifyHTML(html) {
  // 1. Extract only <body> inner content (strip DOCTYPE/html/head/body wrapper)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) html = bodyMatch[1];

  // 2. Convert <div to <section, </div> to </section>
  html = html.replace(/<div\b/gi, '<section');
  html = html.replace(/<\/div>/gi, '</section>');

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

// ===== WeChat link handling =====
// 构建链接中转页：每条新闻对应独立可点击链接，content_source_url 指向中转页
// 保留正文中 <a> 标签 — 认证账号可点击，未认证账号配合阅读原文使用
function buildLinkHub(htmlFile) {
  return new Promise((resolve, reject) => {
    const { execSync } = require('child_process');
    try {
      const result = execSync(`node "${__dirname}/build_link_hub.js" "${htmlFile}"`, { encoding: 'utf-8' });
      // Parse JSON from last line after --RESULT--
      const resultMatch = result.match(/--RESULT--\s*([\s\S]*)/);
      if (resultMatch) {
        resolve(JSON.parse(resultMatch[1].trim()));
      } else {
        reject(new Error('Failed to parse build_link_hub output'));
      }
    } catch (e) {
      reject(e);
    }
  });
}

// ===== Main =====
async function main() {
  try {
    console.log('=== 后日资本公众号' + (draftOnly ? '草稿箱推送' : '自动发布') + ' ===');
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
    const ghPagesBase = 'https://wyb123123123.github.io/houri-articles/';
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

    // Step 3: Prepare CSS for WeChat (juice inline all styles, strip <style>)
    console.log('Step 3: Preparing CSS...');
    html = prepareCSS(html);

    // Step 3.2: WeChatify HTML (div→section, extract body content)
    html = wechatifyHTML(html);
    console.log('  WeChatified: div→section, body extracted');

    // Step 3.5: Build link hub page + set content_source_url
    // 优先用链接中转页（每条独立可点击），如部署失败则回退到文章页
    console.log('Step 3.5: Building link hub page...');
    let ghPageUrl = ghPagesBase + path.basename(htmlFile); // 默认：文章页
    try {
      const hubResult = await buildLinkHub(htmlFile);
      const hubUrl = ghPagesBase + hubResult.hubPath;
      console.log(`  Hub built: ${hubUrl} (${hubResult.links.length} links)`);
      // 用文章页作为阅读原文（已部署，含所有<a>链接；中转页需等待git push后生效）
    } catch (e) {
      console.log(`  Hub build failed: ${e.message}`);
    }
    console.log(`  阅读原文: ${ghPageUrl}`);

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
        title, author: '后日资本', digest,
        content: html,
        content_source_url: ghPageUrl,
        thumb_media_id: coverMediaId,
        need_open_comment: 1,
        only_fans_can_comment: 0,
        need_open_original: 1,
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
      // Step 6: 群发（需认证订阅号，会推送给全部用户，手机可见）
      console.log('Step 6: Mass-sending to all subscribers...');
      const massBody = {
        filter: { is_to_all: true },
        mpnews: { media_id: draftMediaId },
        msgtype: 'mpnews',
        send_ignore_reprint: 0
      };
      const massResult = await httpsPost('api.weixin.qq.com', `/cgi-bin/message/mass/sendall?access_token=${token}`, massBody);

      if (massResult.errcode === 0 || massResult.msg_id) {
        console.log('\n\u2705 群发成功！Msg ID:', massResult.msg_id || 'N/A');
        console.log('  文章已推送到所有用户，手机上可见');
      } else if (massResult.errcode === 48001) {
        console.log('\n\u274c 群发失败：账号未认证，无群发API权限（errcode 48001）');
        console.log('  回退到 freepublish/submit（自由发布，手机可能不显示）...');
        const pubResult = await httpsPost('api.weixin.qq.com', `/cgi-bin/freepublish/submit?access_token=${token}`, { media_id: draftMediaId });
        if (pubResult.errcode === 0 || pubResult.publish_id) {
          console.log('\n\u2705 自由发布成功！Publish ID:', pubResult.publish_id || 'N/A');
        } else {
          console.log('\n\u26a0\ufe0f ', pubResult.errmsg || JSON.stringify(pubResult));
        }
      } else {
        console.log('\n\u26a0\ufe0f 群发失败:', massResult.errmsg || JSON.stringify(massResult), '(errcode:', massResult.errcode, ')');
        console.log('  回退到 freepublish/submit...');
        const pubResult = await httpsPost('api.weixin.qq.com', `/cgi-bin/freepublish/submit?access_token=${token}`, { media_id: draftMediaId });
        if (pubResult.errcode === 0 || pubResult.publish_id) {
          console.log('\n\u2705 自由发布成功！Publish ID:', pubResult.publish_id || 'N/A');
        } else {
          console.log('\n\u26a0\ufe0f ', pubResult.errmsg || JSON.stringify(pubResult));
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
