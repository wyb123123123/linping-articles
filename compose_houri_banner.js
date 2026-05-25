const sharp = require('sharp');

const titleLines = ['浙江大数据交易中心莅临交流指导', '王慧董事长受聘浙数所要素行业专家'];
const subtitle = '产融协同 · 价值发现 · 数据资产资本化新机遇';

async function main() {
  const W = 900, H = 320;

  // ====== 1. 绿色渐变背景 ======
  const svgBg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="#3D4A00"/>
          <stop offset="14%"  stop-color="#4D5E00"/>
          <stop offset="32%"  stop-color="#5E7000"/>
          <stop offset="52%"  stop-color="#799100"/>
          <stop offset="74%"  stop-color="#98B020"/>
          <stop offset="100%" stop-color="#B0C840"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%"  stop-color="rgba(200,210,180,0.12)"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <path d="M0,${H*0.40} Q${W*0.20},${H*0.32} ${W*0.42},${H*0.36} T${W*0.72},${H*0.42}"
            stroke="rgba(200,240,200,0.08)" stroke-width="0.7" fill="none"/>
      <circle cx="${W*0.30}" cy="${H*0.30}" r="2.0" fill="rgba(200,240,200,0.09)"/>
      <circle cx="${W*0.55}" cy="${H*0.25}" r="1.6" fill="rgba(190,230,190,0.08)"/>
      <circle cx="${W*0.75}" cy="${H*0.60}" r="1.8" fill="rgba(180,220,180,0.07)"/>
      <circle cx="${W*0.88}" cy="${H*0.70}" r="1.4" fill="rgba(170,210,170,0.06)"/>
    </svg>
  `;

  const bgBuffer = await sharp(Buffer.from(svgBg)).png().toBuffer();

  // ====== 2. 布局：纯文字居中 ======
  const cx = Math.round(W / 2);

  const titleFontSize = Math.round(H * 0.105);
  const subFontSize  = Math.round(H * 0.075);
  const brandFontSize = Math.round(H * 0.065);
  const lineGap = Math.round(H * 0.03);

  const brandY = Math.round(H * 0.22);
  const line1Y = Math.round(H * 0.42);
  const line2Y = line1Y + titleFontSize + lineGap;
  const divY    = line2Y + Math.round(titleFontSize * 0.5) + 12;
  const subY    = divY + 14 + Math.round(subFontSize * 0.7);

  // ====== 3. SVG 叠加层 ======
  const svgOverlay = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="txtShadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgba(0,0,0,0.70)"/>
          <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.50)"/>
          <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="rgba(0,0,0,0.30)"/>
        </filter>
        <filter id="lightS" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="3" flood-color="rgba(0,0,0,0.55)"/>
        </filter>
      </defs>

      <!-- 品牌名 -->
      <text x="${cx}" y="${brandY}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei','SimHei',sans-serif"
            font-size="${brandFontSize}" font-weight="700" letter-spacing="10"
            fill="rgba(255,255,255,0.60)" filter="url(#lightS)">后日资本</text>

      <text x="${cx}" y="${line1Y}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei','SimHei',sans-serif"
            font-size="${titleFontSize}" font-weight="700" letter-spacing="5"
            fill="#FFFFFF" filter="url(#txtShadow)">${titleLines[0]}</text>

      <text x="${cx}" y="${line2Y}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei','SimHei',sans-serif"
            font-size="${titleFontSize}" font-weight="700" letter-spacing="6"
            fill="#FFFFFF" filter="url(#txtShadow)">${titleLines[1]}</text>

      <line x1="${cx - 50}" y1="${divY}" x2="${cx + 50}" y2="${divY}"
            stroke="rgba(255,255,255,0.38)" stroke-width="1.5" stroke-linecap="round"/>

      <text x="${cx}" y="${subY}" text-anchor="middle"
            font-family="'PingFang SC','Microsoft YaHei','SimHei',sans-serif"
            font-size="${subFontSize}" font-weight="300" letter-spacing="4"
            fill="rgba(255,255,255,0.68)" filter="url(#lightS)">${subtitle}</text>
    </svg>
  `;

  await sharp(bgBuffer)
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png({ quality: 95, compressionLevel: 6 })
    .toFile('banner_houri_2026-05-25.png');

  console.log('OK — banner_houri_2026-05-25.png (900×320)');
}

main().catch(e => { console.error(e); process.exit(1); });
