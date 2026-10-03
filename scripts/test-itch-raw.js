const axios = require('axios');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function test() {
  const r = await axios.get('https://itch.io/games/free', { headers: { 'User-Agent': UA }, timeout: 15000 });
  const html = r.data;
  
  // Find game_cell and print raw HTML around it
  const idx = html.indexOf('game_cell');
  console.log('game_cell found at index:', idx);
  if (idx >= 0) {
    console.log('\n=== RAW HTML around game_cell ===');
    console.log(html.substring(Math.max(0, idx - 100), idx + 800));
    console.log('\n=== END ===');
  }
  
  // Count occurrences
  const count = (html.match(/game_cell/g) || []).length;
  console.log('\ngame_cell occurrences:', count);
  
  // Count game_link occurrences
  const linkCount = (html.match(/game_link/g) || []).length;
  console.log('game_link occurrences:', linkCount);
  
  // Count itch.zone image occurrences
  const imgCount = (html.match(/img\.itch\.zone/g) || []).length;
  console.log('itch.zone images:', imgCount);
  
  // Find first itch.zone image
  const firstImg = html.indexOf('img.itch.zone');
  if (firstImg >= 0) {
    console.log('\nFirst itch.zone image context:');
    console.log(html.substring(Math.max(0, firstImg - 200), firstImg + 200));
  }
}

test();
