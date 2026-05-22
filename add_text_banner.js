const sharp = require('sharp');
const path = require('path');

const ARTICLES = __dirname;
const BG_PATH = path.join(
  'C:\\Users\\Administrator\\.workbuddy\\clipboard-images',
  'clipboard-2026-05-22T04-36-06-431Z-8e228f33.jpg'
);

function createTextSvg(width, height) {
  const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <!-- 主标题阴影 -->
    <filter id="textShadow" x="-5%" y="-5%" width="110%" height="120%">
      <feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- 英文副标题 -->
  <text x="${width * 0.46}" y="${height * 0.38}"
        font-family="'PingFang SC','Microsoft YaHei',sans-serif"
        font-size="${Math.round(height * 0.052)}"
        fill="rgba(255,255,255,0.52)"
        letter-spacing="10"
        text-anchor="start"
        font-weight="400">DATA ASSET DAILY REPORT</text>

  <!-- 中文主标题 - 带发光和阴影 -->
  <text x="${width * 0.46}" y="${height * 0.55}"
        font-family="'PingFang SC','Microsoft YaHei','Hiragino Sans GB',sans-serif"
        font-size="${Math.round(height * 0.125)}"
        fill="#FFFFFF"
        letter-spacing="14"
        text-anchor="start"
        font-weight="700"
        filter="url(#textShadow)">数据资产日报</text>

  <!-- 日期行 -->
  <text x="${width * 0.46}" y="${height * 0.70}"
        font-family="'PingFang SC','Microsoft YaHei',sans-serif"
        font-size="${Math.round(height * 0.052)}"
        fill="rgba(255,255,255,0.82)"
        letter-spacing="3"
        text-anchor="start"
        font-weight="300">2026年5月22日 星期五</text>

  <!-- 分隔线 -->
  <line x1="${width * 0.46}" y1="${height * 0.76}"
        x2="${width * 0.78}" y2="${height * 0.76}"
        stroke="rgba(255,255,255,0.32)"
        stroke-width="1.5"/>

  <!-- 副标语 -->
  <text x="${width * 0.46}" y="${height * 0.86}"
        font-family="'PingFang SC','Microsoft YaHei',sans-serif"
        font-size="${Math.round(height * 0.042)}"
        fill="rgba(255,255,255,0.50)"
        letter-spacing="4"
        text-anchor="start"
        font-weight="300">追踪数据要素市场脉动 · 洞察数字经济发展趋势</text>
</svg>`;
  return Buffer.from(svg);
}

async function addText() {
  const bg = await sharp(BG_PATH).metadata();
  console.log('BG:', bg.width, 'x', bg.height);

  const svgBuffer = createTextSvg(bg.width, bg.height);

  await sharp(BG_PATH)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .png()
    .toFile(path.join(ARTICLES, 'banner_with_title.png'));

  console.log('Done → banner_with_title.png');
}

addText().catch(err => { console.error('Error:', err.message); process.exit(1); });
