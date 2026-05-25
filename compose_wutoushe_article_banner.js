const sharp = require('sharp');

const titleLines = ['浙江大数据交易中心莅临交流指导', '王慧董事长受聘浙数所要素行业专家'];
const subtitle = '深化产融协同 · 共筑数据生态新格局';

async function main() {
  const W = 900, H = 320;

  // ====== 1. 红色渐变背景 ======
  const svgBg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="#5C1A08"/>
          <stop offset="14%"  stop-color="#7A280E"/>
          <stop offset="32%"  stop-color="#8A2E10"/>
          <stop offset="52%"  stop-color="#9A3412"/>
          <stop offset="74%"  stop-color="#B84820"/>
          <stop offset="100%" stop-color="#D06840"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%"  stop-color="rgba(210,160,140,0.13)"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <path d="M0,${H*0.40} Q${W*0.20},${H*0.32} ${W*0.42},${H*0.36} T${W*0.72},${H*0.42}"
            stroke="rgba(220,190,170,0.10)" stroke-width="0.7" fill="none"/>
      <circle cx="${W*0.30}" cy="${H*0.30}" r="2.0" fill="rgba(240,210,200,0.11)"/>
      <circle cx="${W*0.55}" cy="${H*0.25}" r="1.6" fill="rgba(230,200,190,0.09)"/>
      <circle cx="${W*0.75}" cy="${H*0.60}" r="1.8" fill="rgba(220,190,180,0.08)"/>
      <circle cx="${W*0.88}" cy="${H*0.70}" r="1.4" fill="rgba(210,180,170,0.07)"/>
    </svg>
  `;

  const bgBuffer = await sharp(Buffer.from(svgBg)).png().toBuffer();

  // ====== 2. Logo ======
  const logoBuf = await sharp('wutoushe-logo.png')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const raw = logoBuf.data;
  const ch = logoBuf.info.channels;
  for (let i = 0; i < raw.length; i += ch) {
    if (raw[i] > 218 && raw[i+1] > 218 && raw[i+2] > 218) {
      raw[i+3] = 0;
    } else if (raw[i+3] > 0) {
      raw[i] = 255;
      raw[i+1] = 245;
      raw[i+2] = 240;
    }
  }

  const logoPng = await sharp(raw, {
    raw: { width: logoBuf.info.width, height: logoBuf.info.height, channels: ch }
  }).png().toBuffer();

  const logoScale = 0.16;
  const lw = Math.round(logoBuf.info.width * logoScale);
  const lh = Math.round(logoBuf.info.height * logoScale);

  const logoResized = await sharp(logoPng).resize(lw, lh).png().toBuffer();
  const logoB64 = logoResized.toString('base64');

  // ====== 3. 布局：Logo左上角，标题居中下移 ======
  const cx = Math.round(W / 2);
  const logoX = Math.round(W * 0.03);
  const logoY = Math.round(H * 0.05);

  const titleFontSize = Math.round(H * 0.098);
  const subFontSize  = Math.round(H * 0.072);
  const lineGap = Math.round(H * 0.03);

  const line1Y = Math.round(H * 0.48);
  const line2Y = line1Y + titleFontSize + lineGap;
  const divY    = line2Y + Math.round(titleFontSize * 0.5) + 12;
  const subY    = divY + 14 + Math.round(subFontSize * 0.7);

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

      <image href="data:image/png;base64,${logoB64}"
             x="${logoX}" y="${logoY}" width="${lw}" height="${lh}"/>

      <text x="${cx}" y="${line1Y}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei','SimHei',sans-serif"
            font-size="${titleFontSize}" font-weight="700" letter-spacing="5"
            fill="#FFFFFF" filter="url(#txtShadow)">${titleLines[0]}</text>

      <text x="${cx}" y="${line2Y}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei','SimHei',sans-serif"
            font-size="${titleFontSize}" font-weight="700" letter-spacing="6"
            fill="#FFFFFF" filter="url(#txtShadow)">${titleLines[1]}</text>

      <line x1="${cx - 50}" y1="${divY}" x2="${cx + 50}" y2="${divY}"
            stroke="rgba(255,255,255,0.40)" stroke-width="1.5" stroke-linecap="round"/>

      <text x="${cx}" y="${subY}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei','SimHei',sans-serif"
            font-size="${subFontSize}" font-weight="300" letter-spacing="4"
            fill="rgba(255,255,255,0.68)" filter="url(#lightS)">${subtitle}</text>
    </svg>
  `;

  await sharp(bgBuffer)
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png({ quality: 95, compressionLevel: 6 })
    .toFile('banner_wutoushe_2026-05-25.png');

  console.log('OK — banner_wutoushe_2026-05-25.png (900×320)');
}

main().catch(e => { console.error(e); process.exit(1); });
