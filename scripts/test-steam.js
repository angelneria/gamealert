const axios = require('axios');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testSteam() {
  // Test different Steam search URLs
  const urls = [
    'https://store.steampowered.com/search/?specials=1&maxprice=free&category1=998&supportedlang=english',
    'https://store.steampowered.com/search/?filter=free_to_play&count=30&category1=998',
    'https://store.steampowered.com/search/?maxprice=free&category1=998',
    'https://store.steampowered.com/search/?specials=1&maxprice=free',
  ];
  
  for (const url of urls) {
    try {
      const r = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
      const html = r.data;
      const rows = html.split('data-ds-appid=');
      let freeCount = 0;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].includes('>Free<') || rows[i].includes('data-price-final="0"')) freeCount++;
      }
      console.log(url.substring(50, 100));
      console.log('  Total rows: ' + (rows.length - 1) + ' | Free: ' + freeCount);
    } catch (e) {
      console.log(url.substring(50, 100) + ' | Error: ' + e.message.substring(0, 40));
    }
  }
}

testSteam();
