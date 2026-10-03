const axios = require('axios');
const cheerio = require('cheerio');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testScraping() {
  // 1. GOG - Try different pages for free games
  console.log('=== GOG SCRAPING ===');
  try {
    const r = await axios.get('https://www.gog.com/en/games/free', { 
      headers: { 'User-Agent': UA }, 
      timeout: 15000 
    });
    const $ = cheerio.load(r.data);
    
    // Look for product tiles
    const games = [];
    $('a[href*="/game/"]').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).find('.product-tile__title').text().trim() || 
                   $(el).find('[class*="title"]').text().trim();
      const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
      if (href && !games.find(g => g.href === href)) {
        games.push({ href, title, img });
      }
    });
    console.log('  Games found: ' + games.length);
    games.slice(0, 5).forEach(g => {
      console.log('  - ' + (g.title || 'no title') + ' | ' + (g.img || 'no img').substring(0, 60));
    });
    
    // Try specific selectors
    const productCards = $('.product-tile, [class*="product-card"], [class*="game-card"]');
    console.log('  Product cards: ' + productCards.length);
    
    // Check for ng-init or data attributes
    const ngInit = $('[ng-init], [data-products], [data-game]');
    console.log('  ng-init elements: ' + ngInit.length);
    
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 2. ITCH.IO - Parse HTML better
  console.log('\n=== ITCH.IO SCRAPING ===');
  try {
    const r = await axios.get('https://itch.io/games/free', { 
      headers: { 'User-Agent': UA }, 
      timeout: 15000 
    });
    const $ = cheerio.load(r.data);
    
    const games = [];
    $('.game_cell, .game-cell, [class*="game"]').each((i, el) => {
      const title = $(el).find('.title, [class*="title"]').first().text().trim();
      const img = $(el).find('img').attr('src');
      const link = $(el).find('a').attr('href');
      if (title) {
        games.push({ title, img, link });
      }
    });
    console.log('  Games: ' + games.length);
    games.slice(0, 5).forEach(g => {
      console.log('  - ' + g.title + ' | ' + (g.img || '').substring(0, 60));
    });
    
    // Try alternate selectors
    const altTitles = $('a[href*="/game/"] .title, .game_cell_link .title');
    console.log('  Alt titles: ' + altTitles.length);
    
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 3. STEAM - Get temporarily free (not F2P)
  console.log('\n=== STEAM TEMP FREE ===');
  try {
    // Search for games on sale with 100% discount
    const r = await axios.get('https://store.steampowered.com/search/?specials=1&maxprice=free&category1=998', { 
      headers: { 'User-Agent': UA }, 
      timeout: 15000 
    });
    const $ = cheerio.load(r.data);
    
    const games = [];
    $('a[href*="/app/"]').each((i, el) => {
      const title = $(el).find('.title').text().trim();
      const link = $(el).attr('href');
      const img = $(el).find('img').attr('src');
      if (title && !games.find(g => g.title === title)) {
        games.push({ title, link, img });
      }
    });
    console.log('  Games: ' + games.length);
    games.slice(0, 5).forEach(g => {
      console.log('  - ' + g.title);
    });
    
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 4. Try freegamesdb.com or similar aggregator
  console.log('\n=== FREE GAMES AGGREGATOR ===');
  const aggregators = [
    'https://www.pcgamingwiki.com/wiki/List_of_currently_free_games',
    'https://gg.deals/deals/?maxPrice=0&store=epic-store,steam,gog',
  ];
  
  for (const url of aggregators) {
    try {
      const r = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 10000 });
      console.log('  ' + url.substring(0, 40) + ': ' + r.status + ' | ' + r.data.length + ' chars');
      // Look for game titles
      const $ = cheerio.load(r.data);
      const titles = $('a[href*="/game"], a[href*="store"], h3, h4').slice(0, 10).map(function() {
        return $(this).text().trim();
      }).get().filter(t => t.length > 2 && t.length < 60);
      console.log('  Titles: ' + titles.length);
      titles.slice(0, 5).forEach(t => console.log('    - ' + t));
    } catch (e) {
      console.log('  ' + url.substring(0, 40) + ': ' + e.message.substring(0, 40));
    }
  }
}

testScraping();
