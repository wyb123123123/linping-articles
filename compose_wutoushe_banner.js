const sharp = require('sharp');

// 日期：默认使用明天
function getTargetDate() {
  const arg = process.argv[2];
  if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
    return new Date(arg + 'T08:00:00+08:00');
  }
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return tomorrow;
}

function formatDateCN(date) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdays[date.getDay()];
  return `${y}年${m}月${d}日 星期${w}`;
}

const targetDate = getTargetDate();
const dateStr = formatDateCN(targetDate);
console.log(`Target date: ${dateStr}`);

async function main() {
  const W = 900, H = 320;

  // ====== 1. 红色渐变背景：左深右浅 ======
  const svgBg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="#8B0000"/>
          <stop offset="14%"  stop-color="#A01010"/>
          <stop offset="32%"  stop-color="#B8222A"/>
          <stop offset="52%"  stop-color="#C41E3A"/>
          <stop offset="74%"  stop-color="#D85040"/>
          <stop offset="100%" stop-color="#E86850"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%"  stop-color="rgba(240,180,170,0.13)"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <path d="M0,${H*0.40} Q${W*0.20},${H*0.32} ${W*0.42},${H*0.36} T${W*0.72},${H*0.42}"
            stroke="rgba(240,210,200,0.10)" stroke-width="0.7" fill="none"/>
      <circle cx="${W*0.30}" cy="${H*0.30}" r="2.0" fill="rgba(240,210,200,0.11)"/>
      <circle cx="${W*0.55}" cy="${H*0.25}" r="1.6" fill="rgba(230,200,190,0.09)"/>
      <circle cx="${W*0.75}" cy="${H*0.60}" r="1.8" fill="rgba(220,190,180,0.08)"/>
      <circle cx="${W*0.88}" cy="${H*0.70}" r="1.4" fill="rgba(210,180,170,0.07)"/>
    </svg>
  `;

  const bgBuffer = await sharp(Buffer.from(svgBg)).png().toBuffer();

  // ====== 2. Logo 去白底 ======
  const logoBuf = await sharp('wutoushe-logo.png')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const raw = logoBuf.data;
  const ch = logoBuf.info.channels;
  for (let i = 0; i < raw.length; i += ch) {
    // 去除白色背景
    if (raw[i] > 218 && raw[i+1] > 218 && raw[i+2] > 218) {
      raw[i+3] = 0;
    } else if (raw[i+3] > 0) {
      // Logo 颜色变为暖白色，与红色渐变协调
      raw[i] = 255;
      raw[i+1] = 245;
      raw[i+2] = 240;
    }
  }

  const logoPng = await sharp(raw, {
    raw: { width: logoBuf.info.width, height: logoBuf.info.height, channels: ch }
  }).png().toBuffer();

  // Logo 尺寸
  const logoScale = 0.18;
  const lw = Math.round(logoBuf.info.width * logoScale);
  const lh = Math.round(logoBuf.info.height * logoScale);

  const logoResized = await sharp(logoPng).resize(lw, lh).png().toBuffer();
  const logoB64 = logoResized.toString('base64');

  // ====== 3. Logo 左上角，文字水平居中 ======
  const cx = Math.round(W / 2);

  const logoX = 8;
  const logoY = 8;

  const cnFontSize  = Math.round(H * 0.145);
  const enFontSize  = Math.round(H * 0.062);
  const dateFontSize = Math.round(H * 0.058);
  const subFontSize = Math.round(H * 0.046);

  const gap = 12;
  const enY   = Math.round(H * 0.30);
  const cnY   = enY + Math.round(enFontSize * 0.6) + gap + Math.round(cnFontSize * 0.7);
  const divY  = cnY + Math.round(cnFontSize * 0.5) + gap;
  const dateY = divY + gap + Math.round(dateFontSize * 0.7);
  const subY  = dateY + Math.round(dateFontSize * 0.6) + gap + Math.round(subFontSize * 0.7);

  // ====== 4. SVG 叠加层 ======
  const svgOverlay = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="txtShadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgba(0,0,0,0.75)"/>
          <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.55)"/>
          <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="rgba(0,0,0,0.35)"/>
        </filter>
        <filter id="lightS" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="3" flood-color="rgba(0,0,0,0.60)"/>
        </filter>
      </defs>

      <!-- Logo 左上角 -->
      <image href="data:image/png;base64,${logoB64}"
             x="${logoX}" y="${logoY}" width="${lw}" height="${lh}"/>

      <!-- 英文副标题 -->
      <text x="${cx}" y="${enY}" text-anchor="middle"
            font-family="Arial,Helvetica,'Microsoft YaHei',sans-serif"
            font-size="${enFontSize}" font-weight="400" letter-spacing="8"
            fill="rgba(255,255,255,0.72)" filter="url(#lightS)">DATA ASSET WEEKLY REPORT</text>

      <!-- 中文主标题 -->
      <text x="${cx}" y="${cnY}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei','SimHei',sans-serif"
            font-size="${cnFontSize}" font-weight="700" letter-spacing="9"
            fill="#FFFFFF" filter="url(#txtShadow)">雾透数据资产周报</text>

      <!-- 分隔线 -->
      <line x1="${cx - 40}" y1="${divY}" x2="${cx + 40}" y2="${divY}"
            stroke="rgba(255,255,255,0.38)" stroke-width="1.5" stroke-linecap="round"/>

      <!-- 日期 -->
      <text x="${cx}" y="${dateY}" text-anchor="middle"
            font-family="Arial,Helvetica,'Microsoft YaHei',sans-serif"
            font-size="${dateFontSize}" font-weight="400" letter-spacing="7"
            fill="rgba(255,255,255,0.78)" filter="url(#lightS)">${dateStr}</text>

      <!-- 副标语 -->
      <text x="${cx}" y="${subY}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei',sans-serif"
            font-size="${subFontSize}" font-weight="300" letter-spacing="6"
            fill="rgba(255,255,255,0.65)" filter="url(#lightS)">数据资源化 · 数据资产化 · 数据资本化 — 全链路服务</text>
    </svg>
  `;

  await sharp(bgBuffer)
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png({ quality: 95, compressionLevel: 6 })
    .toFile('banner_final.png');

  console.log(`OK — banner_final.png (${W}x${H})`);
}

main().catch(e => { console.error(e); process.exit(1); });
