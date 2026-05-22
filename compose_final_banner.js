const sharp = require('sharp');

async function main() {
  const W = 900, H = 320;

  // ====== 1. 深刻渐变背景：左深右浅 ======
  const svgBg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="#6B3810"/>
          <stop offset="14%"  stop-color="#8B4A18"/>
          <stop offset="32%"  stop-color="#B06828"/>
          <stop offset="52%"  stop-color="#D08830"/>
          <stop offset="74%"  stop-color="#E8B040"/>
          <stop offset="100%" stop-color="#F5D458"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%"  stop-color="rgba(245,210,140,0.15)"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <path d="M0,${H*0.40} Q${W*0.20},${H*0.32} ${W*0.42},${H*0.36} T${W*0.72},${H*0.42}"
            stroke="rgba(240,220,160,0.10)" stroke-width="0.7" fill="none"/>
      <circle cx="${W*0.30}" cy="${H*0.30}" r="2.0" fill="rgba(245,220,160,0.12)"/>
      <circle cx="${W*0.55}" cy="${H*0.25}" r="1.6" fill="rgba(240,210,150,0.10)"/>
      <circle cx="${W*0.75}" cy="${H*0.60}" r="1.8" fill="rgba(235,200,140,0.09)"/>
      <circle cx="${W*0.88}" cy="${H*0.70}" r="1.4" fill="rgba(225,190,130,0.08)"/>
    </svg>
  `;

  const bgBuffer = await sharp(Buffer.from(svgBg)).png().toBuffer();

  // ====== 2. Logo 去白底 ======
  const logoBuf = await sharp('linping-logo.png')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const raw = logoBuf.data;
  const ch = logoBuf.info.channels;
  for (let i = 0; i < raw.length; i += ch) {
    if (raw[i] > 218 && raw[i+1] > 218 && raw[i+2] > 218) raw[i+3] = 0;
  }

  const logoPng = await sharp(raw, {
    raw: { width: logoBuf.info.width, height: logoBuf.info.height, channels: ch }
  }).png().toBuffer();

  // Logo 尺寸：占高度比例
  const logoScale = 0.18;
  const lw = Math.round(logoBuf.info.width * logoScale);
  const lh = Math.round(logoBuf.info.height * logoScale);

  const logoResized = await sharp(logoPng).resize(lw, lh).png().toBuffer();
  const logoB64 = logoResized.toString('base64');

  // ====== 3. Logo 左上角，文字水平居中 ======
  const cx = Math.round(W / 2);

  // Logo 左上角（紧贴左边缘）
  const logoX = Math.round(W * 0.005);          // 距左 0.5%
  const logoY = Math.round(H * 0.04);           // 距顶 4%

  // 文字水平居中对齐（字号再加码）
  const cnFontSize  = Math.round(H * 0.145);   // 主标题 ~46px
  const enFontSize  = Math.round(H * 0.062);   // 英文 ~20px
  const dateFontSize = Math.round(H * 0.058);   // 日期 ~19px
  const subFontSize = Math.round(H * 0.046);   // 副标语 ~15px

  const gap = 12;
  const enY   = Math.round(H * 0.30);           // 文字整体下调
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

      <!-- Logo 居中，顶部 -->
      <image href="data:image/png;base64,${logoB64}"
             x="${logoX}" y="${logoY}" width="${lw}" height="${lh}"/>

      <!-- 英文副标题 -->
      <text x="${cx}" y="${enY}" text-anchor="middle"
            font-family="Arial,Helvetica,'Microsoft YaHei',sans-serif"
            font-size="${enFontSize}" font-weight="400" letter-spacing="8"
            fill="rgba(255,255,255,0.72)" filter="url(#lightS)">DATA ASSET DAILY REPORT</text>

      <!-- 中文主标题 -->
      <text x="${cx}" y="${cnY}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei','SimHei',sans-serif"
            font-size="${cnFontSize}" font-weight="700" letter-spacing="9"
            fill="#FFFFFF" filter="url(#txtShadow)">数据资产日报</text>

      <!-- 分隔线 -->
      <line x1="${cx - 40}" y1="${divY}" x2="${cx + 40}" y2="${divY}"
            stroke="rgba(255,255,255,0.38)" stroke-width="1.5" stroke-linecap="round"/>

      <!-- 日期 -->
      <text x="${cx}" y="${dateY}" text-anchor="middle"
            font-family="Arial,Helvetica,'Microsoft YaHei',sans-serif"
            font-size="${dateFontSize}" font-weight="400" letter-spacing="7"
            fill="rgba(255,255,255,0.78)" filter="url(#lightS)">2026年5月22日 星期五</text>

      <!-- 副标语 -->
      <text x="${cx}" y="${subY}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei',sans-serif"
            font-size="${subFontSize}" font-weight="300" letter-spacing="6"
            fill="rgba(255,255,255,0.65)" filter="url(#lightS)">追踪数据要素市场脉动 · 洞察数字经济发展趋势</text>
    </svg>
  `;

  await sharp(bgBuffer)
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png({ quality: 95, compressionLevel: 6 })
    .toFile('banner_final.png');

  console.log(`OK — banner_final.png (${W}x${H})`);
}

main().catch(e => { console.error(e); process.exit(1); });
