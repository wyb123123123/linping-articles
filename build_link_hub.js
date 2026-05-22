// build_link_hub.js — Extract links from daily article and build a clickable link hub page
// Usage: node build_link_hub.js <article_html> [output_html]
// Output: links/linping_links_YYYY-MM-DD.html

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const articleHtml = args[0];
if (!articleHtml || !fs.existsSync(articleHtml)) {
  console.error('Usage: node build_link_hub.js <article.html>');
  process.exit(1);
}

const html = fs.readFileSync(articleHtml, 'utf-8');
const dir = path.dirname(path.resolve(articleHtml));
const linksDir = path.join(dir, 'links');
if (!fs.existsSync(linksDir)) fs.mkdirSync(linksDir, { recursive: true });

// Extract date from filename
const dateMatch = path.basename(articleHtml).match(/(\d{4}-\d{2}-\d{2})/);
const date = dateMatch ? dateMatch[1] : '';

// === Extract links with context ===
const links = [];
const sectionRegex = /<div class="section-title">(.*?)<\/div>/gi;
const itemRegex = /<div class="news-item">([\s\S]*?)<\/div>\s*(?=<div class="(?:section-title|news-item|section-divider)">|$)/gi;
const titleRegex = /<span class="item-title">([\s\S]*?)<\/span>/i;
const descRegex = /<div class="item-desc">\s*([\s\S]*?)\s*<\/div>/i;
const sourceRegex = /<span class="item-source">([\s\S]*?)<\/span>/i;
const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>/i;
const tagRegex = /<span class="item-tag[^"]*">([^<]*)<\/span>/i;

let currentSection = '';
let sectionMatch;
let allSections = [];
while ((sectionMatch = sectionRegex.exec(html)) !== null) {
  allSections.push({ name: sectionMatch[1].replace(/<[^>]*>/g, '').trim(), pos: sectionMatch.index });
}

let itemMatch;
while ((itemMatch = itemRegex.exec(html)) !== null) {
  const block = itemMatch[1];
  const titleMatch = block.match(titleRegex);
  const descMatch = block.match(descRegex);
  const sourceMatch = block.match(sourceRegex);
  const linkMatch = block.match(linkRegex);
  const tagMatch = block.match(tagRegex);

  if (!linkMatch) continue;

  const linkUrl = linkMatch[1];

  // Determine section
  const itemPos = itemMatch.index;
  let section = '';
  for (let i = allSections.length - 1; i >= 0; i--) {
    if (allSections[i].pos < itemPos) { section = allSections[i].name; break; }
  }

  const titleText = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
  const descText = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 200) : '';
  const sourceText = sourceMatch ? sourceMatch[1].replace(/<[^>]*>/g, '').trim() : '';
  const tagText = tagMatch ? tagMatch[1].trim() : '';

  links.push({
    section, title: titleText, desc: descText,
    source: sourceText, url: linkUrl, tag: tagText
  });
}

console.log(`Extracted ${links.length} links from ${articleHtml}`);

// Deduplicate by URL
const seen = new Set();
const uniqueLinks = links.filter(l => {
  if (seen.has(l.url)) return false;
  seen.add(l.url);
  return true;
});
console.log(`  ${uniqueLinks.length} unique links after dedup`);

// === Build hub page ===
const outputFile = args[1] || path.join(linksDir, `linping_links_${date}.html`);

let hubHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>原文链接汇总 — 临平数协数据资产日报 ${date}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; background: #F5F1EA; color: #2C1810; padding: 20px; max-width: 700px; margin: 0 auto; }
  .header { text-align: center; padding: 30px 0 20px; border-bottom: 2px solid #D4BE9C; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #4A2C1A; margin-bottom: 4px; }
  .header .sub { font-size: 13px; color: #968878; }
  .section-label { font-size: 15px; font-weight: 700; color: #4A2C1A; background: #E8D5C0; display: inline-block; padding: 4px 14px; border-radius: 4px; margin: 20px 0 10px; }
  .link-card { background: #fff; border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-left: 3px solid #8B6920; }
  .link-card .tag { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 3px; margin-bottom: 6px; color: #fff; background: #8B6920; }
  .link-card .title { font-size: 15px; font-weight: 600; color: #2C1810; line-height: 1.5; margin-bottom: 6px; }
  .link-card .desc { font-size: 12px; color: #6B4528; line-height: 1.6; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .link-card .meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #968878; }
  .link-card .source { }
  .link-card a { display: inline-block; padding: 6px 14px; background: #4A2C1A; color: #E8B040; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 600; transition: background 0.2s; }
  .link-card a:hover { background: #6B4528; }
  .link-card a:active { background: #2C1810; }
  .footer { text-align: center; padding: 24px; color: #968878; font-size: 11px; margin-top: 20px; }
  .footer a { color: #8B6920; text-decoration: none; }
</style>
</head>
<body>
<div class="header">
  <h1>📎 原文链接汇总</h1>
  <div class="sub">临平数协 · 数据资产日报 · ${date} · 共 ${uniqueLinks.length} 条</div>
</div>
`;

// Group by section
const sections = {};
for (const l of uniqueLinks) {
  if (!sections[l.section]) sections[l.section] = [];
  sections[l.section].push(l);
}

for (const [section, sectionLinks] of Object.entries(sections)) {
  hubHtml += `<div class="section-label">${section}</div>\n`;
  for (const l of sectionLinks) {
    hubHtml += `  <div class="link-card">
    ${l.tag ? `<span class="tag">${l.tag}</span>` : ''}
    <div class="title">${l.title}</div>
    ${l.desc ? `<div class="desc">${l.desc}</div>` : ''}
    <div class="meta">
      <span class="source">${l.source}</span>
      <a href="${l.url}" target="_blank" rel="noopener">打开原文 ↗</a>
    </div>
  </div>\n`;
  }
}

hubHtml += `</div>
<div class="footer">
  <p>由 <a href="https://github.com/wyb123123123/linping-articles" target="_blank">临平数协数据资产日报</a> 自动生成</p>
  <p>点击上方按钮即可跳转至对应原文页面</p>
</div>
</body>
</html>`;

fs.writeFileSync(outputFile, hubHtml, 'utf-8');
console.log(`Link hub page written: ${outputFile}`);
console.log(`  → https://wyb123123123.github.io/linping-articles/links/${path.basename(outputFile)}`);

// Output JSON for integration
const result = { links: uniqueLinks, hubFile: outputFile, hubPath: `links/${path.basename(outputFile)}` };
console.log('\n--RESULT--');
console.log(JSON.stringify(result));
