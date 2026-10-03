const axios = require('axios');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testAllPlatforms() {
  // 1. CHEAPSHARK - Aggregator de deals (temporarily free)
  console.log('=== CHEAPSHARK (deals temporarily free) ===');
  try {
    const r = await axios.get('https://www.cheapshark.com/api/1.0/deals?upperPrice=0&pageSize=50', { timeout: 10000 });
    console.log('  Free deals: ' + r.data.length);
    const stores = {};
    r.data.forEach(d => { stores[d.storeID] = (stores[d.storeID] || 0) + 1; });
    console.log('  By store:', JSON.stringify(stores));
    r.data.slice(0, 5).forEach(d => console.log('  - ' + d.title + ' | normal:' + d.normalPrice + ' sale:' + d.salePrice + ' metacritic:' + d.metacriticScore));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 2. GOG API
  console.log('\n=== GOG API ===');
  try {
    const r = await axios.get('https://api.gog.com/v2/games?price=free&sort=popularity', { timeout: 10000 });
    console.log('  Status: ' + r.status);
    const items = r.data?.items || r.data?.products || [];
    console.log('  Games: ' + items.length);
    items.slice(0, 3).forEach(g => console.log('  - ' + (g.title || g.name) + ' | price: ' + JSON.stringify(g.price)));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 3. GOG - scrape free page more deeply
  console.log('\n=== GOG HTML scrape ===');
  try {
    const r = await axios.get('https://www.gog.com/en/games/free', { headers: { 'User-Agent': UA }, timeout: 10000 });
    const html = r.data;
    // Look for JSON embedded data
    const ngData = html.match(/__NEXT_DATA__.*?=\s*(\{.*?\})\s*<\/script/s);
    if (ngData) {
      console.log('  Found __NEXT_DATA__');
      const parsed = JSON.parse(ngData[1]);
      console.log('  Keys: ' + Object.keys(parsed.props?.pageProps || {}).join(', '));
    }
    // Look for product tiles
    const tiles = html.match(/product-tile/g) || [];
    console.log('  Product tiles: ' + tiles.length);
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 4. Humble Bundle free games
  console.log('\n=== HUMBLE BUNDLE ===');
  try {
    const r = await axios.get('https://www.humblebundle.com/store/api/resolve?products=free', { 
      headers: { 'User-Agent': UA, 'Accept': 'application/json' }, timeout: 10000 
    });
    console.log('  Status: ' + r.status);
    console.log('  Data: ' + JSON.stringify(r.data).substring(0, 200));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 5. ITCH.IO free games
  console.log('\n=== ITCH.IO ===');
  try {
    const r = await axios.get('https://itch.io/games/free/tag-singleplayer', { headers: { 'User-Agent': UA }, timeout: 10000 });
    const html = r.data;
    const titles = html.match(/class="title">([^<]+)<\/span>/g) || [];
    const imgs = html.match(/src="(https:\/\/img\.itch\.io[^"]+)"/g) || [];
    console.log('  Titles: ' + titles.length + ' | Images: ' + imgs.length);
    titles.slice(0, 3).forEach(t => console.log('  - ' + t.replace(/<[^>]+>/g, '')));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 6. Steam temporarily free (not F2P)
  console.log('\n=== STEAM TEMP FREE ===');
  try {
    // Search for games with discount 100%
    const r = await axios.get('https://store.steampowered.com/search/?specials=1&maxprice=free&supportedlang=english', { 
      headers: { 'User-Agent': UA }, timeout: 10000 
    });
    const html = r.data;
    const rows = html.split('data-ds-appid=');
    let freeCount = 0;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].includes('>Free<') || rows[i].includes('data-price-final="0"')) freeCount++;
    }
    console.log('  Free games found: ' + freeCount);
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 7. Green Man Gaming
  console.log('\n=== GREEN MAN GAMING ===');
  try {
    const r = await axios.get('https://www.greenmangaming.com/games/?price=free', { headers: { 'User-Agent': UA }, timeout: 10000 });
    const html = r.data;
    const titles = html.match(/class="[^"]*product-title[^"]*"[^>]*>([^<]+)/g) || [];
    console.log('  Titles: ' + titles.length);
    titles.slice(0, 3).forEach(t => console.log('  - ' + t.replace(/<[^>]+>/g, '').trim()));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 8. Rawg free games
  console.log('\n=== RAWG.IO ===');
  try {
    const r = await axios.get('https://api.rawg.io/api/games?is_free=true&ordering=-metacritic&page_size=10&key=test', { timeout: 10000 });
    console.log('  Status: ' + r.status + ' | Count: ' + r.data?.count);
    (r.data?.results || []).slice(0, 3).forEach(g => console.log('  - ' + g.name + ' | metacritic: ' + g.metacritic));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }
}

testAllPlatforms();
