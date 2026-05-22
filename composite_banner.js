const sharp = require('sharp');
const path = require('path');

const ARTICLES = __dirname;

async function composite() {
  // 1. 纯渐变背景
  const bg = sharp(path.join(ARTICLES, 'Clean_WeChat_article_header_ba_2026-05-22T04-02-27.png'));
  const bgMeta = await bg.metadata();
  console.log('Background:', bgMeta.width, 'x', bgMeta.height);

  // 2. 原始Logo → 缩放 → 去白底
  const logoSrc = sharp(path.join(ARTICLES, 'linping-logo.png'));
  const logoMeta = await logoSrc.metadata();
  console.log('Original Logo:', logoMeta.width, 'x', logoMeta.height);

  const targetH = Math.round(bgMeta.height * 0.68);
  const targetW = Math.round(targetH * (logoMeta.width / logoMeta.height));
  console.log('Logo target:', targetW, 'x', targetH);

  // 缩放 + raw提取
  const { data, info } = await logoSrc
    .resize(targetW, targetH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 白底 → 透明
  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
    if (r > 220 && g > 220 && b > 220) {
      pixels[i + 3] = 0;
    }
  }

  const logoClear = await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 }
  }).png().toBuffer();

  // 合成：Logo左侧居中
  const logoX = 40;
  const logoY = Math.round((bgMeta.height - targetH) / 2) - 20;

  await bg
    .composite([{ input: logoClear, top: logoY, left: logoX }])
    .png()
    .toFile(path.join(ARTICLES, 'banner_final_with_logo.png'));

  console.log('Done → banner_final_with_logo.png');
}

composite().catch(err => { console.error('Error:', err.message); process.exit(1); });
