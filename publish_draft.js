const fs = require('fs');
const https = require('https');

const html = fs.readFileSync('articles/linping_article_2026-05-22.html', 'utf-8');

function getToken() {
  return new Promise((resolve) => {
    https.get('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=wx511d73d0da197f60&secret=eb96d14a1c96d4d4d9b0996ed6605f5c', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).access_token));
    });
  });
}

async function main() {
  const token = await getToken();
  console.log('Token obtained, creating draft...');

  const body = JSON.stringify({
    articles: [{
      title: '数据资产化三问：中小企业数字化转型的"临平路径"',
      author: '临平数据产业协会',
      digest: '2023年国家数据局挂牌以来，数据正式成为第五大生产要素。2026年政策全面落地，中小企业数据资产化到底怎么走？本期干货科普，结合临平产业实践，梳理三步走路径。',
      content: html,
      content_source_url: '',
      thumb_media_id: '0lXgYYY6YEIzRsOzZH6BCA4szgrOw3VsIW1MRFKTbCThttrlTrLBCbJu2Raiuqw9',
      need_open_comment: 0,
      only_fans_can_comment: 0,
      pic_crop: { left: 0, right: 1, top: 0, bottom: 1 }
    }]
  });

  const result = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.weixin.qq.com',
      path: '/cgi-bin/draft/add?access_token=' + token,
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.write(body);
    req.end();
  });

  console.log('Result:', result);
}

main().catch(err => console.error('Error:', err));
