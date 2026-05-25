const juice = require('juice');
const fs = require('fs');
let html = fs.readFileSync('linping_daily_2026-05-23.html', 'utf-8');

// Strip meta viewport
html = html.replace(/<meta[^>]*viewport[^>]*>/gi, '');

// Strip incompatible rules
html = html.replace(/<style>([\s\S]*?)<\/style>/gi, (match, css) => {
  css = css
    .replace(/[^}]*:hover\s*\{[^}]*\}/g, '')
    .replace(/position:\s*(?:fixed|sticky);?/gi, '')
    .replace(/animation:[^;]+;?/gi, '')
    .replace(/@keyframes\s+[^{]*\{[^}]*\}/gi, '');
  return '<style>' + css + '</style>';
});

// Inline CSS
html = juice(html, {
  removeStyleTags: true,
  preserveImportant: true,
});

// Check results
const hasStyle = /<style/i.test(html);
const inlineCount = (html.match(/style="/g) || []).length;
console.log('Has <style>:', hasStyle);
console.log('Inline style count:', inlineCount);
console.log('Total size:', Buffer.byteLength(html, 'utf-8'), 'bytes');

// Check a sample element
const sample = html.match(/<div class="section-title"[^>]*>/);
if (sample) console.log('Sample section-title:', sample[0].substring(0, 300));

// Check font-family
const fonts = html.match(/font-family:[^;"]+/g);
if (fonts) console.log('First font-family:', fonts[0]);

// Save result for inspection
fs.writeFileSync('linping_daily_2026-05-23_inlined.html', html);
console.log('Saved inlined version to linping_daily_2026-05-23_inlined.html');
