const axios = require('axios');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function test() {
  // 1. CheapShark - try correct endpoint for free games
  console.log('=== CHEAPSHARK ===');
  try {
    // Get all deals, filter by salePrice = 0
    const r = await axios.get('https://www.cheapshark.com/api/1.0/deals?pageSize=60&sortBy=Metacritic&desc=1', { timeout: 10000 });
    const freeDeals = r.data.filter(d => parseFloat(d.salePrice) === 0);
    console.log('  Total deals: ' + r.data.length);
    console.log('  Free deals (salePrice=0): ' + freeDeals.length);
    const storeNames = { '1': 'Steam', '7': 'GOG', '21': 'Humble', '23': 'Epic', '25': 'Ubisoft', '31': 'Amazon', '24': 'Fanatical', '28': 'GameBillet', '29': 'Voidu', '30': 'Gamesplanet', '33': 'Gamesload', '34': '2Game', '35': 'IndieGala', '36': 'Blizzard', '37': 'DLGamer', '38': 'Noctre', '39': 'DreamGame' };
    freeDeals.forEach(d => {
      const store = storeNames[d.storeID] || 'Store#' + d.storeID;
      console.log('  - ' + d.title + ' (' + store + ') | metacritic:' + d.metacriticScore + ' | thumb:' + (d.thumb || '').substring(0, 60));
    });
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 80));
  }

  // 2. GOG - parse HTML properly for free games
  console.log('\n=== GOG FREE ===');
  try {
    const r = await axios.get('https://www.gog.com/en/games/free', { headers: { 'User-Agent': UA }, timeout: 10000 });
    const html = r.data;
    
    // Look for product cards - each has title, image, link
    const cardPattern = /<a[^>]*href="(\/game\/[^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*product-tile__title[^"]*"[^>]*>([^<]+)<\/span>/g;
    let match;
    const games = [];
    while ((match = cardPattern.exec(html)) !== null && games.length < 10) {
      games.push({ url: match[1], img: match[2], title: match[3].trim() });
    }
    console.log('  Games found: ' + games.length);
    games.forEach(g => console.log('  - ' + g.title + ' | img: ' + g.img.substring(0, 60)));
    
    // Alternative: look for specific patterns
    const links = html.match(/href="\/game\/[a-z0-9\-]+"[^>]*>/g) || [];
    console.log('  Game links: ' + links.length);
    
    // Find images in product tiles
    const imgPattern = /data-src="(https:\/\/[^"]*gog[^"]*\.(?:jpg|png|webp))"/g;
    const imgs = [];
    while ((match = imgPattern.exec(html)) !== null) imgs.push(match[1]);
    console.log('  GOG images: ' + imgs.length);
    if (imgs.length > 0) console.log('  Sample: ' + imgs[0].substring(0, 80));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 3. Itch.io - try API
  console.log('\n=== ITCH.IO API ===');
  try {
    const r = await axios.get('https://itch.io/api/1/key/game/765257/games?downloadable=true', { timeout: 8000 });
    console.log('  Status: ' + r.status);
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }
  
  // Try itch.io web scraping differently
  try {
    const r = await axios.get('https://itch.io/games/free', { headers: { 'User-Agent': UA }, timeout: 10000 });
    const html = r.data;
    // Look for game_cell divs
    const cells = html.match(/game_cell/g) || [];
    console.log('  Game cells: ' + cells.length);
    // Find titles
    const titlePattern = /class="title"[^>]*>([^<]+)/g;
    let m;
    const titles = [];
    while ((m = titlePattern.exec(html)) !== null) titles.push(m[1].trim());
    console.log('  Titles: ' + titles.length);
    titles.slice(0, 5).forEach(t => console.log('  - ' + t));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 4. Epic - search ALL free games (not just promotions)
  console.log('\n=== EPIC ALL FREE ===');
  try {
    // GraphQL query for free games
    const query = {
      "query": "query searchStoreQuery($allowCountries: String, $category: String, $count: Int, $country: String!, $keywords: String, $locale: String, $namespace: String, $sortBy: String, $sortDir: String, $start: Int, $tag: String, $releaseDate: String, $withPrice: Boolean = true) { Catalog { searchStore(allowCountries: $allowCountries, category: $category, count: $count, country: $country, keywords: $keywords, locale: $locale, namespace: $namespace, sortBy: $sortBy, sortDir: $sortDir, start: $start, tag: $tag, releaseDate: $releaseDate) { elements { title id namespace description keyImages { type url } seller { name } price(country: $country) @include(if: $withPrice) { totalPrice { discountPrice originalPrice currencyCode discount } } tags { id name } } paging { count total } } } }",
      "variables": {
        "country": "US",
        "locale": "en-US",
        "count": 100,
        "sortBy": "releasedate",
        "sortDir": "asc",
        "tag": "1367",
        "releaseDate": "gte,2020-01-01",
        "withPrice": true
      }
    };
    const r = await axios.post('https://graphql.epicgames.com/graphql', query, {
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      timeout: 10000
    });
    const elements = r.data?.data?.Catalog?.searchStore?.elements || [];
    console.log('  Games found: ' + elements.length);
    elements.slice(0, 5).forEach(g => {
      const price = g.price?.totalPrice;
      console.log('  - ' + g.title + ' | price: ' + (price?.discountPrice || 'unknown'));
    });
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }
}

test();
