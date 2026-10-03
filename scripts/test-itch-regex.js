const axios = require('axios');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function test() {
  const r = await axios.get('https://itch.io/games/free', { headers: { 'User-Agent': UA }, timeout: 15000 });
  const html = r.data;
  
  // Get a raw game_cell HTML block
  const idx = html.indexOf('class="game_cell"');
  if (idx >= 0) {
    console.log('=== RAW game_cell HTML (first 1000 chars) ===');
    console.log(html.substring(idx, idx + 1000));
    console.log('');
  }
  
  // Test different regex patterns
  const patterns = [
    // Pattern A: game_cell > a href > img > title
    /class="game_cell"[\s\S]*?href="(https:\/\/[^"]+\.itch\.io\/[^"]+)"[\s\S]*?<img[^>]*(?:data-lazy_src|src)="(https:\/\/img\.itch\.zone\/[^"]+)"[\s\S]*?class="title"[^>]*>([^<]+)/g,
    // Pattern B: simpler - just find href, img, title in sequence
    /href="(https:\/\/[a-z0-9\-]+\.itch\.io\/[a-z0-9\-]+)"[\s\S]{0,500}?<img[^>]*?(?:data-lazy_src|src)="(https:\/\/img\.itch\.zone\/[^"]+)"[\s\S]{0,500}?class="title"[^>]*>([^<]+)/g,
    // Pattern C: game_thumb contains the link and image, title is after
    /game_thumb[\s\S]*?href="(https:\/\/[^"]+)"[\s\S]*?<img[^>]*(?:data-lazy_src|src)="(https:\/\/img\.itch\.zone\/[^"]+)"[\s\S]*?class="title"[^>]*>([^<]+)/g,
  ];
  
  for (let p = 0; p < patterns.length; p++) {
    let count = 0;
    let match;
    while ((match = patterns[p].exec(html)) !== null && count < 3) {
      console.log('Pattern ' + String.fromCharCode(65 + p) + ': ' + match[1].substring(0, 50) + ' | ' + match[3].trim());
      count++;
    }
    console.log('  Total matches: ' + count);
    console.log('');
  }
}

test();
