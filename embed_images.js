const fs = require('fs');
const path = require('path');

function embedImages(htmlFile) {
  let html = fs.readFileSync(htmlFile, 'utf-8');
  const dir = path.dirname(path.resolve(htmlFile));
  
  const imgRegex = /<img[^>]+src=["']((?!https?:)(?!\/\/)(?!data:)[^"']+)["'][^>]*>/gi;
  let changed = 0;
  
  html = html.replace(imgRegex, (match, src) => {
    const imgPath = path.resolve(dir, src);
    if (fs.existsSync(imgPath)) {
      const buf = fs.readFileSync(imgPath);
      const ext = path.extname(src).toLowerCase().replace('.', '');
      const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
      const b64 = buf.toString('base64');
      changed++;
      return match.replace(src, 'data:' + mime + ';base64,' + b64);
    }
    return match;
  });
  
  return { html, changed };
}

const wutoushe = embedImages('wutoushe_article_2026-05-25.html');
const houri = embedImages('houri_capital_article_2026-05-25.html');

fs.writeFileSync('wutoushe_article_2026-05-25_copy.html', wutoushe.html);
fs.writeFileSync('houri_capital_article_2026-05-25_copy.html', houri.html);

console.log('Wutoushe: embedded ' + wutoushe.changed + ' images, size: ' + (Buffer.byteLength(wutoushe.html)/1024).toFixed(0) + ' KB');
console.log('Houri: embedded ' + houri.changed + ' images, size: ' + (Buffer.byteLength(houri.html)/1024).toFixed(0) + ' KB');
console.log('Done.');
