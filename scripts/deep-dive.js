const axios = require('axios');
const cheerio = require('cheerio');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function deepDive() {
  // 1. GOG - look at raw HTML structure
  console.log('=== GOG RAW HTML ===');
  try {
    const r = await axios.get('https://www.gog.com/en/games/free', { 
      headers: { 'User-Agent': UA }, 
      timeout: 15000 
    });
    const $ = cheerio.load(r.data);
    
    // Find all links with /game/ in href
    const gameLinks = [];
    $('a[href*="/game/"]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().replace(/\s+/g, ' ').trim().substring(0, 80);
      const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
      if (!gameLinks.find(g => g.href === href)) {
        gameLinks.push({ href, text, img: img.substring(0, 80) });
      }
    });
    console.log('  Unique game links: ' + gameLinks.length);
    gameLinks.slice(0, 10).forEach(g => {
      console.log('  - ' + g.href);
      console.log('    text: ' + g.text);
      console.log('    img: ' + g.img);
    });
    
    // Look for __NEXT_DATA__ or similar
    const scripts = $('script').toArray();
    for (const s of scripts) {
      const content = $(s).html() || '';
      if (content.includes('products') || content.includes('games')) {
        console.log('\n  Script with products/games: ' + content.substring(0, 200));
      }
    }
    
    // Look for price indicators
    const priceElements = $('[class*="price"], [data-price]');
    console.log('\n  Price elements: ' + priceElements.length);
    priceElements.slice(0, 5).each((i, el) => {
      console.log('  - ' + $(el).text().trim().substring(0, 40));
    });
    
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 2. ITCH.IO - look at actual structure
  console.log('\n=== ITCH.IO RAW HTML ===');
  try {
    const r = await axios.get('https://itch.io/games/free', { 
      headers: { 'User-Agent': UA }, 
      timeout: 15000 
    });
    const $ = cheerio.load(r.data);
    
    // Find game cells
    const cells = $('.game_cell');
    console.log('  Game cells: ' + cells.length);
    
    cells.slice(0, 5).each((i, el) => {
      const title = $(el).find('.title').text().trim();
      const link = $(el).find('a').attr('href');
      const img = $(el).find('img').attr('src');
      console.log('  - title: ' + title);
      console.log('    link: ' + link);
      console.log('    img: ' + (img || '').substring(0, 60));
    });
    
    // Try different selectors
    const altCells = $('.game_cell_link, .game_overview, [class*="game_cell"]');
    console.log('  Alt cells: ' + altCells.length);
    
    // Look at the HTML around game cells
    const firstCell = cells.first();
    if (firstCell.length) {
      console.log('\n  First cell HTML: ' + firstCell.html().substring(0, 500));
    }
    
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 3. Epic - try the promotions API with different params
  console.log('\n=== EPIC DEEP ===');
  try {
    // Try the graphql endpoint
    const r = await axios.post('https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions', 
      { locale: 'en-US', country: 'US', allowCountries: 'US' },
      { headers: { 'Content-Type': 'application/json', 'User-Agent': UA }, timeout: 10000 }
    );
    console.log('  POST status: ' + r.status);
    console.log('  Data: ' + JSON.stringify(r.data).substring(0, 200));
  } catch (e) {
    console.log('  POST Error: ' + e.message.substring(0, 50));
  }
  
  // Try with query params
  try {
    const r = await axios.get('https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=es-ES&country=ES&allowCountries=ES', { timeout: 10000 });
    const elements = r.data?.data?.Catalog?.searchStore?.elements || [];
    const freeOnes = elements.filter(g => g.price?.totalPrice?.discountPrice === 0);
    console.log('  ES locale - Total: ' + elements.length + ' Free: ' + freeOnes.length);
    freeOnes.forEach(g => console.log('  - ' + g.title));
  } catch (e) {
    console.log('  ES Error: ' + e.message.substring(0, 50));
  }

  // 4. Try gg.deals API
  console.log('\n=== GG.DEALS ===');
  try {
    const r = await axios.get('https://gg.deals/api/deals/?maxPrice=0', { 
      headers: { 'User-Agent': UA }, 
      timeout: 10000 
    });
    console.log('  Status: ' + r.status);
    console.log('  Data: ' + JSON.stringify(r.data).substring(0, 200));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }
}

deepDive();
